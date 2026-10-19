// The app's whole journey (m1kuorg/basics#53), on a fresh copy of the app,
// with the real model and nothing stubbed. In a real browser at 1920×1080, a
// learner signs up from the landing page, makes a shelf, uploads the demo
// export through the upload page's file input, and sees it sorted; card A
// on the stack matches the answer key, word for word; a cold rep on it fails
// with the known wrong answer and the next passes with the known right one,
// stamping it returned today; the Desk lists that return; and Settings
// makes an API key. Then, as a script would, the SDK lists the shelf's
// cards with that key, and, as an agent would, the MCP server records a
// rephrasing of card A's question, so its count goes up by one and it's
// borrowed again, which the stack shows. Each step saves a screenshot and
// says how long it took; any mismatch stops the run with a message naming
// the step. It prints step names, counts, months, and dates, never message
// text, problems, answers, or reasons.
// It needs ANTHROPIC_API_KEY and Playwright's Chromium, and makes 6 model
// calls (a sort, two cold reps and their checks, and a capture), in under a
// minute.
// Run: bun run journey [screenshot dir]

import { createClient, type Card } from "@asked-before/sdk";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { ENTRY_IN_CLONE, MCP_ENV } from "../packages/mcp/src/connect";
import { key, phrasings } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { known } from "./lib/reps";

const ROOT = join(import.meta.dir, "..");
const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-journey");
const FRAME = { width: 1920, height: 1080 };
/** The longest one model wait may take on the page: a sort of the demo export, or writing or checking a cold rep. */
const MODEL_WAIT = 180_000;
/** The whole journey, model calls included. */
const JOURNEY_MS = 8 * 60_000;

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) stop("The journey asks the real model: set ANTHROPIC_API_KEY, in your shell or in .env, as the README says.");
if (known.skill !== key.skills[0]!.name) stop(`The known answers are for "${known.skill}", but card A in the answer key is "${key.skills[0]!.name}".`);

/** A difference from the answer key or the expected journey. */
class Mismatch extends Error {}
function expect(ok: boolean, what: string) {
  if (!ok) throw new Mismatch(what);
}

const A = key.skills[0]!;
/** Card A's borrows in the demo export, oldest first. */
const borrowsOfA = A.messageIds.map((id) => phrasings[Number(id.slice(1)) - 1]!).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
const today = new Date().toISOString().slice(0, 10);
// JOURNEY_URL walks a deployed app instead of starting one; its learner gets a
// fresh email, since the deployed app keeps every account.
const LIVE_URL = process.env.JOURNEY_URL?.replace(/\/$/, "");
const ADA = { name: "Ada Lovelace", email: LIVE_URL ? `ada+${Date.now()}@example.com` : "ada@example.com", password: "analytical engine" };
const SHELF = "Work";
const REPHRASING = "how do I undo the commit I just made? I haven't pushed it yet";

