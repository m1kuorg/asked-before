// Checks the Claude Code plugin (plugins/asked-before; m1kuorg/basics#51)
// and the marketplace at the repo root. `claude plugin validate --strict`
// passes for both. The plugin's single-file build of the MCP server matches
// a fresh build of packages/mcp. Then a copy of the plugin's directory
// alone, as a marketplace install copies it, launches its server exactly as
// its .mcp.json says, with `node` and the options a user would give, on a
// fresh copy of the app: the official MCP client lists the five tools,
// lists the learner's project, and records a question into it. Its launch,
// its options, and the settings page's install snippet agree with
// connect.ts. The skill's SKILL.md is under 500 lines, with frontmatter the
// Agent Skills spec accepts, and names only tools the server lists. It
// needs `claude` and `node` on the PATH and no model key: the one question
// it records lands in an empty project, which the model isn't asked about.
// It exits 1 if any check fails, naming the step.
// Run: bun run check:plugin

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectSnippets, MCP_ENV, PLUGIN } from "../packages/mcp/src/connect";
import { BUNDLE, buildServer } from "./build-plugin";
import { startApp } from "./lib/app";

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

const ROOT = join(import.meta.dir, "..");
const PLUGIN_DIR = join(ROOT, PLUGIN.dir);
const TOOLS = ["check_answer", "list_cards", "list_projects", "record_question", "start_cold_rep"];

type Option = { type: string; title: string; description: string; required?: boolean; default?: string; sensitive?: boolean };
type Manifest = { name: string; userConfig: Record<string, Option> };
type Launch = { command: string; args: string[]; env: Record<string, string> };
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await Bun.file(path).text());

/** Runs a command to its end, and gives its exit code and everything it printed. */
async function run(command: string[]): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(command, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, output: `${stdout}${stderr}`.trim() };
}

await step("1. claude plugin validate --strict passes for the plugin and for the marketplace at the repo root", async () => {
  for (const [what, path] of [["the plugin", PLUGIN_DIR], ["the marketplace", ROOT]] as const) {
    const { code, output } = await run(["claude", "plugin", "validate", "--strict", path]);
    check(code === 0, `${what}: ${output.split("\n").filter(Boolean).at(-1)}`);
  }
});

await step("2. The plugin's build of the MCP server is fresh", async () => {
  const committed = (await Bun.file(BUNDLE).exists()) ? await Bun.file(BUNDLE).text() : null;
  const fresh = await buildServer();
  if (committed === null) check(false, `${PLUGIN.dir}/${PLUGIN.bundle} is missing: run bun run build:plugin`);
  else check(committed === fresh, committed === fresh ? `${PLUGIN.bundle} matches a fresh build of the server (${(fresh.length / 1024).toFixed(0)} KB)` : `${PLUGIN.bundle} is stale: run bun run build:plugin`);
});

const app = await startApp();
const copy = await mkdtemp(join(tmpdir(), "asked-before-plugin-"));
const clients: Client[] = [];
/** The tools the bundled server lists, with their arguments, for the skill's step. */
let listed: { name: string; inputSchema: { properties?: Record<string, unknown> } }[] = [];

