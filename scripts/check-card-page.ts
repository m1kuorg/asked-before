// Checks the card page and its cold rep (m1kuorg/basics#46) in a real
// browser at 1920×1080, on a fresh copy of the app, each step checked again
// through the SDK. The demo export is sorted onto a demo shelf by a model
// stand-in in this script that sorts as the answer key does; rep and check
// requests go on to the real model, except where a step queues the
// stand-in's own answer to show a waiting or failure state, never in the
// app. On card A, opened from the shelf: the page shows its skill, count,
// months, every time you asked with its date, and its status without asking
// the model, and Start a cold rep starts the first rep, which brings the
// lesson and a problem; the known wrong answer fails ("Not yet"), showing
// the reason, the lesson again, and a different problem; the known right
// answer passes, and the card and the shelf show it Proven with today's
// date, and opening it again asks the model nothing. On card B, with the
// model held and refused: starting and checking a rep show their waiting
// words, then an error with a retry, which works; a reload, or Home's start
// (?rep=start), takes the open rep up again without asking the model.
// It prints
// ids, counts, and the page's words, never phrasing text, and exits 1 if
// any check fails, naming the step.
// It needs ANTHROPIC_API_KEY, and makes 4 model calls.
// Run: bun run check:card-page [screenshot dir]

import type { Card, Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator } from "playwright";
import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, startModelStub } from "./lib/model-stub";
import { known, repReply, sortsByKey, verdictReply } from "./lib/reps";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("check:card-page asks the real model for card A's reps: set ANTHROPIC_API_KEY.");
  process.exit(1);
}

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-card-page");
const FRAME = { width: 1920, height: 1080 };
const MODEL_WAIT = 60_000;
const STATUS_WORDS = ["To prove", "Proven", "Asked since proven"];

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(sortsByKey());
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
const demo: Shelf = await ada.client.shelves.create({ name: "Demo", demo: true });
await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
const [A, B] = (await ada.client.cards.list(demo.id)) as [Card, Card];

