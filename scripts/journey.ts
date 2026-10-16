// The whole journey on the demo export, in a real browser, with nothing
// stubbed. It starts its own copy of the app, loads the demo export, checks
// card A against the answer key, opens it, submits the known wrong answer and
// expects a fail and a second problem, then the known right answer and expects
// the returned stamp, then goes back to the stack. It saves a 1920×1080
// screenshot at each step and reports how long after opening the page the
// fail, the returned stamp, and the stack came, pauses included, as a
// recording would show them. Any mismatch fails the run with a message naming
// the step.
// It prints step names, counts, months, and dates, never message text,
// problems, answers, or reasons.
// Run: bun run journey [screenshot dir] [--video] [--pause <ms>]
//   --video        also records the run, at 1920×1080, to journey.webm in the screenshot dir
//   --pause <ms>   waits this long after each step and before each submit, for a watchable pace
// PORT picks the app's port; without it, the app takes a free one.

import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Browser, type Page } from "playwright";
import { parseExport } from "../src/parser";

const runStarted = performance.now();
const ROOT = join(import.meta.dir, "..");
const FRAME = { width: 1920, height: 1080 };
/** The fail and the pass come inside the first minute, and the whole journey in three (spec.md, For the recording). */
const FIRST_MINUTE_MS = 60_000;
const JOURNEY_MS = 3 * 60_000;
/** The longest one step may wait on the page, model calls included, before it fails. */
const WAIT_MS = 60_000;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { video: { type: "boolean", default: false }, pause: { type: "string", default: "0" } },
  allowPositionals: true,
});
const OUT = positionals[0] ?? join(tmpdir(), "asked-before-journey");
const PAUSE_MS = Number(values.pause);
if (!Number.isInteger(PAUSE_MS) || PAUSE_MS < 0) stop(`--pause takes a whole number of milliseconds, not "${values.pause}".`);
if (!process.env.ANTHROPIC_API_KEY) stop("There's no ANTHROPIC_API_KEY. Set it in .env, as the README says.");

// The expected journey, from the demo data. The answer key and the known answers are never served.

type AnswerKey = {
  skills: { name: string; count: number; firstMonth: string; lastMonth: string; messageIds: string[] }[];
  oneOffs: string[];
};
const read = (path: string) => Bun.file(join(ROOT, path)).text();
const answerKey: AnswerKey = JSON.parse(await read("demo/answer-key.json"));
const known: { skill: string; wrong: string; right: string } = JSON.parse(await read("demo/known-answers.json"));
const cardA = answerKey.skills[0]!;
if (known.skill !== cardA.name) stop(`The known answers are for "${known.skill}", but card A in the answer key is "${cardA.name}".`);
const ownMessages = answerKey.skills.reduce((sum, skill) => sum + skill.messageIds.length, 0) + answerKey.oneOffs.length;
const textById = new Map(parseExport(await read("demo/export.json")).map((message) => [message.id, message.text]));
const cardATexts = cardA.messageIds.map((id) => textById.get(id));

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2025-03-14" -> "March 2025" */
const monthOf = (date: string) => monthYear.format(new Date(`${date}T00:00:00Z`));
const sameList = (a: unknown[], b: unknown[]) => JSON.stringify(a) === JSON.stringify(b);

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

/** A difference from the answer key or the expected journey. Its message is printed as is. */
class Mismatch extends Error {}
function expect(ok: boolean, what: string) {
  if (!ok) throw new Mismatch(what);
}

// The app, started from this checkout so it reads this checkout's .env.

const app = Bun.spawn(["bun", "server.ts"], {
  cwd: ROOT,
  env: { ...process.env, PORT: process.env.PORT ?? "0" },
  stdout: "pipe",
  stderr: "pipe",
});
let appLog = "";
for (const stream of [app.stdout, app.stderr]) {
  void (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) appLog += decoder.decode(chunk, { stream: true });
  })();
}
process.on("exit", () => app.kill());
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));
let base: string | undefined;
for (const started = Date.now(); !(base = appLog.match(/Asked Before is on (\S+)/)?.[1]); await Bun.sleep(50)) {
  if (app.exitCode !== null || Date.now() - started > 10_000) {
    stop(`The app didn't start${process.env.PORT ? ` on port ${process.env.PORT}; is something else on it?` : "."}\n${appLog}`);
  }
}

await mkdir(OUT, { recursive: true });
const videoDir = join(OUT, ".video");
let browser: Browser;
try {
  browser = await chromium.launch();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  if (reason.includes("Executable doesn't exist")) stop("Playwright's Chromium isn't installed. Run bunx playwright install chromium, as the README says.");
  throw error;
}
const context = await browser.newContext({
  viewport: FRAME,
  ...(values.video ? { recordVideo: { dir: videoDir, size: FRAME } } : {}),
});
const page = await context.newPage();
page.setDefaultTimeout(WAIT_MS);

