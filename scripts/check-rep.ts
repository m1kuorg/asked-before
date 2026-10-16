// Walks the Rep screen in a real browser against the real page, with the
// group, rep, and check routes stubbed here with Playwright's page.route, so
// it runs whether or not the real routes have landed. No stub is in the app:
// the script also checks that no JavaScript the page loaded holds a stub.
// Run: PORT=3129 bun run scripts/check-rep.ts [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Route } from "playwright";
import { buildCards } from "../src/cards";
import { parseExport } from "../src/parser";
import type { CheckRequest, GroupResponse, RepRequest } from "../src/types";

const PORT = Number(process.env.PORT ?? 3129);
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? join(tmpdir(), "check-rep");
const ROOT = join(import.meta.dir, "..");

const read = (path: string) => Bun.file(join(ROOT, path)).text();
const messages = parseExport(await read("demo/export.json"));
const key: { skills: { name: string; messageIds: string[] }[] } = JSON.parse(await read("demo/answer-key.json"));
const grouping: GroupResponse = { skills: key.skills.map(({ name, messageIds }) => ({ name, messageIds })) };

// The stubbed replies. Each rep reply also carries a stray answer, which must never reach the screen.
const ANSWER = "git reset --soft HEAD~1";
const LESSON = "A commit you haven't pushed can be taken back by moving your branch back one commit.\nHow far back you reset decides whether your edits stay staged, stay in the files, or go.";
const PROBLEMS = [
  "You committed a file with a password in it a minute ago and haven't pushed. Take that commit back but keep the work.",
  "Your last commit on a local branch has the wrong message and a missing file. Undo it so you can redo it properly.",
  "You made a commit on the wrong local branch. Take it back without losing the edits.",
];
const ANSWERS = ["delete the repo and clone it again", "git push --force", `${ANSWER}, then commit again`];
const REASONS = [
  "Cloning again throws away the uncommitted work you wanted to keep.",
  "Force-pushing changes the remote; the commit was never pushed and is still there locally.",
  "A soft reset moves the branch back one commit and keeps the edits staged.",
];
const FAILURE = { status: 502, json: { error: "The model declined to answer." } };
const STUB_TEXTS = [...LESSON.split("\n"), ...PROBLEMS, ...REASONS, FAILURE.json.error];

const repReplies = [
  FAILURE,
  { status: 200, json: { lesson: LESSON, problem: PROBLEMS[0], answer: ANSWER } },
  FAILURE,
  { status: 200, json: { problem: PROBLEMS[1], answer: ANSWER } },
  { status: 200, json: { problem: PROBLEMS[2], answer: ANSWER } },
];
const checkReplies = [
  { status: 200, json: { verdict: "fail", reason: REASONS[0] } },
  { status: 200, json: { verdict: "fail", reason: REASONS[1] } },
  FAILURE,
  { status: 200, json: { verdict: "pass", reason: REASONS[2] } },
];

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