await mkdir(OUT, { recursive: true });
const app = LIVE_URL ? { url: LIVE_URL, stop: async () => {} } : await startApp();
let browser: Browser;
try {
  browser = await chromium.launch();
} catch (error) {
  await app.stop();
  const reason = error instanceof Error ? error.message : String(error);
  if (reason.includes("Executable doesn't exist")) stop("Playwright's Chromium isn't installed. Run bunx playwright install chromium, as the README says.");
  throw error;
}
// The answer key's months and dates are in UTC, so the page reads in UTC.
const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const consoleErrors: string[] = [];
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const text = async (selector: string, on: Page = page) => ((await on.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const nav = (name: string) => page.locator("body > nav").getByRole("link", { name, exact: true });
/** Waits for the first of a success and the page's error, and fails the step with the error's words if it shows. */
async function settles(success: string, timeout = MODEL_WAIT) {
  await page.locator(`${success}, .block .error`).first().waitFor({ timeout });
  if (await page.locator(".block .error").count()) throw new Mismatch(`the page shows an error: "${await text(".block .error")}"`);
}

/** Answers the open cold rep, and waits for its check to end, in a verdict or the page's error. */
async function answer(words: string) {
  await page.locator(".answer-box textarea").fill(words);
  await page.getByRole("button", { name: "Check my answer" }).click();
  await page.locator(".block .is-waiting", { hasText: "Checking your answer…" }).waitFor({ state: "detached", timeout: MODEL_WAIT });
  if (await page.locator(".block .error").count()) throw new Mismatch(`the page shows an error: "${await text(".block .error")}"`);
}

let shot = 0;
let currentStep = "";
const started = performance.now();
async function step(name: string, run: () => Promise<string>) {
  currentStep = name;
  const began = performance.now();
  const summary = await run();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined)).catch(() => undefined);
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`), fullPage: true });
  console.log(`ok   ${shot}. ${name}: ${summary} (${((performance.now() - began) / 1000).toFixed(1)}s)`);
}

let failed = false;
let shelfId = "";
let cardA: Card | undefined;
let apiKey = "";
let mcp: Client | undefined;
console.log(`The app is on ${app.url}; screenshots go to ${OUT}\n`);

try {
  await step("Sign up from the landing page", async () => {
    await page.goto(app.url);
    await page.locator("nav").getByRole("link", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/signup$/);
    await page.getByLabel("Name").fill(ADA.name);
    await page.getByLabel("Email").fill(ADA.email);
    await page.getByLabel("Password").fill(ADA.password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/app\/desk$/);
    await page.locator(".block h1").waitFor();
    expect((await text(".block h1")) === "Still borrowed", `signing up lands on "${await text(".block h1")}", not the Desk`);
    return "on the Desk, with no cards yet";
  });

  await step("Make a shelf", async () => {
    await nav("Shelves").click();
    await page.getByLabel("New shelf").fill(SHELF);
    await page.getByRole("button", { name: "Add shelf" }).click();
    await page.getByRole("link", { name: SHELF, exact: true }).click();
    await page.locator(".block h1", { hasText: SHELF }).waitFor();
    shelfId = new URL(page.url()).pathname.split("/").at(-1)!;
    expect((await text(".block .empty h2")) === "No cards yet", `the new shelf's page says "${await text(".block .empty h2")}"`);
    return `${SHELF}, with no cards yet`;
  });

  await step("Upload the demo export through the file input, and see it sorted", async () => {
    await page.locator(".block").getByRole("link", { name: "Upload a chat export" }).first().click();
    await page.locator(".drop-zone input[type=file]").setInputFiles(join(ROOT, "demo", "export.json"));
    const upload = page.locator(".block").getByRole("button", { name: /^Upload \d+ messages$/ });
    await upload.waitFor();
    const count = await text(".block .plate b");
    expect(count === String(phrasings.length), `the preview counts ${count} of your own messages, not ${phrasings.length}`);
    await upload.click();
    await settles(`.block .upload-done p:text-is("They're sorted into ${SHELF}'s cards.")`);
    return `${count} of your own messages, sorted into ${SHELF}'s cards`;
  });

  await step("Card A on the stack matches the answer key", async () => {
    await page.getByRole("link", { name: `Go to ${SHELF}` }).click();
    await page.locator(".block h1.skill").waitFor();
    const skill = await text(".block h1.skill");
    expect(skill === A.name, `card A is "${skill}", the key's is "${A.name}"`);
    const line = await text(".block h1.skill + p");
    expect(line === `Key A: borrowed ${A.count} times, ${A.firstMonth} to ${A.lastMonth}`, `card A's line reads "${line}"`);
    const rows = await page.locator(".block .rail > li").evaluateAll((items) => items.map((li) => ({ text: li.querySelector(".phrasing")?.textContent ?? "", date: li.querySelector(".stamp time")?.textContent ?? "" })));
    expect(rows.length === A.count, `card A holds ${rows.length} phrasings, the key's has ${A.count}`);
    expect(rows.every((row, i) => row.text === borrowsOfA[i]!.text), "card A's phrasings aren't the key's, word for word, oldest first");
    expect(rows.every((row, i) => row.date === borrowsOfA[i]!.time.slice(0, 10)), `card A's stamps (${rows.map((r) => r.date).join(", ")}) aren't the dates they were sent`);
    return `"${skill}", borrowed ${A.count} times, ${A.firstMonth} to ${A.lastMonth}, each phrasing the export's with its date`;
  });

  let firstProblem = "";
  await step("A cold rep on card A fails with the known wrong answer", async () => {
    await page.locator(".block").getByRole("link", { name: "Open key A" }).click();
    await page.locator(".block").getByRole("button", { name: "Take a cold rep" }).click();
    await settles(".block .problem");
    expect((await text(".block .lesson h2")) === "The lesson", "the first cold rep doesn't bring the lesson");
    firstProblem = await text(".block .problem");
    await answer(known.wrong);
    expect((await page.locator(".block .verdict.is-failed").count()) === 1, `the known wrong answer gets "${await text(".block .verdict h2")}"`);
    await settles(".block .problem");
    expect((await text(".block .problem")) !== firstProblem, "the next problem is the same as the first");
    expect((await text(".block .lesson h2")) === "The lesson, again", "the lesson doesn't come again after the fail");
    return `"${await text(".block .verdict h2")}", with the lesson again and a different problem`;
  });

  await step("The next passes with the known right answer, stamped returned today", async () => {
    await answer(known.right);
    expect((await page.locator(".block .verdict:not(.is-failed)").count()) === 1, `the known right answer gets "${await text(".block .verdict h2")}"`);
    const stamp = await text(".verdict .stamp");
    expect(stamp === `Stamped returned ${today}`, `the pass says "${stamp}"`);
    expect((await text(".block .plate span")) === "times borrowed, returned", `card A's plate says "${await text(".block .plate span")}"`);
    return `"${await text(".verdict h2")}", ${stamp.toLowerCase()}`;
  });

  await step("The Desk lists the return", async () => {
    await nav("Desk").click();
    await page.locator(".block .latest-returns tbody tr").first().waitFor();
    const [returned] = await page.locator(".block .latest-returns tbody tr").evaluateAll((all) => all.map((row) => [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim())));
    expect(returned?.[0] === A.name && returned[1] === SHELF && returned[2] === today, `the latest returns read ${JSON.stringify(returned)}`);
    const ledger = await page.locator(".margin .ledger > div").evaluateAll((all) => all.map((line) => `${line.querySelector("dt")?.textContent} ${line.querySelector("dd")?.textContent}`));
    expect(ledger.includes("Returned 1"), `the totals read ${ledger.join(", ")}`);
    return `${A.name} returned ${today}; ${ledger.join(", ")}`;
  });

  await step("Settings makes an API key, shown once", async () => {
    await nav("Settings").click();
    await page.getByLabel("Key name").fill("Journey");
    await page.getByRole("button", { name: "Create key" }).click();
    const shown = page.locator("table.rows tbody tr", { has: page.getByText("Journey", { exact: true }) }).locator("xpath=following-sibling::tr[1]").locator(".code-block code");
    await shown.waitFor();
    apiKey = ((await shown.textContent()) ?? "").trim();
    expect(/^ab_[0-9a-f]{16}_[0-9a-f]{32}$/.test(apiKey), "the new key isn't in the ab_<id>_<secret> form");
    return `the key ${apiKey.split("_").slice(0, 2).join("_")}_…`;
  });

  await step("The SDK lists the shelf's cards with the key", async () => {
    const cards = await createClient({ baseUrl: app.url, apiKey }).cards.list(shelfId);
    cardA = cards[0];
    expect(cardA?.skill === A.name && cardA.count === A.count && cardA.status === "returned", `the SDK lists card A as ${JSON.stringify(cardA && { skill: cardA.skill, count: cardA.count, status: cardA.status })}`);
    return `${cards.length} cards: ${cards.map((c) => `${c.skill} ${c.count} ${c.status}`).join("; ")}`;
  });

  await step("The MCP server records a repeat question, card A's count up by one, and the stack shows it borrowed again", async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(ROOT, ENTRY_IN_CLONE)], env: { [MCP_ENV.url]: app.url, [MCP_ENV.apiKey]: apiKey }, stderr: "pipe" });
    mcp = new Client({ name: "journey", version: "0.0.0" });
    await mcp.connect(transport);
    const result = await mcp.callTool({ name: "record_question", arguments: { question: REPHRASING, shelf: SHELF } });
    const data = result.structuredContent as { card: { id: string; count: number; status: string } | null } | undefined;
    const said = (result.content as { text?: string }[]).map((c) => c.text ?? "").join(" ");
    expect(result.isError !== true, `record_question failed: ${said}`);
    expect(data?.card?.id === cardA!.id && data.card.count === A.count + 1 && data.card.status === "borrowed_again", `the capture landed on ${JSON.stringify(data?.card ?? null)}, not card A with ${A.count + 1} borrows, borrowed again`);
    await page.goto(`${app.url}/app/shelves/${shelfId}`);
    await page.locator(".block h1.skill").waitFor();
    const plate = `${await text(".block .plate b")} ${await text(".block .plate span")}`;
    expect(plate === `${A.count + 1} times borrowed, borrowed again`, `card A's plate says "${plate}"`);
    return `card A borrowed ${data!.card!.count} times, ${data!.card!.status.replace("_", " ")}, as the stack shows`;
  });

  expect(consoleErrors.length === 0, `the page logged errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
  const total = performance.now() - started;
  expect(total <= JOURNEY_MS, `the journey took ${(total / 1000).toFixed(0)}s, past ${JOURNEY_MS / 1000}s`);
  console.log(`\nThe whole journey took ${(total / 1000).toFixed(0)}s.`);
} catch (error) {
  failed = true;
  const reason = error instanceof Mismatch ? error.message : error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`\nFAIL ${currentStep}: ${reason}`);
  await page.screenshot({ path: join(OUT, "failed.png"), fullPage: true }).catch(() => undefined);
} finally {
  await mcp?.close();
  await browser.close();
  await app.stop();
}

console.log(`screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
