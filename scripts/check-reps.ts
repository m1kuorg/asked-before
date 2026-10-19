// Proves cold reps with the real model (m1kuorg/basics#46), through the
// SDK, on the demo skill, "Undo a git commit": card A of the demo shelf,
// on a fresh copy of the app. First, with no model, the give-away rule
// runs on real-model problems labeled by hand
// (scripts/fixtures/rep-problems.json, m1kuorg/basics#65): it must flag
// every one that gives the fix away and none of the rest. The sort is a
// stand-in in this script that sorts as the answer key does (the sort has
// its own check); every rep and check request goes on to the real model.
// Five reps in turn on card A,
// answered with the known wrong, right, wrong, right, and wrong answers:
// the first brings the lesson, and each start after a failed rep brings it
// again, but none after a pass; every problem differs from the earlier
// ones, quotes no phrasing, and names no fix; the wrong answer fails with a
// reason about git stash, the right one passes and stamps the card
// returned. Each request carried the card's phrasings and its earlier
// problems, never a time. Then the app's logs are read for any of those
// texts. It prints the lesson, problems, and reasons, which are made-up
// demo data, so they can be read; the app itself must log none of them.
// It needs ANTHROPIC_API_KEY, and makes 10 model calls in a minute or two.
// Run: bun run check:reps

import { ApiError } from "@asked-before/sdk";
import { join } from "node:path";
import { phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { startModelStub } from "./lib/model-stub";
import { kindOf, known, repRequest, sortsByKey } from "./lib/reps";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("check:reps asks the real model: set ANTHROPIC_API_KEY.");
  process.exit(1);
}

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
};

/** Lowercase words, so a quote is found through changes in case and punctuation. */
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Every run of `n` words in the text. */
const grams = (text: string, n: number) => {
  const w = words(text);
  return new Set(Array.from({ length: Math.max(0, w.length - n + 1) }, (_, i) => w.slice(i, i + n).join(" ")));
};
/** True when `text` shares a run of five words with `source`, or holds all of a shorter one. */
const quotes = (text: string, source: string) => {
  const inText = ` ${words(text).join(" ")} `;
  if (words(source).length < 5) return inText.includes(` ${words(source).join(" ")} `);
  return [...grams(source, 5)].some((gram) => inText.includes(` ${gram} `));
};
/** The share of word triples two texts have in common, from 0 to 1. */
const similarity = (a: string, b: string) => {
  const [x, y] = [grams(a, 3), grams(b, 3)];
  const shared = [...x].filter((g) => y.has(g)).length;
  return shared / (x.size + y.size - shared || 1);
};
/** Problems more alike than this count as a repeat. */
const MAX_SIMILARITY = 0.5;
/**
 * What solves this skill, named or described. A problem that says it gives its answer away: it names one of the
 * skill's commands or flags, even as something to avoid ("without anyone having to reset their copy"), or says what
 * the fix does to the change. A new commit counts only as the fix: one that undoes the change or reaches everyone, or
 * the undo or the fix made as one. A new commit for the learner's own kept edits ("ready for a new commit") is their
 * next step, not the fix (m1kuorg/basics#65).
 */
const GIVEAWAY = new RegExp(
  [
    String.raw`\b(reset|revert|revers|amend|rebas)\w*|--(soft|hard|mixed)\b|cherry-pick|\bforce[- ]?push|\bHEAD[~^]`,
    String.raw`\bcancel(s|ed|ing)? out\b|\bback(s|ed|ing)? out\b`,
    String.raw`\bnew commit (that|which) (\w+ ){0,2}?(undo|revers|cancel|bring|everyone|teammates)|\bnew commit record`,
    String.raw`\b(undone|(the|your) fix|correct\w*) (\w+ ){0,3}?(with|in|as) (a|one) new commit`,
  ].join("|"),
  "i",
);
const TIME = /\d{4}-\d{2}-\d{2}|\b1[67]\d{11}\b/;

console.log("The give-away rule, on real-model problems labeled by hand");
const labeled: { problems: { source: string; problem: string; givesAway: boolean }[] } = await Bun.file(join(import.meta.dir, "fixtures", "rep-problems.json")).json();
const missed = labeled.problems.filter((p) => p.givesAway && !GIVEAWAY.test(p.problem));
const misflagged = labeled.problems.filter((p) => !p.givesAway && GIVEAWAY.test(p.problem));
const giveaways = labeled.problems.filter((p) => p.givesAway).length;
check(missed.length === 0, `it flags all ${giveaways} problems that give the fix away${missed.map((p) => `\n       missed (${p.source}): ${p.problem}`).join("")}`);
check(misflagged.length === 0, `and none of the ${labeled.problems.length - giveaways} that don't${misflagged.map((p) => `\n       flagged (${p.source}, "${p.problem.match(GIVEAWAY)![0]}"): ${p.problem}`).join("")}`);
console.log();

const model = await startModelStub(sortsByKey());
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const timings: Record<"start" | "check", number[]> = { start: [], check: [] };
const timed = async <T>(kind: "start" | "check", call: () => Promise<T>) => {
  const started = performance.now();
  const result = await call();
  timings[kind].push(Math.round(performance.now() - started));
  return result;
};

