// Checks the public docs (m1kuorg/basics#51) against the code, so the two
// can't drift. On a fresh copy of the app, in a real browser, the docs page
// at /docs lists every route in the server's route table
// (server/api/index.ts) and no route it lacks, each with who may call it
// and what it does; it names every error status the server answers; it
// states the sort window's limit with the server's own numbers; and it
// fills the setup snippets with its own server's address, within its
// security policy. The SDK's quickstart, shown on the page and in the SDK's
// README, is packages/sdk/examples/quickstart.ts, and it runs: with an API
// key, it uploads the demo export and lists the answer key's cards (the
// sort is a stand-in that sorts as the key does, so no model key is
// needed). The MCP server's README carries connect.ts's setup snippets. It
// exits 1 if any check fails, naming the step.
// Run: bun run check:docs [screenshot dir]

import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { connectSnippets } from "../packages/mcp/src/connect";
import { key, keySorter } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-docs");
const ROOT = join(import.meta.dir, "..");
const QUICKSTART = join(ROOT, "packages", "sdk", "examples", "quickstart.ts");

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

// The server's route table and settings, read with their defaults, on a database of their own.
const scratch = await mkdtemp(join(tmpdir(), "asked-before-docs-"));
process.env.DATABASE_PATH = join(scratch, "routes.sqlite");
delete process.env.SORT_BATCH_SIZE;
const { apiRoutes } = await import("../server/api");
const { config } = await import("../server/config");
const { CAPTURE_WINDOW } = await import("../server/sort");
const routes = Object.entries(apiRoutes)
  .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path.replace(/^\/api\/v1/, "")}`))
  .sort();

/** Every error status the server's code answers with. */
async function statuses(): Promise<string[]> {
  const found = new Set<string>();
  const files = (await readdir(join(ROOT, "server"), { recursive: true })).filter((file) => file.endsWith(".ts"));
  for (const file of files) {
    const text = await Bun.file(join(ROOT, "server", file)).text();
    for (const match of text.matchAll(/(?:HttpError\(|super\(|status: )(\d{3})/g)) if (Number(match[1]) >= 400) found.add(match[1]!);
  }
  return [...found].sort();
}

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`${app.url}/docs`);
  await page.locator(".docs-endpoint").first().waitFor({ timeout: 5000 }).catch(() => undefined);

  await step("1. The docs page lists every route in the server's route table, and only those", async () => {
    const documented = (await page.locator(".docs-endpoint").allTextContents()).map((text) => text.replace(/\s+/g, " ").trim()).sort();
    const missing = routes.filter((route) => !documented.includes(route));
    const extra = documented.filter((route) => !routes.includes(route));
    check(missing.length === 0, `each of the server's ${routes.length} routes is documented${missing.length ? `; not ${missing.join(", ")}` : ""}`);
    check(extra.length === 0 && documented.length === new Set(documented).size, `each of the ${documented.length} documented routes is in the server, once${extra.length ? `; not ${extra.join(", ")}` : ""}`);
  });

  await step("2. Each documented route says who may call it, its SDK method, and what it does", async () => {
    const rows = await page.locator("tr:has(.docs-endpoint)").evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "")),
    );
    const who = new Set(rows.map((cells) => cells[1]));
    check(rows.length > 0 && [...who].every((w) => ["Key or session", "Session only", "None"].includes(w!)), `who may call each: ${[...who].join(", ")}`);
    check(rows.every((cells) => /\w+\.\w+\(\)/.test(cells[0]!)), "each names its SDK method");
    check(rows.every((cells) => (cells[2] ?? "").length > 20), "each says what it does");
  });

  await step("3. The page names every error status the server answers", async () => {
    const server = await statuses();
    const documented = (await page.locator(".docs-statuses tbody tr td:first-child").allTextContents()).map((text) => text.trim());
    const missing = server.filter((status) => !documented.includes(status));
    check(missing.length === 0, `the server's ${server.join(", ")} are documented${missing.length ? `; not ${missing.join(", ")}` : ""}`);
  });

  await step("4. The sort window's known limit is stated, with the server's numbers", async () => {
    const text = (await page.locator("#sort-window").textContent({ timeout: 2000 })) ?? "";
    check(text.includes(`SORT_BATCH_SIZE (${config.sortBatchSize})`), `it names SORT_BATCH_SIZE and its default, ${config.sortBatchSize}`);
    check(/compared again only while it's inside that window/.test(text), "it says an older unsorted phrasing is compared again only inside the window");
    check(text.includes(`${CAPTURE_WINDOW} most recent unsorted`), `it gives a capture's window, ${CAPTURE_WINDOW}`);
  });

  await step("5. The setup snippets carry this server's address, and the page keeps its security policy", async () => {
    const snippets = connectSnippets(app.url);
    const shown = (await page.locator(".code-block code").allTextContents()).map((text) => text.trim());
    for (const [what, snippet] of Object.entries(snippets)) check(shown.includes(snippet.trim()), `${what} is shown as connect.ts builds it for ${app.url}`);
    await page.screenshot({ path: join(OUT, "docs.png") });
    await page.screenshot({ path: join(OUT, "docs-full.png"), fullPage: true });
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });

  await step("6. The SDK's quickstart is the example file on the page and in the README, and it runs", async () => {
    const quickstart = (await Bun.file(QUICKSTART).text()).trim();
    const shown = (await page.locator(".code-block code").allTextContents()).map((text) => text.trim());
    check(shown.includes(quickstart), "the docs page shows packages/sdk/examples/quickstart.ts");
    const readme = await Bun.file(join(ROOT, "packages", "sdk", "README.md")).text().catch(() => "");
    check(readme.includes(`\`\`\`ts\n${quickstart}\n\`\`\``), "the SDK's README shows it too");

    const ada = app.browser().client;
    await ada.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
    const { key: apiKey } = await ada.keys.create({ name: "Quickstart" });
    const run = Bun.spawn(["bun", QUICKSTART, join(ROOT, "demo", "export.json")], {
      cwd: ROOT,
      env: { ...process.env, ASKED_BEFORE_URL: app.url, ASKED_BEFORE_API_KEY: apiKey },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, errors, code] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text(), run.exited]);
    const lines = output.trim().split("\n");
    console.log(lines.map((line) => `       ${line}`).join("\n"));
    const want = key.skills.map((skill) => `${skill.name}: borrowed ${skill.count} times, borrowed`);
    check(code === 0 && JSON.stringify(lines.slice(1)) === JSON.stringify(want), `it uploads the demo export and lists the answer key's ${want.length} cards${code ? `; exit ${code}: ${errors.trim().split("\n").at(-1)}` : ""}`);
  });

  await step("7. The MCP server's README carries connect.ts's setup snippets", async () => {
    const readme = await Bun.file(join(ROOT, "packages", "mcp", "README.md")).text().catch(() => "");
    for (const [what, snippet] of Object.entries(connectSnippets("https://asked-before.example"))) check(readme.includes(snippet), `${what}, for https://asked-before.example`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
  await rm(scratch, { recursive: true, force: true });
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
