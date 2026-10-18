// Starts a copy of the app for a check script, under `wrangler dev` on a
// free port with fresh local state, and stops it again. Every check script
// that needs the app starts it through here (m1kuorg/basics#60, Testing
// Decisions). The script runs on Bun; Wrangler runs on Node.js 22 or later.
//
//   const app = await startApp();
//   const ada = app.browser();            // keeps its own session cookie, like one browser
//   await ada.client.auth.signUp({ ... });
//   ...
//   await app.stop();

import { createClient, type Client } from "@asked-before/sdk";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

export type App = {
  /** The app's origin, as "http://localhost:51234". */
  url: string;
  /** The local D1 database's SQLite file, for the few checks that read it with bun:sqlite, read-only; check:captures' one write, aging a capture past the ten-minute window, is the documented exception (docs/code-map.md). */
  databasePath: string;
  /** Everything Wrangler has printed so far, the Worker's own lines among its own. */
  log: () => string;
  /** The lines after Wrangler's banner that aren't Wrangler's own: the Worker's request lines (method, path, status, and duration), and any others, such as an uncaught error. */
  workerLog: () => { requests: string[]; others: string[] };
  /** A client for one browser: it keeps the session cookie and sends the page's Origin, as the page's requests do. */
  browser: () => Browser;
  /** Stops the app and deletes its state, unless `state` was given. */
  stop: () => Promise<void>;
  /** Kills Wrangler and its workerd at once, by their process group, as a crash would, with no chance to finish anything; then as stop(). */
  kill: () => Promise<void>;
};

export type Browser = {
  client: Client;
  /** The Cookie header this browser sends, for requests made without the SDK. */
  cookie: () => string;
};

export type StartOptions = {
  /** A folder for the app's local state (its D1 database), kept after stop(), so a later start carries on with it. */
  state?: string;
  /** A port to listen on, from freePort(), so the app keeps one address across starts. */
  port?: number;
  /** The app's folder: this repo, or a copy of it. */
  root?: string;
};

/**
 * Starts the app. `env` adds to or overrides the Worker's vars, such as
 * DAILY_MODEL_REQUESTS or ANTHROPIC_BASE_URL. First it checks for Node.js
 * 22 or later, builds the pages into a folder of their own, and applies the
 * migrations to the state's database.
 */
export async function startApp(env: Record<string, string> = {}, { state, port, root = ROOT }: StartOptions = {}): Promise<App> {
  const node = await nodeForWrangler();
  const dir = await mkdtemp(join(tmpdir(), "asked-before-check-"));
  const persist = state ?? join(dir, "state");
  const pages = join(dir, "pages");
  const wrangler = (args: string[]) =>
    Bun.spawn([node, join(root, "node_modules", "wrangler", "bin", "wrangler.js"), ...args, "--persist-to", persist], {
      cwd: root,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdout: "pipe",
      stderr: "pipe",
      // Its own process group, so stop() reaches workerd, which Wrangler starts, too.
      detached: true,
    });
  const fail = async (what: string, output: string) => {
    await rm(dir, { recursive: true, force: true });
    throw new Error(`${what}:\n${output}`);
  };

  const build = Bun.spawn(["bun", join(root, "scripts", "build-pages.ts"), pages], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if ((await build.exited) !== 0) await fail("The pages didn't build", await new Response(build.stderr).text());
  const migrate = wrangler(["d1", "migrations", "apply", "DB", "--local"]);
  if ((await migrate.exited) !== 0) await fail("The migrations failed", (await new Response(migrate.stdout).text()) + (await new Response(migrate.stderr).text()));
  const d1 = [...new Bun.Glob("v3/d1/miniflare-D1DatabaseObject/*.sqlite").scanSync(persist)].find((file) => !file.endsWith("metadata.sqlite"));
  if (!d1) await fail("The migrations made no database", persist);

  // PUBLIC_URL is emptied so that a value in .env can't point the app's origin elsewhere.
  const vars = Object.entries({ PUBLIC_URL: "", ...env }).flatMap(([name, value]) => ["--var", `${name}:${value}`]);
  // --test-scheduled only quiets Wrangler's warning that the cron doesn't run locally, which could land among the
  // Worker's lines. A check runs the cron at /cdn-cgi/local/scheduled: /__scheduled, the flag's own path, is the
  // static assets' here, since only /api/* reaches the Worker first.
  const proc = wrangler(["dev", "--port", String(port ?? 0), "--inspector-port", "0", "--show-interactive-dev-session=false", "--test-scheduled", "--assets", pages, ...vars]);
  const kill = (signal: NodeJS.Signals) => {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      // The group has ended already.
    }
  };
  // A check that throws before stop() still takes the app down with it.
  const onExit = () => kill("SIGKILL");
  process.on("exit", onExit);

  let log = "";
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) log += decoder.decode(chunk, { stream: true });
  };
  const collected = Promise.all([collect(proc.stdout), collect(proc.stderr)]);

  const stop = async (signal: NodeJS.Signals = "SIGTERM") => {
    kill(signal);
    const ended = await Promise.race([proc.exited.then(() => true), Bun.sleep(5_000).then(() => false)]);
    if (!ended) kill("SIGKILL");
    await proc.exited;
    await collected;
    // Wrangler's workerd may outlive it by a moment.
    kill("SIGKILL");
    process.off("exit", onExit);
    await rm(dir, { recursive: true, force: true });
  };

  const deadline = Date.now() + 60_000;
  let match;
  while (!(match = log.match(/Ready on (http\S+)/))) {
    if (proc.exitCode !== null || Date.now() > deadline) {
      await stop();
      throw new Error(`The app didn't start:\n${log}`);
    }
    await Bun.sleep(25);
  }
  const url = new URL(match[1]!).origin;

  const workerLog = () => {
    // After the banner, a line is either Wrangler's own, which says the same of each request, or the Worker's.
    const lines = (log.split(/Ready on \S+\n/)[1]?.trim().split("\n") ?? []).filter((line) => !line.startsWith("[wrangler:"));
    const request = (line: string) => /^(GET|HEAD|POST|PUT|PATCH|DELETE) \/\S* \d{3} \d+ms$/.test(line);
    return { requests: lines.filter(request), others: lines.filter((line) => !request(line)) };
  };

  return { url, databasePath: join(persist, d1!), log: () => log, workerLog, browser: () => browser(url), stop: () => stop(), kill: () => stop("SIGKILL") };
}

/** The node that runs Wrangler, once it's checked to be 22 or later, as Wrangler needs. */
async function nodeForWrangler(): Promise<string> {
  const node = Bun.which("node");
  if (!node) throw new Error("Wrangler needs Node.js 22 or later, and there's no node on the PATH.");
  const version = (await new Response(Bun.spawn([node, "--version"], { stdout: "pipe" }).stdout).text()).trim();
  if (Number(version.match(/^v(\d+)\./)?.[1] ?? 0) < 22) throw new Error(`Wrangler needs Node.js 22 or later, and ${node} is ${version}.`);
  return node;
}

/** A port nothing on this computer is listening on, for an app that must keep one address. */
export function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const { port } = probe;
  probe.stop(true);
  return port!;
}

/** A client for one browser on the app at `url`. */
export function browser(url: string): Browser {
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const send = async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("origin", url);
    if (jar.size) headers.set("cookie", cookie());
    const response = await fetch(input, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const set = Bun.Cookie.parse(line);
      if (set.value === "" || set.isExpired()) jar.delete(set.name);
      else jar.set(set.name, set.value);
    }
    return response;
  };
  return { client: createClient({ baseUrl: url, fetch: send }), cookie };
}
