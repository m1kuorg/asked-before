// Checks how well a capture is sorted with the real model
// (m1kuorg/basics#50), at the app's capture effort, through the SDK: on a
// fresh copy of the app, the demo project's upload is sorted by a stand-in
// as the answer key says, then fresh rephrasings of each of its skills and
// questions none of them ask are captured one at a time. Each rephrasing
// must land on its skill's card, and each other question wait unsorted.
// It prints every capture's words, which are made up, with where it went
// and how long it took, and exits 1 if any capture went astray in any run.
// It needs ANTHROPIC_API_KEY, and makes 20 model calls a run.
// Run: bun run check:capture-sort [runs]

import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { forward, startModelStub } from "./lib/model-stub";
import { sortsByKey } from "./lib/reps";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("check:capture-sort asks the real model: set ANTHROPIC_API_KEY.");
  process.exit(1);
}

const runs = Number(process.argv[2] ?? 1);
const [undo, center, port, date, dicts] = key.skills.map((skill) => skill.name);
/** Each capture, with the skill it asks, or null for one nothing asks. */
const CAPTURES: [string, string | null][] = [
  ["how do I take back the commit I just made in git?", undo!],
  ["undo last commit but keep the changes", undo!],
  ["git: I committed too early, how do I uncommit", undo!],
  ["remove my latest commit from the branch, it isn't pushed yet", undo!],
  ["how do I put a div in the middle of the page", center!],
  ["center a button horizontally and vertically in css", center!],
  ["css grid: center content both ways", center!],
  ["address already in use on port 4000, what do I do", port!],
  ["kill the process listening on port 8000 on linux", port!],
  ["something is already running on localhost:3000, how do I stop it", port!],
  ["turn a string like 2024-01-31 into a Date object in js", date!],
  ["javascript new Date from 'yyyy-mm-dd' gives me the wrong day", date!],
  ["python: sort a list of dicts by the 'name' field", dicts!],
  ["order a list of dictionaries by one key in python, largest first", dicts!],
  ["how do I tune a ukulele by ear", null],
  ["what's a good stretch for lower back pain", null],
  ["how do I write a haiku", null],
  ["convert celsius to fahrenheit in my head", null],
  ["how do I fold a fitted sheet", null],
  ["how does compound interest work", null],
];

let astray = 0;
const timings: number[] = [];
for (let run = 1; run <= runs; run++) {
  let demoSorted = false;
  const sortDemo = sortsByKey();
  const model = await startModelStub((request, raw, body) => (demoSorted ? forward : sortDemo)(request, raw, body));
  const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
  try {
    const { client } = app.browser();
    await client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
    const demo = await client.projects.create({ name: "Demo", demo: true });
    await sortEnds(client, (await upload(client, demo.id, phrasings, "demo-export.json")).id);
    demoSorted = true;
    console.log(`\nRun ${run} of ${runs}`);
    for (const [text, skill] of CAPTURES) {
      const started = performance.now();
      const captured = await client.captures.create(demo.id, { text });
      timings.push(Math.round(performance.now() - started));
      const ok = (captured.card?.skill ?? null) === skill;
      if (!ok) astray++;
      console.log(`${ok ? "ok  " : "FAIL"} ${JSON.stringify(text)} -> ${captured.card ? `"${captured.card.skill}"` : "unsorted"} (${timings.at(-1)}ms, effort ${model.requests.at(-1)?.body.output_config?.effort})`);
    }
  } finally {
    await app.stop();
    model.stop();
  }
}

const sorted = [...timings].sort((a, b) => a - b);
console.log(`\n${CAPTURES.length * runs - astray} of ${CAPTURES.length * runs} captures went where they belong. Latency: median ${sorted[Math.floor(sorted.length / 2)]}ms, slowest ${sorted.at(-1)}ms.`);
if (astray) process.exit(1);