if (await fetch(BASE).then(() => true, () => false)) {
  console.error(`Something is already on port ${PORT}; set PORT to a free one.`);
  process.exit(1);
}
const server = Bun.spawn(["bun", "run", "server.ts"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdout: "ignore" });
for (let i = 0; !(await fetch(BASE).then(() => true, () => false)); i++) {
  if (i > 50) throw new Error("The server didn't start.");
  await Bun.sleep(100);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(10_000);

const groupBodies: unknown[] = [];
const repBodies: RepRequest[] = [];
const checkBodies: CheckRequest[] = [];
const scripts: string[] = [];
page.on("response", async (response) => {
  if (response.request().resourceType() === "script") scripts.push(await response.text());
});

const reply = (route: Route, queue: { status: number; json: unknown }[], name: string) => {
  const next = queue.shift();
  if (!next) {
    check(false, `no stubbed ${name} reply was left`);
    return route.abort();
  }
  return route.fulfill(next);
};
await page.route("**/api/**", (route, request) => {
  const path = new URL(request.url()).pathname;
  if (path === "/api/group") {
    groupBodies.push(request.postDataJSON());
    return route.fulfill({ json: grouping });
  }
  if (path === "/api/rep") {
    repBodies.push(request.postDataJSON());
    return reply(route, repReplies, "rep");
  }
  if (path === "/api/check") {
    checkBodies.push(request.postDataJSON());
    return reply(route, checkReplies, "check");
  }
  check(false, `unstubbed request to ${path}`);
  return route.abort();
});

const text = (selector: string) => page.locator(selector).innerText();
const count = (selector: string) => page.locator(selector).count();
const LESSON_LINES = LESSON.split("\n");
const showsLesson = async () => {
  const shown = await text(".lesson");
  return LESSON_LINES.every((line) => shown.includes(line));
};
/** Before you submit: no answer, no verdict on this problem, and an empty box. */
const givesNothingAway = async (reason: string) => {
  const html = await page.content();
  return !html.includes(ANSWER) && !html.includes(reason) && (await page.locator(".answer-box textarea").inputValue()) === "";
};
const PASSED = ".verdict:not(.is-failed)";

try {
  await page.goto(BASE);
  await page.getByRole("button", { name: /load/i }).click();
  await page.getByRole("button", { name: "Open key A" }).click();
  const skill = await text(".skill");
  console.log(`Opened key A: the stack ${groupBodies.length ? "sent a group request" : "is the placeholder, with no group request"}`);

  console.log("\nThe first rep request fails, then its retry brings the lesson and a problem");
  await page.locator(".error").waitFor();
  check((await text(".error")) === FAILURE.json.error && (await count(".retry")) === 1, "a failed rep shows the error and a retry");
  check((await count(".lesson, .problem, .verdict")) === 0, "no lesson, problem, or verdict that didn't arrive is shown");
  await page.locator(".retry").click();
  await page.locator(".problem").waitFor();
  check(same(repBodies[0], repBodies[1]), "the retry resends the same rep request");
  check(repBodies[1]?.withLesson === true && same(repBodies[1]?.earlierProblems, []), "the first rep asks for the lesson, with no earlier problems");
  check((await showsLesson()) && (await count(".lesson + .problem")) === 1, "opening the card shows the lesson, then a problem");
  check((await text(".problem")).includes(PROBLEMS[0]!) && (await count(".answer-box textarea")) === 1, "the problem comes with a plain answer box");
  check((await count(".verdict")) === 0 && (await givesNothingAway(REASONS[0]!)), "until you submit, nothing on screen gives the answer away");

  console.log("\nThe first cold rep, failed");
  await page.locator(".answer-box textarea").fill(ANSWERS[0]!);
  await page.getByRole("button", { name: "Check my answer" }).click();
  await page.locator(".verdict.is-failed").waitFor();
  check((await text(".verdict.is-failed")).includes(REASONS[0]!), "a fail shows the reason");
  check(await showsLesson(), "a fail shows the lesson again");

  console.log("\nThe next rep request fails under the reason and the lesson, then its retry brings a second problem");
  await page.locator(".error").waitFor();
  check((await count(".retry")) === 1 && (await count(".verdict.is-failed, .lesson")) === 2, "the error and a retry show under the reason and the lesson");
  check((await count(".problem")) === 0, "no problem that didn't arrive is shown");
  await page.locator(".retry").click();
  await page.locator(".problem").waitFor();
  check(same(repBodies[2], repBodies[3]), "the retry resends the same rep request");
  check(repBodies[3]?.withLesson === false && same(repBodies[3]?.earlierProblems, PROBLEMS.slice(0, 1)), "the second rep request carries the first problem, without asking for a lesson");
  check((await text(".problem")).includes(PROBLEMS[1]!) && (await showsLesson()) && (await count(".verdict.is-failed")) === 1, "the reason, the lesson again, and a second problem");
  check(await givesNothingAway(REASONS[1]!), "until you submit, nothing on screen gives the answer away");
  await page.screenshot({ path: join(OUT, "failed-rep.png"), fullPage: true });

  console.log("\nThe second cold rep, failed too");
  await page.locator(".answer-box textarea").fill(ANSWERS[1]!);
  await page.getByRole("button", { name: "Check my answer" }).click();
  await page.locator(".problem").getByText(PROBLEMS[2]!).waitFor();
  check((await text(".verdict.is-failed")).includes(REASONS[1]!) && (await showsLesson()), "the reason and the lesson again");
  check(repBodies[4]?.withLesson === false && same(repBodies[4]?.earlierProblems, PROBLEMS.slice(0, 2)), "the third rep request carries both earlier problems");
  check((await count(".skill")) === 1 && (await count(`.stamp, ${PASSED}`)) === 0, "the card stays borrowed, with a third problem on the rep screen");
  check(await givesNothingAway(REASONS[2]!), "until you submit, nothing on screen gives the answer away");

  console.log("\nThe third cold rep: the check request fails, then its retry passes");
  await page.locator(".answer-box textarea").fill(ANSWERS[2]!);
  await page.getByRole("button", { name: "Check my answer" }).click();
  await page.locator(".error").waitFor();
  check((await text(".error")) === FAILURE.json.error && (await count(".retry")) === 1, "a failed check shows the error and a retry");
  check((await count(`.stamp, ${PASSED}`)) === 0, "no verdict that didn't arrive is shown");
  check(await page.locator(".answer-box textarea").evaluate((t: HTMLTextAreaElement) => t.readOnly), "the answer stays locked, so the retry checks what's on screen");
  await page.locator(".retry").click();
  await page.locator(PASSED).waitFor();
  check(same(checkBodies[2], checkBodies[3]), "the retry resends the same check request");
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  check((await text(PASSED)).includes(REASONS[2]!), "a pass shows the reason");
  check((await text(".stamp")).includes(today), `a pass stamps the card returned ${today}`);
  await page.screenshot({ path: join(OUT, "passed-rep.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to the stack" }).click();
  const returnedOnStack = await page
    .waitForFunction(
      ([skill, today]) =>
        !document.querySelector(".answer-box") &&
        (document.querySelector(".is-returned") !== null || document.body.innerText.includes(`${skill} on ${today}`)),
      [skill, today],
    )
    .then(() => true, () => false);
  check(returnedOnStack, `back on the stack, the card shows returned ${today}`);
  await page.screenshot({ path: join(OUT, "stack-returned.png"), fullPage: true });

  console.log("\nWhat the rep and check requests carried");
  const card = buildCards(
    groupBodies.length ? grouping : { skills: [{ name: skill, messageIds: messages.map((m) => m.id) }] },
    messages,
  ).find((c) => c.skill === skill)!;
  const phrasings = card.borrows.map((b) => b.text);
  repBodies.forEach((body, i) =>
    check(
      same(Object.keys(body), ["skill", "phrasings", "earlierProblems", "withLesson"]) &&
        body.skill === skill &&
        same(body.phrasings, phrasings) &&
        body.earlierProblems.every((p) => PROBLEMS.includes(p)),
      `rep request ${i + 1}: only the skill, the card's ${phrasings.length} phrasings, and ${body.earlierProblems.length} earlier problems`,
    ),
  );
  checkBodies.forEach((body, i) =>
    check(
      same(Object.keys(body), ["skill", "problem", "answer"]) &&
        body.skill === skill &&
        PROBLEMS.includes(body.problem) &&
        ANSWERS.includes(body.answer),
      `check request ${i + 1}: only the skill, the problem, and your answer`,
    ),
  );
  check(repBodies.length === 5 && checkBodies.length === 4, `${repBodies.length} rep and ${checkBodies.length} check requests, as stubbed`);

  console.log("\nNo stub ships in the app");
  check(
    scripts.length > 0 && scripts.every((js) => STUB_TEXTS.every((stub) => !js.includes(stub)) && !js.includes("page.route")),
    `none of the ${scripts.length} scripts the page loaded holds a stubbed reply or page.route`,
  );
} catch (error) {
  check(false, error instanceof Error ? error.message.split("\n")[0]! : String(error));
  await page.screenshot({ path: join(OUT, "failure.png"), fullPage: true });
} finally {
  await browser.close();
  server.kill();
}

console.log(`\nScreenshots in ${OUT}`);
console.log(failed ? `${failed} failed` : "All passed");
process.exit(failed ? 1 : 0);