try {
  const ada = app.browser().client;
  await ada.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  const work = await ada.projects.create({ name: "Work" });
  const { key } = await ada.keys.create({ name: "Claude Code" });

  // A marketplace install copies the plugin's directory and nothing else, so the copy sits where no node_modules can be reached.
  await cp(PLUGIN_DIR, copy, { recursive: true });
  const manifest = await readJson<Manifest>(join(copy, ".claude-plugin", "plugin.json"));
  const launch = (await readJson<{ mcpServers: Record<string, Launch> }>(join(copy, ".mcp.json"))).mcpServers["asked-before"]!;

  /** Starts the server as Claude Code would from .mcp.json: the plugin's root and the options the user gave, or else their defaults, put in. */
  async function connect(options: Record<string, string>) {
    const put = (value: string) =>
      value.replaceAll("${CLAUDE_PLUGIN_ROOT}", copy).replace(/\$\{user_config\.(\w+)\}/g, (_, name: string) => options[name] ?? manifest.userConfig[name]?.default ?? "");
    const env = Object.fromEntries(Object.entries(launch.env).map(([name, value]) => [name, put(value)]));
    const transport = new StdioClientTransport({ command: launch.command, args: launch.args.map(put), env: { PATH: process.env.PATH ?? "", ...env }, cwd: copy, stderr: "pipe" });
    const client = new Client({ name: "check-plugin", version: "0.0.0" });
    await client.connect(transport);
    clients.push(client);
    return client;
  }
  const textOf = (result: { content: unknown }) => (result.content as { text?: string }[]).map((c) => c.text ?? "").join("\n");

  await step(`3. A copy of the plugin's directory alone launches its server as .mcp.json says (${launch.command}), and the official client lists its five tools`, async () => {
    const mcp = await connect({ server_url: app.url, api_key: key });
    listed = (await mcp.listTools()).tools;
    const names = listed.map((t) => t.name).sort();
    check(names.join() === TOOLS.join(), `tools: ${names.join(", ")}, on protocol ${mcp.getNegotiatedProtocolVersion()}`);
    const projects = await mcp.callTool({ name: "list_projects", arguments: {} });
    const found = projects.structuredContent as { projects: { name: string }[]; defaultProject: unknown };
    check(!projects.isError && found.projects.map((p) => p.name).join() === "Work" && found.defaultProject === null, `list_projects reaches the app with the key: ${textOf(projects).split("\n")[1]}`);
    const question = "how do I squash my last three commits into one?";
    const recorded = await mcp.callTool({ name: "record_question", arguments: { question, project: "Work" } });
    const unsorted = await ada.cards.unsorted(work.id);
    check(!recorded.isError && unsorted.phrasings.map((p) => p.text).join() === question, `record_question records it into Work, where it waits unsorted: ${textOf(recorded)}`);
  });

  await step("4. With the default project option set, a call that names no project uses it", async () => {
    const mcp = await connect({ server_url: app.url, api_key: key, project: "Work" });
    const cards = await mcp.callTool({ name: "list_cards", arguments: {} });
    check(!cards.isError && (cards.structuredContent as { project: { id: string } }).project.id === work.id, `list_cards with no project: ${textOf(cards)}`);
  });

  await step("5. The plugin's launch, its options, and the settings page's install snippet agree with connect.ts", async () => {
    check(launch.command === PLUGIN.command && launch.args.join() === `\${CLAUDE_PLUGIN_ROOT}/${PLUGIN.bundle}`, `.mcp.json launches ${launch.command} ${launch.args.join(" ")}`);
    const passed = Object.entries(PLUGIN.options).map(([setting, option]) => [MCP_ENV[setting as keyof typeof MCP_ENV], `\${user_config.${option}}`]);
    check(JSON.stringify(Object.entries(launch.env).sort()) === JSON.stringify(passed.sort()), `.mcp.json passes each option as its setting: ${Object.keys(launch.env).join(", ")}`);
    check(Object.values(PLUGIN.options).every((option) => manifest.userConfig[option]), `plugin.json declares every option: ${Object.keys(manifest.userConfig).join(", ")}`);
    const marketplace = await readJson<{ name: string; plugins: { name: string; source: string }[] }>(join(ROOT, ".claude-plugin", "marketplace.json"));
    const entry = marketplace.plugins.find((p) => p.name === manifest.name);
    check(PLUGIN.id === `${manifest.name}@${marketplace.name}` && entry?.source === `./${PLUGIN.dir}`, `the marketplace lists ${PLUGIN.id} from ./${PLUGIN.dir}`);
    const origin = (await run(["git", "remote", "get-url", "origin"])).output;
    check(origin.replace(/\.git$/, "").endsWith(`github.com/${PLUGIN.marketplace}`) || origin.endsWith(`github.com:${PLUGIN.marketplace}.git`), `the marketplace is this repo on GitHub, ${PLUGIN.marketplace} (origin ${origin})`);
    const snippet = connectSnippets("https://asked-before.example").claudeCodePlugin;
    const set = [...snippet.matchAll(/--config (\w+)=/g)].map((m) => m[1]!);
    const required = Object.entries(manifest.userConfig).filter(([, option]) => option.required).map(([name]) => name);
    check(
      snippet.includes(`marketplace add ${PLUGIN.marketplace}`) && snippet.includes(`install ${PLUGIN.id}`) && set.every((name) => manifest.userConfig[name]) && required.every((name) => set.includes(name)),
      `the install snippet adds the marketplace, installs ${PLUGIN.id}, and sets every required option: ${set.join(", ")}`,
    );
  });

  await step("6. The skill's SKILL.md is under 500 lines, with frontmatter the Agent Skills spec accepts, and names only the server's tools and their arguments", async () => {
    const skills = [...new Bun.Glob("*/SKILL.md").scanSync(join(copy, "skills"))];
    check(skills.length === 1, `one skill: ${skills.join(", ")}`);
    const [file] = skills;
    const text = await Bun.file(join(copy, "skills", file!)).text();
    const lines = text.trimEnd().split("\n").length;
    check(lines < 500, `${file} has ${lines} lines`);
    const front = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    const field = (name: string) => front.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1]?.trim() ?? "";
    const name = field("name");
    const description = field("description");
    check(name === file!.split("/")[0] && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64, `its name, ${name}, is kebab-case and matches its folder`);
    check(description.length >= 1 && description.length <= 1024, `its description has ${description.length} characters (1 to 1,024)`);
    const known = new Set(listed.flatMap((tool) => [tool.name, ...Object.keys(tool.inputSchema.properties ?? {})]));
    const named = [...new Set([...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]!))];
    const unknown = named.filter((word) => !known.has(word));
    check(TOOLS.every((tool) => named.includes(tool)) && unknown.length === 0, `it names ${named.join(", ")}${unknown.length ? `; the server has no ${unknown.join(", ")}` : ""}`);
  });
} finally {
  await Promise.all(clients.map((client) => client.close()));
  await app.stop();
  await rm(copy, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
