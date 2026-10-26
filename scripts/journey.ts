// The app's whole journey (m1kuorg/basics#53), on a fresh copy of the app,
// with the real model and nothing stubbed. In a real browser at 1920×1080, a
// learner signs up from the landing page, makes a shelf, uploads the demo
// export through the upload page's file input, and sees it sorted; card A,
// opened from its shelf, matches the answer key, word for word; a cold rep
// on it fails with the known wrong answer and the next passes with the
// known right one, marking it Proven today; Home lists it among the latest
// proven; and Settings makes an API key. Then, as a script would, the SDK
// lists the shelf's cards with that key, and, as an agent would, the MCP
// server records a rephrasing of card A's question, so its count goes up by
// one and it's Asked since proven, which the shelf shows. Each step saves a
// screenshot and says how long it took; any mismatch stops the run with a
// message naming the step. It prints step names, counts, months, and dates,
// never message text, problems, answers, or reasons.
// It needs ANTHROPIC_API_KEY and Playwright's Chromium, and makes 7 model
// calls (a sort's batch and its last pass, two cold reps and their checks,
// and a capture), in under a minute.
// Run: bun run journey [screenshot dir] [--video] [--pause <ms>] [--demo-shelf]
//   --video        also records the run, at 1920×1080, to journey.webm in the
//                  screenshot dir, and says when each step began and ended in it;
//                  its screenshots show the window, not the whole page; and writes
//                  the MCP server's record_question call and its whole reply, text
//                  and structured content, to mcp-reply.json there, a file that
//                  holds message text, which the log never prints
//   --pause <ms>   waits this long on the landing page, on the shelf with card A's
//                  count loaded before opening card A, after each step, and before
//                  each submit, for a watchable pace
//   --demo-shelf   takes Home's "Try the demo shelf" instead of making Work and
//                  choosing the demo export, so the demo-data label shows
// JOURNEY_URL walks a deployed app instead; the run prints its learner's email.

import { createClient, type Card } from "@asked-before/sdk";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Browser, type Locator } from "playwright";
import { ENTRY_IN_CLONE, MCP_ENV } from "../packages/mcp/src/connect";
import { key, phrasings } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { known } from "./lib/reps";

const ROOT = join(import.meta.dir, "..");
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { video: { type: "boolean", default: false }, pause: { type: "string", default: "0" }, "demo-shelf": { type: "boolean", default: false } },
  allowPositionals: true,
});
const OUT = positionals[0] ?? join(tmpdir(), "asked-before-journey");
const PAUSE_MS = Number(values.pause);
const DEMO_SHELF = values["demo-shelf"];
const FRAME = { width: 1920, height: 1080 };
/** The longest one model wait may take on the page: a sort of the demo export, or writing or checking a cold rep. */
const MODEL_WAIT = 180_000;
/** The whole journey, model calls included. */
const JOURNEY_MS = 8 * 60_000;

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}
if (!Number.isInteger(PAUSE_MS) || PAUSE_MS < 0) stop(`--pause takes a whole number of milliseconds, not "${values.pause}".`);
if (!process.env.ANTHROPIC_API_KEY) stop("The journey asks the real model: set ANTHROPIC_API_KEY, in your shell or in .env, as the README says.");
if (known.skill !== key.skills[0]!.name) stop(`The known answers are for "${known.skill}", but card A in the answer key is "${key.skills[0]!.name}".`);

/** A difference from the answer key or the expected journey. */
class Mismatch extends Error {}
function expect(ok: boolean, what: string) {
  if (!ok) throw new Mismatch(what);
}

const A = key.skills[0]!;
/** Card A's messages in the demo export, oldest first. */
const borrowsOfA = A.messageIds.map((id) => phrasings[Number(id.slice(1)) - 1]!).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
// Dates as the page writes them, in UTC as the browser here reads them.
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const askDay = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
const today = shortDate(new Date().toISOString());
/** The cold rep's answer box, as it's labelled. */
const ANSWER_LABEL = "Your answer, in your own words, without AI";
const STATUS_WORDS = ["To prove", "Proven", "Asked since proven"];
// JOURNEY_URL walks a deployed app instead of starting one; its learner gets a
// fresh email, since the deployed app keeps every account.
const LIVE_URL = process.env.JOURNEY_URL?.replace(/\/$/, "");
const ADA = { name: "Ada Lovelace", email: LIVE_URL ? `ada+${Date.now()}@example.com` : "ada@example.com", password: "analytical engine" };
// The demo action names its shelf Demo.
const SHELF = DEMO_SHELF ? "Demo" : "Work";
const REPHRASING = "how do I undo the commit I just made? I haven't pushed it yet";

