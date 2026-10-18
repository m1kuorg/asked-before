// Checks the container image (m1kuorg/basics#53) with Docker. The image
// builds from the Dockerfile on the official Bun image, with its health
// check run by Bun rather than curl. A container from it, on a fresh named
// volume at /data and a free port, serves the app: the health endpoint and
// the landing page answer, a learner signs up and makes a project, and the
// SQLite file is on the volume. Docker's health check reports it healthy.
// After a restart, and then in a new container on the same volume, the
// learner's session and project are still there, and the database records
// each of the schema's migrations once. The container, its
// volume, and the image are removed at the end. It makes no model calls, so
// it needs no key; it needs Docker running. It exits 1 if any check fails,
// naming the step.
// Run: bun run check:container

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { browser, freePort } from "./lib/app";

const ROOT = join(import.meta.dir, "..");
const RUN = `asked-before-check-${Date.now().toString(36)}`;
const IMAGE = `${RUN}:latest`;
const VOLUME = `${RUN}-data`;
const DATA = "/data";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

/** Runs `docker <args>` to its end, and gives its exit code and output. */
async function docker(...args: string[]) {
  const proc = Bun.spawn(["docker", ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, out: out.trim(), err: err.trim() };
}

if ((await docker("info", "--format", "{{.ServerVersion}}")).code !== 0) {
  console.error("check:container needs Docker running: start Docker, then run it again.");
  process.exit(1);
}

const port = freePort();
const url = `http://127.0.0.1:${port}`;
let container = "";

/** Starts a container from the image, on the volume and the port. */
async function start(name: string) {
  const started = await docker("run", "--detach", "--name", name, "--publish", `127.0.0.1:${port}:3000`, "--volume", `${VOLUME}:${DATA}`, IMAGE);
  if (started.code !== 0) throw new Error(`docker run exits ${started.code}: ${started.err.split("\n")[0]}`);
  container = name;
}

/** Waits until the app answers its health check through the published port. */
async function answers(timeoutMs = 30_000) {
  if (!container) throw new Error("no container is running");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(`${url}/api/v1/health`).catch(() => null);
    if (response?.ok) return;
    if (Date.now() > deadline) throw new Error(`the app didn't answer within ${timeoutMs / 1000}s:\n${(await docker("logs", container)).err}`);
    await Bun.sleep(250);
  }
}

/** Waits for Docker's own health check to call the container healthy, and gives what it said. */
async function healthy(timeoutMs = 60_000): Promise<string> {
  if (!container) throw new Error("no container is running");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = (await docker("inspect", "--format", "{{.State.Health.Status}}", container)).out;
    if (status === "healthy" || Date.now() > deadline) return status;
    await Bun.sleep(500);
  }
}

const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const ada = browser(url);

try {
  await step("1. The image builds on the official Bun image, with a health check run by Bun", async () => {
    const built = await docker("build", "--tag", IMAGE, ".");
    check(built.code === 0, `docker build exits ${built.code}${built.code ? `: ${built.err.split("\n").slice(-3).join(" | ")}` : ""}`);
    const dockerfile = await Bun.file(join(ROOT, "Dockerfile")).text();
    const base = dockerfile.match(/^FROM (\S+)/m)?.[1] ?? "";
    check(base.startsWith("oven/bun:"), `it's built FROM ${base}`);
    const test: string[] = JSON.parse((await docker("image", "inspect", "--format", "{{json .Config.Healthcheck.Test}}", IMAGE)).out || "null") ?? [];
    check(test[1] === "bun" && !test.join(" ").includes("curl"), `its health check runs ${test.slice(1, 2).join(" ") || "nothing"}`);
    const volumes = (await docker("image", "inspect", "--format", "{{json .Config.Volumes}}", IMAGE)).out;
    check(volumes.includes(`"${DATA}"`), `it declares a volume at ${DATA}: ${volumes}`);
  });

  await step("2. A container on a fresh volume serves the app, and keeps its database on the volume", async () => {
    await docker("volume", "create", VOLUME);
    await start(`${RUN}-1`);
    await answers();
    const health = await ada.client.health.check();
    check(health.ok === true, `the health endpoint answers ${JSON.stringify(health)}`);
    const landing = await fetch(url);
    check(landing.status === 200 && (await landing.text()).includes("<html"), `the landing page answers ${landing.status}`);
    await ada.client.auth.signUp(ADA);
    const work = await ada.client.projects.create({ name: "Work" });
    check(work.name === "Work", `Ada signs up and makes "${work.name}"`);
    const files = (await docker("exec", container, "ls", DATA)).out.split("\n");
    check(files.includes("asked-before.sqlite"), `the database is on the volume at ${DATA}: ${files.join(", ")}`);
    const user = (await docker("exec", container, "whoami")).out;
    check(user !== "root", `the app runs as ${user}, not root`);
  });

  await step("3. Docker's health check calls the container healthy", async () => {
    const status = await healthy();
    const log = JSON.parse((await docker("inspect", "--format", "{{json .State.Health.Log}}", container)).out || "[]") as { ExitCode: number }[];
    check(status === "healthy", `its health is ${status}, after ${log.length} check(s) exiting ${[...new Set(log.map((l) => l.ExitCode))].join(", ")}`);
  });

  await step("4. After a restart, the session and the project are still there", async () => {
    const restarted = await docker("restart", container);
    check(restarted.code === 0, `docker restart exits ${restarted.code}`);
    await answers();
    const me = await ada.client.auth.me();
    const names = (await ada.client.projects.list()).map((p) => p.name);
    check(me.email === ADA.email && names.join() === "Work", `still logged in as ${me.email}, with ${names.join(", ")}`);
    check((await healthy()) === "healthy", "and healthy again");
  });

  await step("5. A new container on the same volume has them too", async () => {
    await docker("rm", "--force", container);
    await start(`${RUN}-2`);
    await answers();
    const me = await ada.client.auth.me();
    const names = (await ada.client.projects.list()).map((p) => p.name);
    check(me.email === ADA.email && names.join() === "Work", `logged in as ${me.email}, with ${names.join(", ")}`);
    const lines = (await docker("logs", container)).out.split("\n").slice(1);
    const odd = lines.filter((line) => !/^(GET|HEAD|POST|PUT|PATCH|DELETE) \/\S* \d{3} \d+ms$/.test(line));
    check(lines.length > 0 && odd.length === 0, `its log holds only method, path, status, and duration: ${lines.length} lines${odd.length ? `, and ${odd.slice(0, 2).join(" | ")}` : ""}`);
    const files = (await readdir(join(ROOT, "server", "store", "migrations"))).filter((name) => name.endsWith(".sql")).sort().join(" ");
    const read = `import { Database } from "bun:sqlite"; console.log(new Database("${DATA}/asked-before.sqlite", { readonly: true }).query("SELECT name FROM migrations ORDER BY version").all().map((m) => m.name).join(" "))`;
    const recorded = await docker("exec", container, "bun", "-e", read);
    check(recorded.out === files, `after three starts on the volume, its database records each migration once: ${recorded.out || recorded.err.split("\n")[0]}`);
  });
} finally {
  if (container) await docker("rm", "--force", container);
  await docker("volume", "rm", "--force", VOLUME);
  await docker("image", "rm", "--force", IMAGE);
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nThe container holds up.");
process.exit(failures.length ? 1 : 0);
