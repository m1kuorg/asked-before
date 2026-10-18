// Checks the SDK's build (m1kuorg/basics#53) as someone outside the repo
// uses it. `bun run build:sdk` emits JavaScript and type declarations into
// packages/sdk/dist, and the package's exports and types point at them. A
// scratch package outside the repo adds the built package from its folder,
// as the SDK's README says, and gets dist, not the TypeScript sources. The
// quickstart typechecks there against the declarations alone, under both
// bundler and Node module resolution, and runs in Bun and in Node against a
// fresh copy of the app with an API key: it uploads the demo export and
// lists the answer key's cards. The sort is a stand-in in this script that
// sorts as the key does, so no model key is needed. It exits 1 if any check
// fails, naming the step.
// Run: bun run check:sdk

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { key, keySorter } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const ROOT = join(import.meta.dir, "..");
const SDK = join(ROOT, "packages", "sdk");
const TSC = join(ROOT, "node_modules", ".bin", "tsc");

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

/** Runs a command to its end, and gives its exit code and everything it printed. */
async function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, out: out.trim(), err: err.trim() };
}
const lastLine = (text: string) => text.split("\n").at(-1) ?? "";

const scratch = await mkdtemp(join(tmpdir(), "asked-before-sdk-"));
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });

try {
  await step("1. The build emits JavaScript and type declarations, and the package's exports and types point at them", async () => {
    const build = await run(["bun", "run", "build:sdk"], ROOT);
    check(build.code === 0, `bun run build:sdk exits ${build.code}${build.code ? `: ${lastLine(build.err || build.out)}` : ""}`);
    const sources = (await readdir(join(SDK, "src"))).filter((file) => file.endsWith(".ts")).map((file) => file.slice(0, -3));
    const built = new Set(await readdir(join(SDK, "dist")).catch(() => []));
    const missing = sources.flatMap((name) => [`${name}.js`, `${name}.d.ts`]).filter((file) => !built.has(file));
    check(missing.length === 0, `dist holds a .js and a .d.ts for each of the ${sources.length} modules${missing.length ? `; not ${missing.join(", ")}` : ""}`);
    const manifest = await Bun.file(join(SDK, "package.json")).json();
    const entry = manifest.exports?.["."];
    check(entry?.types === "./dist/index.d.ts" && entry?.default === "./dist/index.js" && manifest.types === "./dist/index.d.ts", `its exports are ${JSON.stringify(manifest.exports)}, its types ${manifest.types}`);
  });

  await step("2. A package outside the repo adds the built package from its folder, and gets dist", async () => {
    await Bun.write(join(scratch, "package.json"), JSON.stringify({ name: "scratch", private: true, type: "module" }, null, 2));
    const added = await run(["bun", "add", SDK], scratch);
    check(added.code === 0, `bun add ${SDK} exits ${added.code}${added.code ? `: ${lastLine(added.err || added.out)}` : ""}`);
    await Bun.write(join(scratch, "quickstart.ts"), Bun.file(join(SDK, "examples", "quickstart.ts")));
    // Bun links each of a folder's files into node_modules, so the package resolves to the folder's own path.
    const resolve = `console.log(import.meta.resolve("@asked-before/sdk"))`;
    for (const [runtime, cmd] of [["Bun", ["bun", "-e", resolve]], ["Node", ["node", "--input-type=module", "-e", resolve]]] as const) {
      const resolved = (await run([...cmd], scratch)).out.replace(/^file:\/\//, "");
      check(resolved === join(SDK, "dist", "index.js"), `${runtime} resolves it to ${resolved.replace(ROOT, "<repo>")}`);
    }
  });

  await step("3. The quickstart typechecks against the declarations, under bundler and Node resolution", async () => {
    // Node's own types come from @types/bun, which holds them; nothing reaches the SDK's sources.
    const types = join(ROOT, "node_modules", "@types");
    for (const resolution of ["bundler", "nodenext"]) {
      const options = { strict: true, noEmit: true, skipLibCheck: false, target: "esnext", module: resolution === "bundler" ? "preserve" : "nodenext", moduleResolution: resolution, lib: ["esnext", "dom"], typeRoots: [types], types: ["bun"] };
      await Bun.write(join(scratch, "tsconfig.json"), JSON.stringify({ compilerOptions: options, files: ["quickstart.ts"] }, null, 2));
      const typecheck = await run([TSC, "-p", "tsconfig.json"], scratch);
      check(typecheck.code === 0, `with ${resolution} resolution, tsc exits ${typecheck.code}${typecheck.code ? `: ${(typecheck.out || typecheck.err).split("\n").slice(0, 3).join(" | ")}` : ""}`);
    }
  });

  await step("4. The quickstart runs in Bun and in Node against the app, uploading the demo export and listing the answer key's cards", async () => {
    const ada = app.browser().client;
    await ada.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
    const { key: apiKey } = await ada.keys.create({ name: "Scratch package" });
    const want = key.skills.map((skill) => `${skill.name}: borrowed ${skill.count} times, borrowed`);
    for (const runtime of ["bun", "node"]) {
      const quickstart = await run([runtime, "quickstart.ts", join(ROOT, "demo", "export.json")], scratch, { ASKED_BEFORE_URL: app.url, ASKED_BEFORE_API_KEY: apiKey });
      const lines = quickstart.out.split("\n");
      console.log(lines.map((line) => `       ${line}`).join("\n"));
      check(quickstart.code === 0 && lines[0] === "27 of your messages, 0 skipped as too long." && JSON.stringify(lines.slice(1)) === JSON.stringify(want), `in ${runtime}, it lists the answer key's ${want.length} cards${quickstart.code ? `; exit ${quickstart.code}: ${lastLine(quickstart.err)}` : ""}`);
    }
  });
} finally {
  await app.stop();
  model.stop();
  await rm(scratch, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nThe built SDK works outside the repo.");
process.exit(failures.length ? 1 : 0);
