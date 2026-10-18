// Checks the card page and its cold rep (m1kuorg/basics#46) in a real
// browser at 1920×1080, on a fresh copy of the app, each step checked again
// through the SDK. The demo export is sorted into a demo project by a model
// stand-in in this script that sorts as the answer key does; rep and check
// requests go on to the real model, except where a step queues the
// stand-in's own answer to show a waiting or failure state, never in the
// app. On card A, opened from the stack: the page shows its skill, count,
// months, phrasings with stamps, and status without asking the model, and
// Take a cold rep starts the first rep, which brings the lesson and a
// problem; the known wrong answer fails, showing the reason, the lesson
// again, and a different problem; the known right answer passes, and the
// card and the stack show it returned with today's date, and opening it
// again asks the model nothing. On card B, with the model held and
// refused: starting and checking a rep show the library's waiting words,
// then an error with a retry, which works; a reload, or the dashboard's
// start (?rep=start), takes the open rep up again without asking the model.
// It prints
// ids, counts, and the page's words, never phrasing text, and exits 1 if
// any check fails, naming the step.
// It needs ANTHROPIC_API_KEY, and makes 4 model calls.
// Run: bun run check:card-page [screenshot dir]

import type { Card, Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
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
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined)).catch(() => undefined);
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`), fullPage: true });
}

const text = async (selector: string) => ((await page.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const count = (selector: string) => page.locator(selector).count();
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").replace(/\s+/g, " ").trim() === (b ?? "").replace(/\s+/g, " ").trim();
/** A section's words without its heading. */
const body = async (selector: string) => (await page.locator(`${selector} p`).allTextContents()).join(" ");
const textarea = () => page.locator(".answer-box textarea");
const take = () => page.getByRole("button", { name: "Take a cold rep" });
const locked = () => textarea().evaluate((t: HTMLTextAreaElement) => t.readOnly);
const focused = () => page.evaluate(() => document.activeElement?.tagName.toLowerCase() + (document.activeElement?.textContent ? ` "${document.activeElement.textContent}"` : ""));
const earlierRows = () => page.locator(".earlier-reps tbody tr").evaluateAll((rows) => rows.map((row) => [...row.querySelectorAll("td")].map((td) => td.textContent ?? "")));
const today = new Date().toISOString().slice(0, 10);
const cardAt = (card: Card) => `${app.url}/app/cards/${card.id}`;

try {
  await step("1. Open key A from the stack: its skill, count, months, phrasings, and status, and no model request until Take a cold rep, which brings the lesson and a problem", async () => {
    const want = key.skills[0]!;
    const before = model.requests.length;
    await page.goto(`${app.url}/app/projects/${demo.id}`);
    await page.locator(".block").getByRole("link", { name: "Open key A" }).click();
    await page.waitForURL(cardAt(A));
    await page.locator(".block h1.skill").waitFor();
    await take().waitFor();
    check(model.requests.length === before && (await ada.client.cards.get(A.id)).reps.length === 0, `opening it asks the model nothing (${model.requests.length - before} requests) and starts no rep`);
    check((await count(".block .is-waiting, .block .problem, .block .lesson")) === 0 && (await focused()) === 'button "Take a cold rep"', `no waiting line, problem, or lesson, and ${await focused()} has focus`);
    check((await text(".block h1.skill")) === want.name && (await text(".block .plate b")) === String(want.count) && (await text(".block .plate span")) === "times borrowed, not returned", `headed "${await text(".block h1.skill")}", its plate ${await text(".block .plate b")} ${await text(".block .plate span")}`);
    const notes = await page.locator(".margin p").allTextContents();
    check(notes.includes(`Borrowed ${want.count} times, ${want.firstMonth} to ${want.lastMonth}.`) && notes.includes("Not returned yet."), `the margin: ${notes.slice(1, 4).map((n) => `"${n}"`).join(", ")}`);
    check((await text(".margin .project-name a")) === "Demo" && (await page.locator(".margin .project-name .demo-label").isVisible()), "the margin names the project, labeled as demo data");
    const rows = await page.locator(".block .rail > li").evaluateAll((items) => items.map((li) => ({ text: li.querySelector(".phrasing")?.textContent ?? "", date: li.querySelector(".stamp time")?.textContent ?? "" })));
    const borrows = (await ada.client.cards.get(A.id)).borrows;
    check(rows.length === want.count && rows.every((r, i) => r.text === borrows[i]?.text && r.date === borrows[i]?.time.slice(0, 10)), `its ${rows.length} phrasings word for word, oldest first, each with its stamp (${rows.map((r) => r.date).join(", ")})`);

    await take().click();
    check((await text(".block .is-waiting")) === "Writing the lesson and pulling a problem…" && (await take().count()) === 0, `while the first rep is written: "${await text(".block .is-waiting")}"`);
    await page.locator(".block .problem").waitFor({ timeout: MODEL_WAIT });
    const card = await ada.client.cards.get(A.id);
    check(card.reps.length === 1 && same(await body(".block .problem"), card.reps[0]!.problem), "the problem is the card's first rep's");
    check((await text(".block .lesson h2")) === "The lesson" && same(await body(".block .lesson"), card.lesson), "the lesson comes with it, as the card keeps it");
    check((await count(".block .verdict")) === 0 && (await textarea().inputValue()) === "" && (await focused()) === "textarea", "an empty answer box, focused, and no verdict");
    check((await count(".earlier-reps")) === 0, "no earlier cold reps yet");
  });

  let firstProblem = "";
  await step("2. The known wrong answer fails: the reason, the lesson again, and a different problem", async () => {
    firstProblem = (await ada.client.cards.get(A.id)).reps[0]!.problem;
    await textarea().fill(known.wrong);
    await page.getByRole("button", { name: "Check my answer" }).click();
    await page.locator(".block .is-waiting", { hasText: "Checking your answer…" }).waitFor();
    check((await locked()) && (await page.getByRole("button", { name: "Check my answer" }).isDisabled()), "while it's checked, the answer is locked");
    await page.locator(".block .verdict.is-failed").waitFor({ timeout: MODEL_WAIT });
    await page.locator(".block .problem").waitFor({ timeout: MODEL_WAIT });
    const card = await ada.client.cards.get(A.id);
    const [failed, next] = card.reps;
    check(failed?.verdict === "fail" && (await text(".verdict.is-failed h2")) === "Still borrowed" && same(await body(".verdict.is-failed"), failed.reason), `"Still borrowed", with the check's reason: ${failed?.reason}`);
    check((await text(".block .lesson h2")) === "The lesson, again" && same(await body(".block .lesson"), card.lesson), "the lesson again");
    check(next !== undefined && next.problem !== firstProblem && same(await body(".block .problem"), next.problem), "a different problem, the card's second rep's");
    check((await textarea().inputValue()) === "" && !(await locked()), "the answer box is empty and open again");
    check((await text(".block .plate span")) === "times borrowed, not returned" && card.status === "borrowed", `the card stays ${card.status}`);
    const earlier = await earlierRows();
    check(earlier.length === 1 && earlier[0]?.[2] === "Still borrowed" && same(earlier[0]?.[1], firstProblem), `its earlier cold reps: ${earlier.map((r) => `${r[0]} ${r[2]}`).join("; ")}`);
  });

  await step("3. The known right answer passes, and the card shows it returned today", async () => {
    await textarea().fill(known.right);
    await page.getByRole("button", { name: "Check my answer" }).click();
    await page.locator(".block .verdict:not(.is-failed)").waitFor({ timeout: MODEL_WAIT });
    const card = await ada.client.cards.get(A.id);
    const passed = card.reps[1]!;
    check(passed.verdict === "pass" && card.status === "returned" && card.returnedAt?.slice(0, 10) === today, `the API has card A ${card.status}, stamped ${card.returnedAt}`);
    check((await text(".verdict:not(.is-failed) h2")) === "Returned" && (await body(".verdict:not(.is-failed)")).includes(passed.reason!), `"Returned", with the reason: ${passed.reason}`);
    check((await text(".verdict .stamp")) === `Stamped returned ${today}`, `"${await text(".verdict .stamp")}"`);
    check((await text(".block .plate span")) === "times borrowed, returned", `the plate: ${await text(".block .plate span")}`);
    check((await page.locator(".margin p").allTextContents()).includes(`Returned ${today}.`), `the margin: "Returned ${today}."`);
    check((await text(".block .end-rule")) === `Returned ${today}`, `the rail closes with "${await text(".block .end-rule")}"`);
    check((await locked()) && (await count(".answer-box button")) === 0 && (await focused()) === 'button "Back to the stack"', `the answer stays locked, and ${await focused()} has focus`);
    const earlier = await earlierRows();
    check(earlier.map((r) => r[2]).join(", ") === "Returned, Still borrowed" && earlier[0]?.[0] === today, `its earlier cold reps, newest first: ${earlier.map((r) => `${r[0]} ${r[2]}`).join("; ")}`);
  });

  await step("4. Back on the stack, card A shows returned with today's date", async () => {
    await page.getByRole("button", { name: "Back to the stack" }).click();
    await page.waitForURL(`${app.url}/app/projects/${demo.id}?card=${A.id}`);
    await page.locator(".block .end-rule").waitFor();
    const struck = await page.locator(".margin .margin-key").first().evaluate((k) => k.classList.contains("is-returned") && getComputedStyle(k).textDecorationLine.includes("line-through"));
    check(struck, "key A is struck through");
    check((await text(".block .end-rule")) === `Returned ${today}` && (await text(".block .plate span")) === "times borrowed, returned", `card A's rail closes with "${await text(".block .end-rule")}", its plate "${await text(".block .plate span")}"`);
    const listed = (await ada.client.cards.list(demo.id))[0]!;
    check(listed.status === "returned", `the API lists card A ${listed.status}`);
  });

  await step("5. Opened again, returned card A asks the model nothing, and offers a cold rep", async () => {
    const before = model.requests.length;
    await page.goto(cardAt(A));
    await take().waitFor();
    check(model.requests.length === before && (await ada.client.cards.get(A.id)).reps.length === 2, `${model.requests.length - before} model requests, and still 2 reps`);
    check((await text(".block .plate span")) === "times borrowed, returned" && (await count(".block .is-waiting, .block .problem, .block .verdict")) === 0, `its plate says "${await text(".block .plate span")}", with no rep started`);
  });

  await step("6. With the model held, then refused: starting a rep waits in the library's words, then shows the error and a retry", async () => {
    const held = hold();
    model.queue(held.answer);
    await page.goto(cardAt(B));
    await take().click();
    await held.reached;
    await page.locator(".block .is-waiting").waitFor();
    check((await text(".block .is-waiting")) === "Writing the lesson and pulling a problem…", `waiting: "${await text(".block .is-waiting")}"`);
    check((await text(".block .plate b")) === String(B.count) && (await count(".block .problem, .block .lesson")) === 0, "the plate holds, and no lesson or problem shows before it arrives");
    held.release(refuse());
    await page.locator(".block .error").waitFor();
    check((await text(".block .error")) === "The model request failed (400)." && (await focused()) === 'button "Try again"', `the error "${await text(".block .error")}", and ${await focused()} has focus`);
    check((await count(".block .problem, .block .lesson")) === 0 && (await ada.client.cards.get(B.id)).reps.length === 0, "nothing that didn't arrive shows, and the card has no rep");
    model.queue(repReply("You committed to the wrong branch on your laptop and want the work on a new branch instead. What would you type?", "Card B's lesson, from the stand-in."));
    await page.getByRole("button", { name: "Try again" }).click();
    await page.locator(".block .problem").waitFor();
    check((await body(".block .lesson")) === "Card B's lesson, from the stand-in." && (await body(".block .problem")).startsWith("You committed to the wrong branch"), "the retry brings the lesson and the problem");
  });

  await step("7. A reload, or the dashboard's start, takes the open rep up again, without asking the model", async () => {
    const before = model.requests.length;
    await page.reload();
    await page.locator(".block .problem").waitFor();
    check((await take().count()) === 0, "no Take a cold rep while a rep is open");
    check((await body(".block .problem")).startsWith("You committed to the wrong branch") && (await body(".block .lesson")) === "Card B's lesson, from the stand-in.", "the same problem and lesson");
    check(model.requests.length === before && (await ada.client.cards.get(B.id)).reps.length === 1, `no model request (${model.requests.length - before}), and still one rep`);
    await page.goto(`${cardAt(B)}?rep=start`);
    await page.locator(".block .problem").waitFor();
    check((await body(".block .problem")).startsWith("You committed to the wrong branch") && page.url() === cardAt(B), `the dashboard's start (?rep=start) shows the open rep's problem, and the address drops it (${new URL(page.url()).search || "no query"})`);
    check(model.requests.length === before && (await ada.client.cards.get(B.id)).reps.length === 1, `it starts no second rep: ${model.requests.length - before} model requests, still one rep`);
  });

  await step("8. Checking waits with the answer locked; a failed check, and a failed next rep, each show the error and a retry", async () => {
    const answer = "git commit --amend, then push";
    await textarea().fill(answer);
    const checking = hold();
    model.queue(checking.answer);
    await page.getByRole("button", { name: "Check my answer" }).click();
    await checking.reached;
    await page.locator(".block .is-waiting").waitFor();
    check((await text(".block .is-waiting")) === "Checking your answer…" && (await locked()), `waiting: "${await text(".block .is-waiting")}", the answer locked`);
    checking.release(refuse());
    await page.locator(".block .error").waitFor();
    check((await text(".block .error")) === "The model request failed (400)." && (await count(".block .verdict")) === 0, `the error "${await text(".block .error")}", and no verdict`);
    check((await locked()) && (await textarea().inputValue()) === answer, "the answer stays locked, so the retry checks what's on screen");
    const next = hold();
    model.queue(verdictReply("fail", "You amend the commit, which keeps it on the wrong branch."), next.answer);
    await page.getByRole("button", { name: "Try again" }).click();
    await next.reached;
    await page.locator(".block .is-waiting", { hasText: "Pulling a fresh problem…" }).waitFor();
    check((await body(".verdict.is-failed")) === "You amend the commit, which keeps it on the wrong branch." && (await text(".block .lesson h2")) === "The lesson, again", "the reason and the lesson again stay above while the next problem is written");
    next.release(refuse());
    await page.locator(".block .error").waitFor();
    check((await count(".block .verdict.is-failed, .block .lesson")) === 2 && (await count(".block .problem")) === 0, "the error and a retry show under the reason and the lesson, with no problem");
    model.queue(repReply("Your last commit on your own branch has the wrong message and you haven't pushed. What would you type?"));
    await page.getByRole("button", { name: "Try again" }).click();
    await page.locator(".block .problem").waitFor();
    check((await body(".block .problem")).startsWith("Your last commit on your own branch"), "the retry brings the next problem");
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