let groupRequests = 0;
page.on("request", (request) => {
  if (request.method() === "POST" && new URL(request.url()).pathname === "/api/group") groupRequests++;
});

const textAt = async (selector: string) => ((await page.locator(selector).first().textContent()) ?? "").trim();
const textsAt = async (selector: string) => (await page.locator(selector).allTextContents()).map((text) => text.trim());
const count = (selector: string) => page.locator(selector).count();
/** Waits for the first of several outcomes to show. */
const settle = (...selectors: string[]) => page.locator(selectors.join(", ")).first().waitFor();
/** The error a screen shows in place of a result, if any. */
const shownError = async () => ((await count(".error")) ? textAt(".error") : undefined);
/** Lets the rail's key drop finish, so a screenshot shows every key seated. It waits 5s at most. */
const seated = () =>
  page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null))),
      new Promise((done) => setTimeout(done, 5000)),
    ]).then(() => undefined),
  );

let pausedMs = 0;
async function pause() {
  if (!PAUSE_MS) return;
  await page.waitForTimeout(PAUSE_MS);
  pausedMs += PAUSE_MS;
}

let shot = 0;
let currentStep = "";
/** Runs one step, then checks the frame, saves its screenshot, and reports it. */
async function step(name: string, run: () => Promise<string>) {
  currentStep = name;
  const started = performance.now();
  const summary = await run();
  expect(await page.locator(".demo-label").isVisible(), "the demo-data label isn't on screen");
  expect(!(await page.locator("body").innerText()).includes("ChatGPT"), 'the page says "ChatGPT"');
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`), fullPage: true });
  console.log(`ok   ${shot}. ${name}: ${summary} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
  await pause();
}

/** Types an answer into the open answer box and submits it. */
async function submit(answer: string) {
  const box = page.locator(".answer-box textarea:not([readonly])");
  await box.fill(answer);
  await pause();
  await page.getByRole("button", { name: "Check my answer" }).click();
}

let failed = false;
let today = "";
/** When the page opened, and how long after it the fail, the returned stamp, and the stack again came. */
let opened = 0;
const at = { fail: 0, stamp: 0, stack: 0 };
console.log(`The app is on ${base}; screenshots go to ${OUT}\n`);