// The answer key's months and dates are in UTC, so the page reads in UTC.
const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" });
await context.addCookies(ada.cookie().split("; ").map((pair) => pair.split("=")).map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const apiCalls: string[] = [];
const consoleErrors: string[] = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.origin === app.url && ["fetch", "xhr"].includes(request.resourceType())) apiCalls.push(`${request.method()} ${url.pathname}`);
});
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  // Only finite animations: a spinner turns for as long as its request runs.
  await page
    .evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)).then(() => undefined))
    .catch(() => undefined);
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`), fullPage: true });
}

const squish = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
/** The model's words as the page sets them: fences and backticks become code, paragraphs their own blocks; compared without them or any space. */
const bare = (text: string | null | undefined) => (text ?? "").replace(/```[^\n]*\n?/g, "").replace(/`/g, "").replace(/\s+/g, "");
const same = (shown: string | null | undefined, raw: string | null | undefined) => bare(shown) === bare(raw);
const main = page.getByRole("main");
const panel = main.getByRole("region", { name: "Prove it without AI" });
const say = async (locator: Locator) => squish(await locator.first().textContent());
const count = (locator: Locator) => locator.count();

/** Waits for `success`, or fails at once with what an alert in the page's main says. */
async function settle(success: Locator, timeout?: number) {
  const alert = main.getByRole("alert");
  await success.or(alert).first().waitFor({ timeout });
  if (!(await success.count())) throw new Error(`the page says "${await say(alert)}"`);
}

const heading = (name: string | RegExp) => panel.getByRole("heading", { name, exact: typeof name === "string" ? true : undefined });
/** The model's words under one of the panel's headings: "The lesson", "The problem", "The lesson, again". */
const words = (name: string) => heading(name).evaluate((title) => title.nextElementSibling?.textContent ?? "");
/** The "Not yet" box: its heading, the day, and the check's reason. */
const notYet = () => heading("Not yet").evaluate((title) => title.parentElement?.parentElement?.textContent ?? "");
const waiting = panel.getByRole("status");
const textarea = panel.getByLabel("Your answer, in your own words, without AI", { exact: true });
const checkButton = panel.getByRole("button", { name: "Check my answer", exact: true });
const start = (card: Card) => panel.getByRole("button", { name: `Start a cold rep on ${card.skill}`, exact: true });
const retry = panel.getByRole("alert").getByRole("button", { name: "Try again", exact: true });
const locked = () => textarea.evaluate((t: HTMLTextAreaElement) => t.readOnly);
/** The focused element's tag and its words; only its tag when that's the whole page, so no phrasing is printed. */
const focused = () =>
  page.evaluate(() => {
    const now = document.activeElement;
    if (!now || now === document.body) return "body";
    return now.tagName.toLowerCase() + (now.textContent ? ` "${now.textContent}"` : "");
  });
const earlier = main.getByRole("region", { name: "Earlier cold reps" });
const earlierRows = () => earlier.locator("tbody tr").evaluateAll((rows) => rows.map((row) => [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim())));
const today = new Date().toISOString();
const isoDay = today.slice(0, 10);
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(today));
const longDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(today));
const askDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const cardAt = (card: Card) => `${app.url}/app/cards/${card.id}`;

/** The card page's h1, the status pill beside it, the line under it, and the ask strip's words. */
async function head() {
  const h1 = main.getByRole("heading", { level: 1 });
  const beside = await h1.evaluate((title) => [...(title.parentElement?.querySelectorAll("span") ?? [])].map((span) => (span.textContent ?? "").trim()));
  return {
    skill: await say(h1),
    status: beside.find((said) => STATUS_WORDS.includes(said)) ?? "",
    line: await say(main.locator("header p")),
    strip: (await main.getByRole("img").first().getAttribute("aria-label")) ?? "",
  };
}

try {
  await step("1. Open card A from the shelf: its skill, count, months, asks, and status, and no model request until Start a cold rep, which brings the lesson and a problem", async () => {
    const want = key.skills[0]!;
    const before = model.requests.length;
    await page.goto(`${app.url}/app/shelves/${demo.id}`);
    await main.getByRole("list", { name: "Cards on Demo, most asked first" }).getByRole("link", { name: want.name, exact: true }).click();
    await page.waitForURL(cardAt(A));
    await settle(main.getByRole("heading", { level: 1, name: want.name, exact: true }));
    await start(A).waitFor();
    check(model.requests.length === before && (await ada.client.cards.get(A.id)).reps.length === 0, `opening it asks the model nothing (${model.requests.length - before} requests) and starts no rep`);
    check(
      (await count(waiting)) === 0 && (await count(heading(/^The (problem|lesson)/))) === 0 && (await focused()) === `h1 "${want.name}"`,
      `no waiting line, problem, or lesson, and ${await focused()} has focus`,
    );
    const top = await head();
    check(top.skill === want.name && top.status === "To prove", `headed "${top.skill}", ${top.status}`);
    check(top.line === `Asked ${want.count} times, ${want.firstMonth} to ${want.lastMonth}, in Demo Demo data`, `its line: "${top.line}"`);
    check(top.strip === `Asked ${want.count} times, ${want.firstMonth} to ${want.lastMonth}`, `its strip: "${top.strip}"`);
    const shelfLink = main.locator("header p").getByRole("link", { name: "Demo", exact: true });
    check((await shelfLink.getAttribute("href")) === `/app/shelves/${demo.id}` && (await main.locator("header p").getByText("Demo data", { exact: true }).isVisible()), "it names the shelf, labeled as demo data");
    const rows = await main
      .getByRole("region", { name: "Every time you asked" })
      .getByRole("listitem")
      .evaluateAll((items) => items.map((item) => ({ text: item.querySelector("p")?.textContent ?? "", date: item.querySelector("time")?.textContent ?? "", list: item.closest("ol")?.getAttribute("aria-label") ?? "" })));
    const asks = [...(await ada.client.cards.get(A.id)).borrows].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    check(
      rows.length === want.count && rows.every((r, i) => r.text === asks[i]?.text && r.date === askDay.format(new Date(asks[i]!.time)) && r.list === `Asked in ${asks[i]!.time.slice(0, 4)}`),
      `every time you asked, ${rows.length}, word for word, newest first, each with its day under its year (${rows.map((r) => r.date).join(", ")})`,
    );
    check((await say(earlier.locator("p"))).startsWith("None yet.") && (await count(earlier.getByRole("table"))) === 0, "no earlier cold reps yet");

    await start(A).click();
    check((await say(waiting)) === "Writing the lesson and pulling a problem…" && (await count(start(A))) === 0, `while the first rep is written: "${await say(waiting)}"`);
    await settle(heading("The problem"), MODEL_WAIT);
    const card = await ada.client.cards.get(A.id);
    check(card.reps.length === 1 && same(await words("The problem"), card.reps[0]!.problem), "the problem is the card's first rep's");
    check(same(await words("The lesson"), card.lesson), "the lesson comes with it, as the card keeps it");
    check((await count(heading("Not yet"))) === 0 && (await textarea.inputValue()) === "" && (await focused()) === "textarea", "an empty answer box, focused, and no verdict");
  });

  let firstProblem = "";
  await step("2. The known wrong answer fails: the reason, the lesson again, and a different problem", async () => {
    firstProblem = (await ada.client.cards.get(A.id)).reps[0]!.problem;
    await textarea.fill(known.wrong);
    await checkButton.click();
    await waiting.filter({ hasText: "Checking your answer…" }).waitFor();
    check((await locked()) && (await checkButton.isDisabled()), "while it's checked, the answer is locked");
    await settle(heading("Not yet"), MODEL_WAIT);
    await settle(heading("The problem"), MODEL_WAIT);
    const card = await ada.client.cards.get(A.id);
    const [failed, next] = card.reps;
    check(failed?.verdict === "fail" && bare(await notYet()).includes(bare(failed.reason)), `"Not yet", with the check's reason: ${failed?.reason}`);
    check(same(await words("The lesson, again"), card.lesson) && (await count(heading("The lesson"))) === 0, "the lesson again");
    check(next !== undefined && next.problem !== firstProblem && same(await words("The problem"), next.problem), "a different problem, the card's second rep's");
    check((await textarea.inputValue()) === "" && !(await locked()), "the answer box is empty and open again");
    check((await head()).status === "To prove" && card.status === "borrowed", `the card stays ${(await head()).status} (${card.status})`);
    const rows = await earlierRows();
    check(rows.length === 1 && rows[0]?.[0] === isoDay && rows[0]?.[2] === "Not yet" && bare(rows[0]?.[1]).startsWith(bare(firstProblem.split("\n")[0])), `its earlier cold reps: ${rows.map((r) => `${r[0]} ${r[2]}`).join("; ")}`);
  });

  await step("3. The known right answer passes, and the card shows it Proven today", async () => {
    await textarea.fill(known.right);
    await checkButton.click();
    const stamp = heading(`Proven ${shortDay}`);
    await settle(stamp, MODEL_WAIT);
    const card = await ada.client.cards.get(A.id);
    const passed = card.reps[1]!;
    check(passed.verdict === "pass" && card.status === "returned" && card.returnedAt?.slice(0, 10) === isoDay, `the API has card A ${card.status}, stamped ${card.returnedAt}`);
    const reason = await stamp.evaluate((title) => title.nextElementSibling?.textContent ?? "");
    check(same(reason, passed.reason), `stamped "Proven ${shortDay}", with the reason: ${passed.reason}`);
    const top = await head();
    check(top.status === "Proven" && top.strip.endsWith(`, proven ${longDay}`), `the card says ${top.status}, its strip "${top.strip}"`);
    check((await count(textarea)) === 0 && (await count(checkButton)) === 0 && (await focused()) === `h3 "Proven ${shortDay}"`, `the answer box is gone, and ${await focused()} has focus`);
    const next = panel.getByRole("link", { name: /^Next: / });
    check((await say(next)) === `Next: ${B.skill}` && (await next.getAttribute("href")) === `/app/cards/${B.id}?rep=start`, `next, "${await say(next)}", starts a rep on it (${await next.getAttribute("href")})`);
    check(
      (await panel.getByRole("link", { name: "Back to Home", exact: true }).getAttribute("href")) === "/app/desk" &&
        (await panel.getByRole("link", { name: "Back to Demo", exact: true }).getAttribute("href")) === `/app/shelves/${demo.id}`,
      "and the way back to Home or to the shelf",
    );
    const rows = await earlierRows();
    check(rows.map((r) => r[2]).join(", ") === "Passed, Not yet" && rows[0]?.[0] === isoDay, `its earlier cold reps, newest first: ${rows.map((r) => `${r[0]} ${r[2]}`).join("; ")}`);
  });

  await step("4. Back on the shelf, card A shows Proven with today's date", async () => {
    await panel.getByRole("link", { name: "Back to Demo", exact: true }).click();
    await page.waitForURL(`${app.url}/app/shelves/${demo.id}`);
    const list = main.getByRole("list", { name: "Cards on Demo, most asked first" });
    await settle(list);
    const row = await list
      .getByRole("listitem")
      .first()
      .evaluate((item, words) => ({
        skill: item.querySelector("a")?.textContent ?? "",
        status: [...item.querySelectorAll("span")].map((span) => (span.textContent ?? "").trim()).find((said) => words.includes(said)) ?? "",
        strip: item.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "",
      }), STATUS_WORDS);
    check(row.skill === A.skill && row.status === "Proven" && row.strip.endsWith(`, proven ${longDay}`), `card A's row: ${row.status}, its strip "${row.strip}"`);
    const listed = (await ada.client.cards.list(demo.id))[0]!;
    check(listed.status === "returned", `the API lists card A ${listed.status}`);
  });

  await step("5. Opened again, Proven card A asks the model nothing, and offers a cold rep", async () => {
    const before = model.requests.length;
    await page.goto(cardAt(A));
    await start(A).waitFor();
    check(model.requests.length === before && (await ada.client.cards.get(A.id)).reps.length === 2, `${model.requests.length - before} model requests, and still 2 reps`);
    const stamp = await say(panel.locator("p").filter({ hasText: /^Proven / }));
    check((await head()).status === "Proven" && stamp === `Proven ${shortDay}`, `it says ${(await head()).status}, stamped "${stamp}"`);
    check((await count(waiting)) + (await count(heading(/^(The problem|Not yet)$/))) === 0, "with no rep started");
  });

  await step("6. With the model held, then refused: starting a rep waits in its own words, then shows the error and a retry", async () => {
    const held = hold();
    model.queue(held.answer);
    await page.goto(cardAt(B));
    await start(B).click();
    await held.reached;
    await waiting.waitFor();
    check((await say(waiting)) === "Writing the lesson and pulling a problem…", `waiting: "${await say(waiting)}"`);
    check((await head()).line.startsWith(`Asked ${B.count} times,`) && (await count(heading(/^The (problem|lesson)/))) === 0, "the count holds, and no lesson or problem shows before it arrives");
    held.release(refuse());
    await panel.getByRole("alert").waitFor();
    const said = await say(panel.getByRole("alert").locator('[data-slot="alert-description"]'));
    check(said === "The model request failed (400)." && (await focused()) === 'button "Try again"', `the error "${said}", and ${await focused()} has focus`);
    check((await count(heading(/^The (problem|lesson)/))) === 0 && (await ada.client.cards.get(B.id)).reps.length === 0, "nothing that didn't arrive shows, and the card has no rep");
    model.queue(repReply("You committed to the wrong branch on your laptop and want the work on a new branch instead. What would you type?", "Card B's lesson, from the stand-in."));
    await retry.click();
    await settle(heading("The problem"));
    check((await words("The lesson")) === "Card B's lesson, from the stand-in." && (await words("The problem")).startsWith("You committed to the wrong branch"), "the retry brings the lesson and the problem");
  });

  await step("7. A reload, or Home's start, takes the open rep up again, without asking the model", async () => {
    const before = model.requests.length;
    await page.reload();
    await settle(heading("The problem"));
    check((await count(start(B))) === 0, "no Start a cold rep while a rep is open");
    check((await words("The problem")).startsWith("You committed to the wrong branch") && (await words("The lesson")) === "Card B's lesson, from the stand-in.", "the same problem and lesson");
    check(model.requests.length === before && (await ada.client.cards.get(B.id)).reps.length === 1, `no model request (${model.requests.length - before}), and still one rep`);
    await page.goto(`${cardAt(B)}?rep=start`);
    await settle(heading("The problem"));
    check((await words("The problem")).startsWith("You committed to the wrong branch") && page.url() === cardAt(B), `Home's start (?rep=start) shows the open rep's problem, and the address drops it (${new URL(page.url()).search || "no query"})`);
    check(model.requests.length === before && (await ada.client.cards.get(B.id)).reps.length === 1, `it starts no second rep: ${model.requests.length - before} model requests, still one rep`);
  });

  await step("8. Checking waits with the answer locked; a failed check, and a failed next rep, each show the error and a retry", async () => {
    const answer = "git commit --amend, then push";
    await textarea.fill(answer);
    const checking = hold();
    model.queue(checking.answer);
    await checkButton.click();
    await checking.reached;
    await waiting.waitFor();
    check((await say(waiting)) === "Checking your answer…" && (await locked()), `waiting: "${await say(waiting)}", the answer locked`);
    checking.release(refuse());
    await panel.getByRole("alert").waitFor();
    const said = await say(panel.getByRole("alert").locator('[data-slot="alert-description"]'));
    check(said === "The model request failed (400)." && (await count(heading("Not yet"))) === 0 && (await focused()) === 'button "Try again"', `the error "${said}", no verdict, and ${await focused()} has focus`);
    check(!(await locked()) && (await textarea.inputValue()) === answer, "the answer is open again and holds what was sent, so the retry checks what's on screen");
    const next = hold();
    model.queue(verdictReply("fail", "You amend the commit, which keeps it on the wrong branch."), next.answer);
    await retry.click();
    await next.reached;
    await waiting.filter({ hasText: "Pulling a fresh problem…" }).waitFor();
    check(
      bare(await notYet()).includes(bare("You amend the commit, which keeps it on the wrong branch.")) && (await words("The lesson, again")) === "Card B's lesson, from the stand-in.",
      "the reason and the lesson again stay above while the next problem is written",
    );
    next.release(refuse());
    await panel.getByRole("alert").waitFor();
    check((await count(heading(/^(Not yet|The lesson, again)$/))) === 2 && (await count(heading("The problem"))) === 0, "the error and a retry show under the reason and the lesson, with no problem");
    model.queue(repReply("Your last commit on your own branch has the wrong message and you haven't pushed. What would you type?"));
    await retry.click();
    await settle(heading("The problem"));
    check((await words("The problem")).startsWith("Your last commit on your own branch"), "the retry brings the next problem");
    const reps = (await ada.client.cards.get(B.id)).reps;
    check(reps.length === 2 && reps[0]?.verdict === "fail" && reps[0].answer === answer, `the API has ${reps.length} reps on card B, the first failed with the answer on screen`);
  });

  await step("9. The page reached the server only through /api/v1, within its security policy", async () => {
    const outside = apiCalls.filter((call) => !call.split(" ")[1]!.startsWith("/api/v1/"));
    check(apiCalls.length > 0 && outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