await mkdir(OUT, { recursive: true });
/** The MCP call and its reply, which a recorded run writes in the MCP step; an earlier run's is gone first. */
const MCP_REPLY = join(OUT, "mcp-reply.json");
if (values.video) await rm(MCP_REPLY, { force: true });
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
const videoDir = join(OUT, ".video");
const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC", ...(values.video ? { recordVideo: { dir: videoDir, size: FRAME } } : {}) });
const page = await context.newPage();
/** When the page opened, which is when its video starts. */
const opened = performance.now();
const sinceOpened = () => `${((performance.now() - opened) / 1000).toFixed(1)}s`;
page.setDefaultTimeout(15_000);
const consoleErrors: string[] = [];
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const main = page.getByRole("main");
const nav = (name: string | RegExp) => page.getByRole("navigation", { name: "Asked Before" }).getByRole("link", { name, exact: typeof name === "string" ? true : undefined });
/** Every error a screen shows is an alert inside its main. */
const alert = main.getByRole("alert");
/** Waits for the first of a success and an error in the page's main, and fails the step with the error's words if one shows. */
async function settles(success: Locator, timeout = 15_000) {
  await success.or(alert).first().waitFor({ timeout });
  if (await alert.count()) throw new Mismatch(`the page shows an error: "${await say(alert)}"`);
}
const h1 = (name: string) => main.getByRole("heading", { level: 1, name, exact: true });
/** The card page's cold rep panel, and a heading in it: "The lesson", "The problem", "Not yet". */
const panel = main.getByRole("region", { name: "Prove it without AI", exact: true });
const heading = (name: string) => panel.getByRole("heading", { name, exact: true });
/** The model's words under one of the panel's headings. */
const words = (name: string) => heading(name).evaluate((title) => title.nextElementSibling?.textContent ?? "");
/** The shelf's cards, most asked first. */
const cards = () => main.getByRole("list", { name: `Cards on ${SHELF}, most asked first`, exact: true });

/** Answers the open cold rep, and waits for its check to end: the verdict the check answered, or the page's error. */
async function answer(text: string): Promise<string> {
  await panel.getByLabel(ANSWER_LABEL, { exact: true }).fill(text);
  await pause();
  const checked = page.waitForResponse((response) => response.request().method() === "POST" && /^\/api\/v1\/reps\/[^/]+\/check$/.test(new URL(response.url()).pathname), { timeout: MODEL_WAIT });
  await panel.getByRole("button", { name: "Check my answer", exact: true }).click();
  const response = await checked;
  if (!response.ok()) {
    await alert.waitFor();
    throw new Mismatch(`the page shows an error: "${await say(alert)}"`);
  }
  return ((await response.json()) as { rep: { verdict: string } }).rep.verdict;
}

let pausedMs = 0;
async function pause() {
  if (!PAUSE_MS) return;
  await page.waitForTimeout(PAUSE_MS);
  pausedMs += PAUSE_MS;
}