try {
  opened = performance.now();
  await step("The demo export", async () => {
    await page.goto(base!);
    await page.locator(".plate b").waitFor();
    const shown = Number(await textAt(".plate b"));
    expect(shown === ownMessages, `the load screen counts ${shown} of your own messages; the answer key has ${ownMessages}`);
    return `${shown} of your own messages`;
  });

  await step("The stack", async () => {
    await page.getByRole("button", { name: "Load the demo export" }).click();
    await settle(".margin-key", ".block .error");
    const error = await shownError();
    expect(error === undefined, `the stack shows an error instead of cards: ${error}`);

    const counts = (await textsAt(".margin-key span:last-child")).map(Number);
    const keyCounts = answerKey.skills.map((skill) => skill.count);
    expect(sameList(counts, keyCounts), `the margin keys count ${counts.join(" ")}; the answer key has ${keyCounts.join(" ")}`);
    expect((await textAt('.margin-key[aria-current="true"] b')) === "A", "key A isn't the chosen card");
    const skill = await textAt(".block .skill");
    expect(skill === cardA.name, `card A is "${skill}"; the answer key has "${cardA.name}"`);
    const plate = Number(await textAt(".block .plate b"));
    expect(plate === cardA.count, `card A's count is ${plate}; the answer key has ${cardA.count}`);
    const line = await textAt(".block > .skill + p");
    const keyLine = `Key A: borrowed ${cardA.count} times, ${cardA.firstMonth} to ${cardA.lastMonth}`;
    expect(line === keyLine, `card A reads "${line}"; the answer key has "${keyLine}"`);

    const stamps = await page.locator(".block .stamp time").evaluateAll((times) => times.map((time) => time.getAttribute("datetime") ?? ""));
    expect(stamps.length === cardA.count, `card A has ${stamps.length} stamps; the answer key has ${cardA.count} borrows`);
    expect(sameList(stamps, [...stamps].sort()), "card A's stamps aren't in date order");
    const range = `${monthOf(stamps[0]!)} to ${monthOf(stamps.at(-1)!)}`;
    expect(range === `${cardA.firstMonth} to ${cardA.lastMonth}`, `card A's stamps run ${range}; the answer key has ${cardA.firstMonth} to ${cardA.lastMonth}`);
    expect((await count(".block .rail-key")) === cardA.count, `card A doesn't have one rail key per borrow`);
    const phrasings = await textsAt(".block .phrasing");
    expect(sameList([...phrasings].sort(), [...cardATexts].sort()), "card A's phrasings aren't the answer key's messages, word for word");

    await seated();
    return `card A "${skill}", ${plate} borrows, ${range}`;
  });

  let firstProblem = "";
  await step("The cold rep", async () => {
    await page.getByRole("button", { name: "Open key A" }).click();
    await settle(".problem", ".error");
    const error = await shownError();
    expect(error === undefined, `the rep screen shows an error instead of a problem: ${error}`);
    expect((await textAt(".skill")) === cardA.name, "the rep screen isn't for card A");
    expect((await count(".lesson")) === 1, "the first rep has no lesson");
    expect((await page.locator(".answer-box textarea").inputValue()) === "", "the answer box isn't empty");
    firstProblem = await textAt(".problem");
    return "the lesson and a first problem";
  });

  await step("The known wrong answer", async () => {
    await submit(known.wrong);
    await settle(".verdict", ".error");
    at.fail = performance.now() - opened;
    const error = await shownError();
    expect(error === undefined, `the check shows an error instead of a verdict: ${error}`);
    expect((await count(".verdict:not(.is-failed)")) === 0, "the known wrong answer passed");
    await settle(".answer-box textarea:not([readonly])", ".error");
    const repError = await shownError();
    expect(repError === undefined, `after the fail, the next rep shows an error instead of a problem: ${repError}`);
    expect((await count(".verdict.is-failed")) === 1, "the fail's reason isn't on screen");
    expect((await count(".lesson")) === 1, "the lesson isn't shown again after the fail");
    expect((await textAt(".problem")) !== firstProblem, "the second rep repeats the first problem");
    return "a fail, the lesson again, and a second problem";
  });

  await step("The known right answer", async () => {
    await submit(known.right);
    await settle(".verdict:not(.is-failed)", ".error", ".answer-box textarea:not([readonly])");
    at.stamp = performance.now() - opened;
    const error = await shownError();
    expect(error === undefined, `the check shows an error instead of a verdict: ${error}`);
    expect((await count(".verdict:not(.is-failed)")) === 1, "the known right answer failed");
    today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    const stamp = await textAt(".verdict:not(.is-failed) .stamp");
    expect(stamp === `Stamped returned ${today}`, `the returned stamp reads "${stamp}"; today is ${today}`);
    return `a pass, ${stamp.toLowerCase()}`;
  });

  await step("Back on the stack", async () => {
    await page.getByRole("button", { name: "Back to the stack" }).click();
    await page.locator(".margin-key").first().waitFor();
    at.stack = performance.now() - opened;
    const returned = await textsAt(".margin-key.is-returned b");
    expect(sameList(returned, ["A"]), `the returned keys are ${returned.join(" ") || "none"}, not only A`);
    expect((await textAt(".block .skill")) === cardA.name, "the block doesn't show card A");
    const plate = await textAt(".block .plate span");
    expect(plate === "times borrowed, returned", `card A's plate reads "${plate}"`);
    const endRule = await page.locator(".block .end-rule time").getAttribute("datetime", { timeout: 1000 }).catch(() => null);
    expect(endRule === today, `card A's end rule is dated ${endRule ?? "nowhere"}; it was returned ${today}`);
    expect(groupRequests === 1, `the messages were grouped ${groupRequests} times in one load`);
    await seated();
    return `key A struck, the rail closed, returned ${today}`;
  });
} catch (error) {
  failed = true;
  const reason = error instanceof Mismatch ? error.message : (error instanceof Error ? error.message : String(error)).split("\n")[0];
  console.log(`FAIL ${shot + 1}. ${currentStep}: ${reason}`);
  await page.screenshot({ path: join(OUT, "failure.png"), fullPage: true }).catch(() => {});
} finally {
  await context.close();
  if (values.video) {
    await page.video()?.saveAs(join(OUT, "journey.webm"));
    await rm(videoDir, { recursive: true, force: true });
  }
  await browser.close();
  app.kill();
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
console.log();
if (!failed) {
  console.log(`From opening the page${pausedMs ? `, ${seconds(pausedMs)} of pauses included` : ""}:`);
  const marks = [
    ["the fail", at.fail, FIRST_MINUTE_MS],
    ["the returned stamp", at.stamp, FIRST_MINUTE_MS],
    ["the stack again", at.stack, JOURNEY_MS],
  ] as const;
  for (const [what, ms, limit] of marks) {
    console.log(`${ms < limit ? "ok  " : "FAIL"} ${what} at ${seconds(ms)} (limit ${seconds(limit)})`);
    if (ms >= limit) failed = true;
  }
}
console.log(`The whole run: ${seconds(performance.now() - runStarted)}`);
console.log(`Screenshots${values.video ? " and journey.webm" : ""} in ${OUT}`);
console.log(failed ? "The journey failed." : "The journey matches the answer key.");
process.exit(failed ? 1 : 0);