// Every text the model saw or wrote, to look for in the logs at the end.
const seen: string[] = [...phrasings.map((p) => p.text), known.wrong, known.right];

try {
  const ada = app.browser();
  await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  const demo = await ada.client.shelves.create({ name: "Demo", demo: true });
  await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
  const [A] = await ada.client.cards.list(demo.id);
  const card = await ada.client.cards.get(A!.id);
  const cardPhrasings = card.borrows.map((b) => b.text);
  console.log(`The app is on ${app.url}. Card A is "${card.skill}", with ${card.count} phrasings from the demo export.\n`);
  check(card.skill === known.skill, `card A is the known answers' skill, "${known.skill}"`);

  const problems: string[] = [];
  let lesson = "";
  const plan = ["wrong", "right", "wrong", "right", "wrong"] as const;

  for (const [i, label] of plan.entries()) {
    const n = i + 1;
    const afterFail = i > 0 && plan[i - 1] === "wrong";
    console.log(`${n}. Rep ${n}, answered with the known ${label} answer`);
    const before = model.requests.length;
    const started = await timed("start", () => ada.client.reps.start(card.id));
    const sent = model.requests.slice(before);
    const asked = sent.length === 1 && kindOf(sent[0]!) === "rep" ? repRequest(sent[0]!) : undefined;
    check(asked !== undefined && asked.withLesson === (i === 0), `one rep request, ${i === 0 ? "asking for the lesson" : "for a problem only"}`);
    check(asked?.phrasings.join("\n") === cardPhrasings.join("\n") && asked.earlierProblems.join("\n") === problems.join("\n"), `it sent the card's ${asked?.phrasings.length} phrasings and its ${asked?.earlierProblems.length} earlier problems`);
    check(!TIME.test(sent[0]?.user ?? "") && sent[0]?.body.output_config?.effort === "medium", `no time reached the model; effort ${sent[0]?.body.output_config?.effort}`);

    if (i === 0) {
      lesson = started.lesson ?? "";
      seen.push(lesson);
      console.log(`Lesson (${timings.start.at(-1)}ms, ${words(lesson).length} words):\n  ${lesson}`);
      check(lesson !== "", "the first rep brings the lesson");
    } else if (afterFail) {
      check(started.lesson === lesson, "after a failed rep, the lesson comes again, unchanged");
    } else {
      check(started.lesson === null, "after a pass, no lesson");
    }

    const problem = started.rep.problem;
    console.log(`Problem ${n} (${timings.start.at(-1)}ms):\n  ${problem}`);
    const closest = Math.max(0, ...problems.map((p) => similarity(problem, p)));
    check(closest < MAX_SIMILARITY, `problem ${n} differs from every earlier problem (closest shares ${Math.round(closest * 100)}% of word triples)`);
    const quoted = cardPhrasings.filter((p) => quotes(problem, p));
    check(quoted.length === 0, `problem ${n} quotes no phrasing${quoted.length ? `: ${quoted.join(" | ")}` : ""}`);
    const giveaway = problem.match(GIVEAWAY);
    check(!giveaway, `problem ${n} names or describes no fix${giveaway ? `: ${giveaway[0]}` : ""}`);
    problems.push(problem);
    seen.push(problem);

    const answer = label === "wrong" ? known.wrong : known.right;
    const want = label === "wrong" ? "fail" : "pass";
    try {
      const { rep, card: after } = await timed("check", () => ada.client.reps.check(started.rep.id, { answer }));
      seen.push(rep.reason ?? "");
      const named = label === "wrong" ? /stash/i.test(rep.reason ?? "") : true;
      check(rep.verdict === want && named, `the ${label} answer: ${rep.verdict} (${timings.check.at(-1)}ms) ${rep.reason}`);
      const status = plan.slice(0, n).includes("right") ? "returned" : "borrowed";
      check(after.status === status, `card A is ${after.status}${after.returnedAt ? `, stamped ${after.returnedAt}` : ""}`);
    } catch (error) {
      check(false, `the ${label} answer: ${error instanceof ApiError ? `${error.status} ${error.message}` : String(error)}`);
    }
    console.log();
  }

  const stored = await ada.client.cards.get(card.id);
  check(stored.lesson === lesson && stored.reps.map((r) => r.verdict).join() === plan.map((p) => (p === "wrong" ? "fail" : "pass")).join(), `the card keeps its lesson and its ${stored.reps.length} reps, with their verdicts`);
} finally {
  await app.stop();
  model.stop();
}

console.log("The app's logs hold no phrasing, lesson, problem, answer, or reason");
const logs = app.log();
const leaked = seen.filter((text) => text && quotes(logs, text));
check(leaked.length === 0, `${seen.length} texts looked for, ${leaked.length} found in the logs`);
console.log(logs.trim().replace(/^/gm, "     "));

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
console.log(`\nMean latency: start ${mean(timings.start)}ms over ${timings.start.length}, check ${mean(timings.check)}ms over ${timings.check.length}.`);
if (failed) {
  console.log(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log("Cold reps hold up on the demo skill.");