/** How long after the page opened the fail, the Proven stamp, and the shelf's Asked since proven showed, as a recording shows them. */
const at = { fail: "", stamp: "", askedAgain: "" };
let shot = 0;
let currentStep = "";
const started = performance.now();
async function step(name: string, run: () => Promise<string>) {
  currentStep = name;
  const began = performance.now();
  const from = sinceOpened();
  const summary = await run();
  // Only finite, clock-driven animations: a spinner turns for as long as its request runs.
  await page
    .evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ).then(() => undefined),
    )
    .catch(() => undefined);
  // A full-page screenshot resizes the page for a moment, which the video would show, so a recorded run shoots the window.
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`), fullPage: !values.video });
  console.log(`ok   ${shot}. ${name}: ${summary} (${((performance.now() - began) / 1000).toFixed(1)}s${values.video ? `, from ${from} to ${sinceOpened()} in the video` : ""})`);
  await pause();
}

let failed = false;
let shelfId = "";
let cardA: Card | undefined;
let apiKey = "";
let mcp: Client | undefined;
console.log(`The app is on ${app.url}; screenshots go to ${OUT}${LIVE_URL ? `; its learner is ${ADA.email}` : ""}\n`);

try {
  await step("Sign up from the landing page", async () => {
    await page.goto(app.url);
    await pause();
    // The landing page's Sign up, in its closing question.
    await main.getByRole("link", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/signup$/);
    await page.getByLabel("Name", { exact: true }).fill(ADA.name);
    await page.getByLabel("Email", { exact: true }).fill(ADA.email);
    await page.getByLabel("Password", { exact: true }).fill(ADA.password);
    await pause();
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    // Home's h1 is a sentence built from the data, once it's here: a new account has no cards to count.
    await settles(main.getByRole("heading", { level: 1, name: /\.$/ }));
    expect((await say(main.getByRole("heading", { level: 1 }))) === "No cards yet.", `signing up lands on "${await say(main.getByRole("heading", { level: 1 }))}", not Home with no cards`);
    return "on Home, with no cards yet";
  });

  if (DEMO_SHELF) {
    await step("Try the demo shelf, and see the demo export sorted onto it", async () => {
      await main.getByRole("region", { name: "Prove next", exact: true }).getByRole("button", { name: "Try the demo shelf", exact: true }).click();
      await settles(main.getByRole("status").filter({ hasText: `They're sorted into the cards on ${SHELF}.` }), MODEL_WAIT);
      shelfId = new URL(page.url()).pathname.split("/").at(-2)!;
      const count = await say(main.getByRole("heading", { level: 2, name: /new messages?$/ }));
      expect(count === `${phrasings.length} new messages`, `the upload holds "${count}", not ${phrasings.length} new messages`);
      expect(await main.locator("header").getByText("Demo data", { exact: true }).isVisible(), "the demo shelf's upload shows no demo-data label");
      return `${count}, sorted into the cards on ${SHELF}, labeled demo data`;
    });
  } else {
    await step("Make a shelf", async () => {
      await nav("All shelves").click();
      await main.getByLabel("New shelf", { exact: true }).fill(SHELF);
      await pause();
      await main.getByRole("button", { name: "Add shelf", exact: true }).click();
      await main.getByRole("link", { name: SHELF, exact: true }).click();
      await settles(h1(SHELF));
      shelfId = new URL(page.url()).pathname.split("/").at(-1)!;
      const empty = main.locator('[data-slot="empty-title"]');
      await empty.waitFor();
      expect((await say(empty)) === "No cards yet", `the new shelf's page says "${await say(empty)}"`);
      return `${SHELF}, with no cards yet`;
    });

    await step("Upload the demo export through the file input, and see it sorted", async () => {
      await main.getByRole("link", { name: "Upload a chat export", exact: true }).click();
      await main.locator('input[type="file"]').setInputFiles(join(ROOT, "demo", "export.json"));
      const upload = main.getByRole("button", { name: /^Upload \d+ messages$/ });
      await settles(upload);
      const count = await say(main.getByRole("heading", { level: 2, name: /of your own messages$/ }));
      expect(count === `${phrasings.length} of your own messages`, `the preview counts "${count}", not ${phrasings.length} of your own messages`);
      await pause();
      await upload.click();
      await settles(main.getByRole("status").filter({ hasText: `They're sorted into the cards on ${SHELF}.` }), MODEL_WAIT);
      return `${count}, sorted into the cards on ${SHELF}`;
    });
  }

  await step("Card A, opened from its shelf, matches the answer key", async () => {
    await main.getByRole("link", { name: `Go to ${SHELF}`, exact: true }).click();
    await settles(cards());
    const top = cards().getByRole("listitem").first();
    const listed = { skill: await say(top.getByRole("link")), said: await say(top) };
    expect(listed.skill === A.name && listed.said.includes(`${A.count} times asked`), `the shelf lists "${listed.skill}" first, not card A with ${A.count} asks: "${listed.said}"`);
    // With --pause, the shelf's cards stay on screen, card A's count loaded, before card A opens.
    await pause();
    await top.getByRole("link", { name: A.name, exact: true }).click();
    await settles(h1(A.name));
    const line = await say(main.locator("header p"));
    expect(line === `Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}, in ${SHELF}${DEMO_SHELF ? " Demo data" : ""}`, `card A's line reads "${line}"`);
    const rows = await main
      .getByRole("region", { name: "Every time you asked", exact: true })
      .getByRole("listitem")
      .evaluateAll((items) =>
        items.map((li) => ({ text: li.querySelector("p")?.textContent ?? "", at: li.querySelector("time")?.getAttribute("datetime") ?? "", shown: li.querySelector("time")?.textContent ?? "", year: li.closest("ol")?.getAttribute("aria-label") ?? "" })),
      );
    const newest = [...borrowsOfA].reverse();
    expect(rows.length === A.count, `card A holds ${rows.length} messages, the key's has ${A.count}`);
    expect(rows.every((row, i) => row.text === newest[i]!.text), "card A's messages aren't the key's, word for word, newest first");
    expect(
      rows.every((row, i) => Date.parse(row.at) === Date.parse(newest[i]!.time) && row.shown === askDay(newest[i]!.time) && row.year === `Asked in ${newest[i]!.time.slice(0, 4)}`),
      `card A's dates (${rows.map((r) => `${r.year.slice(-4)} ${r.shown}`).join(", ")}) aren't the days they were sent`,
    );
    return `"${A.name}", asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}, each message the export's, word for word, with its date`;
  });

  let firstProblem = "";
  await step("A cold rep on card A fails with the known wrong answer", async () => {
    const start = panel.getByRole("button", { name: `Start a cold rep on ${A.name}`, exact: true });
    await settles(start);
    // Opening the card started nothing: no waiting line and no problem until the click.
    expect((await panel.getByRole("status").count()) + (await heading("The problem").count()) === 0, "opening card A started a cold rep");
    await pause();
    await start.click();
    await settles(heading("The problem"), MODEL_WAIT);
    expect((await heading("The lesson").count()) === 1, "the first cold rep doesn't bring the lesson");
    firstProblem = await words("The problem");
    const verdict = await answer(known.wrong);
    expect(verdict === "fail", `the known wrong answer gets "${verdict}"`);
    // "Not yet" shows as the problem goes; the next one is written at once, under the reason and the lesson again.
    await settles(heading("Not yet"));
    at.fail = sinceOpened();
    await settles(heading("The problem"), MODEL_WAIT);
    expect((await words("The problem")) !== firstProblem, "the next problem is the same as the first");
    expect((await heading("The lesson, again").count()) === 1 && (await heading("The lesson").count()) === 0, "the lesson doesn't come again after the fail");
    return `"Not yet", with the lesson again and a different problem`;
  });

  await step("The next passes with the known right answer, marked Proven today", async () => {
    const verdict = await answer(known.right);
    expect(verdict === "pass", `the known right answer gets "${verdict}"`);
    const stamp = panel.getByRole("heading", { name: `Proven ${today}`, exact: true });
    await settles(stamp);
    at.stamp = sinceOpened();
    const beside = await main.getByRole("heading", { level: 1 }).evaluate((title) => [...(title.parentElement?.querySelectorAll("span") ?? [])].map((span) => (span.textContent ?? "").trim()));
    const status = beside.find((word) => STATUS_WORDS.includes(word));
    expect(status === "Proven", `card A says "${status}"`);
    return `"Proven ${today}", and card A says ${status}`;
  });

  await step("Home lists the proven card", async () => {
    await nav(/^Home\b/).click();
    const proven = main.getByRole("list", { name: "Latest proven, latest first", exact: true });
    await settles(proven);
    const first = proven.getByRole("listitem").first();
    const listed = { skill: await say(first.getByRole("link")), line: await say(first.locator("p")) };
    expect(listed.skill === A.name && listed.line.startsWith(SHELF) && listed.line.endsWith(`proven ${today}`), `the latest proven read "${listed.skill}", "${listed.line}"`);
    const tiles = await main.locator("dl > div").evaluateAll((all) => all.map((tile) => `${tile.querySelector("dt")?.textContent} ${tile.querySelector("dd")?.textContent}`));
    expect(tiles.includes("Proven 1"), `the tiles read ${tiles.join(", ")}`);
    return `${A.name} proven ${today}; ${tiles.join(", ")}`;
  });

  await step("Settings makes an API key, shown once", async () => {
    await nav("Settings").click();
    await nav("API keys").click();
    const keys = main.getByRole("region", { name: "Your keys", exact: true });
    await keys.getByLabel("Key name", { exact: true }).fill("Journey");
    await pause();
    await keys.getByRole("button", { name: "Create key", exact: true }).click();
    const shown = keys.getByRole("figure");
    await settles(shown);
    const caption = await shown.evaluate((figure) => figure.querySelector("figcaption")?.firstElementChild?.textContent ?? "");
    expect(caption === "Journey's key", `the key is shown as "${caption}"`);
    apiKey = ((await shown.locator("code").textContent()) ?? "").trim();
    expect(/^ab_[0-9a-f]{16}_[0-9a-f]{32}$/.test(apiKey), "the new key isn't in the ab_<id>_<secret> form");
    return `the key ${apiKey.split("_").slice(0, 2).join("_")}_…`;
  });

  await step("The SDK lists the shelf's cards with the key", async () => {
    const cards = await createClient({ baseUrl: app.url, apiKey }).cards.list(shelfId);
    cardA = cards[0];
    expect(cardA?.skill === A.name && cardA.count === A.count && cardA.status === "returned", `the SDK lists card A as ${JSON.stringify(cardA && { skill: cardA.skill, count: cardA.count, status: cardA.status })}`);
    return `${cards.length} cards: ${cards.map((c) => `${c.skill} ${c.count} ${c.status}`).join("; ")}`;
  });

  await step("The MCP server records a repeat question, card A's count up by one, and the shelf shows it Asked since proven", async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(ROOT, ENTRY_IN_CLONE)], env: { [MCP_ENV.url]: app.url, [MCP_ENV.apiKey]: apiKey }, stderr: "pipe" });
    mcp = new Client({ name: "journey", version: "0.0.0" });
    await mcp.connect(transport);
    const call = { name: "record_question", arguments: { question: REPHRASING, shelf: SHELF } };
    const result = await mcp.callTool(call);
    if (values.video) await Bun.write(MCP_REPLY, `${JSON.stringify({ call, reply: result }, null, 2)}\n`);
    const data = result.structuredContent as { card: { id: string; count: number; status: string } | null } | undefined;
    const said = (result.content as { text?: string }[]).map((c) => c.text ?? "").join(" ");
    expect(result.isError !== true, `record_question failed: ${said}`);
    expect(data?.card?.id === cardA!.id && data.card.count === A.count + 1 && data.card.status === "borrowed_again", `the capture landed on ${JSON.stringify(data?.card ?? null)}, not card A with ${A.count + 1} asks, asked since proven`);
    await page.goto(`${app.url}/app/shelves/${shelfId}`);
    await settles(cards());
    const top = cards().getByRole("listitem").first();
    const row = { skill: await say(top.getByRole("link")), said: await say(top) };
    const status = await top.evaluate((item, statuses) => [...item.querySelectorAll("span")].map((span) => (span.textContent ?? "").trim()).find((word) => statuses.includes(word)) ?? "", STATUS_WORDS);
    expect(
      row.skill === A.name && row.said.includes(`${A.count + 1} times asked`) && status === "Asked since proven" && row.said.includes(`asked again ${today}`),
      `card A's row reads "${row.said}", ${status}`,
    );
    at.askedAgain = sinceOpened();
    return `card A asked ${data!.card!.count} times, ${status}, as the shelf shows`;
  });

  expect(consoleErrors.length === 0, `the page logged errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
  const total = performance.now() - started;
  expect(total <= JOURNEY_MS, `the journey took ${(total / 1000).toFixed(0)}s, past ${JOURNEY_MS / 1000}s`);
  console.log(`\nThe whole journey took ${(total / 1000).toFixed(0)}s.`);
  if (values.video || PAUSE_MS) {
    console.log(`From opening the page${pausedMs ? `, ${(pausedMs / 1000).toFixed(1)}s of pauses included` : ""}: the fail at ${at.fail}, the Proven stamp at ${at.stamp}, and the shelf's Asked since proven at ${at.askedAgain}.`);
  }
} catch (error) {
  failed = true;
  const reason = error instanceof Mismatch ? error.message : error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`\nFAIL ${currentStep}: ${reason}`);
  await page.screenshot({ path: join(OUT, "failed.png"), fullPage: true }).catch(() => undefined);
} finally {
  await mcp?.close();
  if (values.video) {
    await context.close();
    await page.video()?.saveAs(join(OUT, "journey.webm"));
    await rm(videoDir, { recursive: true, force: true });
  }
  await browser.close();
  await app.stop();
}

console.log(`screenshots${values.video ? " and journey.webm" : ""} in ${OUT}`);
process.exit(failed ? 1 : 0);
