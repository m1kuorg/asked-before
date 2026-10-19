// The sort's recall on a long history (m1kuorg/basics#56), with the real
// model. The demo export is too small and too clean to show what the sort
// misses, so this sorts scripts/fixtures/long-history.json, a made-up
// history of 469 labeled phrasings (74 skills, many of them near misses of
// each other, and 257 one-offs, labeled by the rules atop
// make-long-history.ts), uploaded at once through the SDK, dated across 18
// months by a seeded shuffle dealt in text order, so every run, and every
// relabeling, sorts the same upload. Its cards are scored against the
// labels by pairs of phrasings: recall is the share of pairs of one skill
// that share a card, and precision the share of pairs sharing a card that
// are of one skill. One run's recall can land 10 points from the next, so
// the runs, 3 unless asked, sort side by side and pass on their mean:
// recall of at least 75% at precision of at least 85%. That floor sits
// under what the sort does with its second pass over the unsorted (82.4%
// at 89.2%, the mean of 10 runs, whose recall ran from 77.6% to 90.1% and
// precision from 85.6% to 91.7%) by what a mean of 3 runs can stray from
// it (means landed at 77.6% and 78.6%, one run at 72.6%), and well over
// what it did without the pass (69.2% at 95.3%, in 10 runs), so a sort that
// loses the pass's gain, or merges skills, fails it.
// Each run also says whether it meets #56's target, which the entrant set
// on October 19, 2026 to what the second pass measured, 82.4% recall at
// 89.2% precision, from the 85% at 90% no design reached.
// It prints each run's time, model requests, and tokens, then the skills
// not whole on one card and the cards holding more than one skill, by name
// (the history's labels and the cards' skills), never a phrasing's words.
// It exits 1 if the mean misses the floor or any sort fails.
// Run: bun run check:sort-recall [runs]

import type { Phrasing } from "@asked-before/sdk";
import { join } from "node:path";
import { startApp } from "./lib/app";
import { allUnsorted, sortEnds, upload } from "./lib/answer-key";
import { forward, startModelStub, type Answer } from "./lib/model-stub";

/** The floor the runs' mean must reach. */
const RECALL = 0.75;
const PRECISION = 0.85;
/** m1kuorg/basics#56's target, what the second pass measured: reported for each run, not required. */
const TARGET_RECALL = 0.824;
const TARGET_PRECISION = 0.892;
const runs = Number(process.argv[2] ?? 3);

const history: { skills: { name: string; messages: string[] }[]; oneOffs: string[] } = await Bun.file(join(import.meta.dir, "fixtures", "long-history.json")).json();

// A seeded shuffle of times, dealt in the phrasings' text order, so every run uploads the same history in the same order, whatever their labels.
let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const start = Date.UTC(2025, 2, 1);
const end = Date.UTC(2026, 8, 30);
const dated = [
  ...history.skills.flatMap((s) => s.messages.map((text) => ({ text, label: s.name as string | null }))),
  ...history.oneOffs.map((text) => ({ text, label: null as string | null })),
]
  .sort((a, b) => (a.text < b.text ? -1 : 1))
  .map((m) => ({ ...m, time: start + Math.floor(random() * (end - start)) }))
  .sort((a, b) => a.time - b.time);
const phrasings: Phrasing[] = dated.map((m, i) => ({ sourceId: `h${i + 1}`, text: m.text, time: new Date(m.time).toISOString() }));
const labelOf = new Map(dated.map((m, i) => [`h${i + 1}`, m.label]));

type Call = { ms: number; stop: string; input: number; output: number };
/**
 * Forwards to the real model, keeping each answer's time, stop reason, and
 * tokens. A connection that drops on the way answers 502, which the app's
 * Anthropic client tries again, as it would the API's own.
 */
const measured =
  (calls: Call[]): Answer =>
  async (request, raw, body) => {
    const started = performance.now();
    let response: Response;
    try {
      response = await forward(request, raw, body);
    } catch {
      calls.push({ ms: performance.now() - started, stop: "dropped connection", input: 0, output: 0 });
      return Response.json({ type: "error", error: { type: "api_error", message: "The check's connection to the API dropped." } }, { status: 502 });
    }
    const text = await response.clone().text();
    const events = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5)));
    const first = events.find((e) => e.type === "message_start")?.message;
    const last = events.filter((e) => e.type === "message_delta").at(-1);
    calls.push({
      ms: performance.now() - started,
      stop: last?.delta?.stop_reason ?? events.find((e) => e.type === "error")?.error?.type ?? `HTTP ${response.status}`,
      input: first?.usage?.input_tokens ?? 0,
      output: last?.usage?.output_tokens ?? 0,
    });
    return response;
  };

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

async function sortOnce(run: number) {
  const calls: Call[] = [];
  const model = await startModelStub(measured(calls));
  const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
  try {
    const { client } = app.browser();
    await client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
    const shelf = await client.shelves.create({ name: `Long history, run ${run}` });
    const started = performance.now();
    const ended = await sortEnds(client, (await upload(client, shelf.id, phrasings)).id, 30 * 60_000);
    const seconds = (performance.now() - started) / 1000;
    const cards = await Promise.all((await client.cards.list(shelf.id)).map((c) => client.cards.get(c.id)));
    const unsorted = await allUnsorted(client, shelf.id);
    return { ended, seconds, cards, unsorted, calls, efforts: [...new Set(model.requests.map((r) => r.body.output_config?.effort))] };
  } finally {
    await app.stop();
    model.stop();
  }
}

type Sorted = Awaited<ReturnType<typeof sortOnce>>;

/** Scores a sort's cards against the labels, by pairs of phrasings. */
function score({ cards }: Sorted) {
  const cardOf = new Map(cards.flatMap((c) => c.borrows.map((b) => [b.sourceId, c.skill])));
  const ids = phrasings.map((p) => p.sourceId);
  let both = 0;
  let sameSkill = 0;
  let sameCard = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const skill = labelOf.get(ids[i]!) !== null && labelOf.get(ids[i]!) === labelOf.get(ids[j]!);
      const card = cardOf.has(ids[i]!) && cardOf.get(ids[i]!) === cardOf.get(ids[j]!);
      if (skill) sameSkill++;
      if (card) sameCard++;
      if (skill && card) both++;
    }
  }
  const landed = history.skills.map((s) => {
    const mine = ids.filter((id) => labelOf.get(id) === s.name).map((id) => cardOf.get(id) ?? null);
    const card = mine[0];
    const whole = card !== null && mine.every((c) => c === card) && cards.find((c) => c.skill === card)!.borrows.length === mine.length;
    return { name: s.name, mine, whole };
  });
  const mixed = cards
    .map((c) => ({ skill: c.skill, labels: c.borrows.map((b) => labelOf.get(b.sourceId) ?? "a one-off") }))
    .filter((c) => new Set(c.labels).size > 1);
  return {
    recall: both / sameSkill,
    precision: sameCard ? both / sameCard : 0,
    whole: landed.filter((s) => s.whole).length,
    split: landed.filter((s) => !s.whole),
    mixed,
    oneOffsOnCards: ids.filter((id) => labelOf.get(id) === null && cardOf.has(id)).length,
    labeledUnsorted: ids.filter((id) => labelOf.get(id) !== null && !cardOf.has(id)).length,
  };
}

const tally = (names: (string | null)[]) => {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name === null ? "unsorted" : `"${name}"`, (counts.get(name === null ? "unsorted" : `"${name}"`) ?? 0) + 1);
  return [...counts].map(([name, n]) => `${name} ${n}`).join(", ");
};

console.log(
  `${runs} sort(s) of a made-up history of ${phrasings.length} phrasings: ${history.skills.length} skills of ${phrasings.length - history.oneOffs.length}, and ${history.oneOffs.length} one-offs. The runs pass at a mean recall of ${percent(RECALL)} or more and a mean precision of ${percent(PRECISION)} or more; the target is ${percent(TARGET_RECALL)} at ${percent(TARGET_PRECISION)}.\n`,
);
const failures: string[] = [];
const results = await Promise.all(
  Array.from({ length: runs }, async (_, i) => {
    try {
      return await sortOnce(i + 1);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }),
);
const scores: ReturnType<typeof score>[] = [];
let metTarget = 0;
results.forEach((result, i) => {
  const run = `Run ${i + 1}`;
  if (result instanceof Error) {
    console.log(`${run}: threw ${result.message}\n`);
    failures.push(`${run} threw ${result.message}`);
    return;
  }
  const tokens = result.calls.reduce((sum, c) => ({ input: sum.input + c.input, output: sum.output + c.output }), { input: 0, output: 0 });
  const stops = [...new Set(result.calls.map((c) => c.stop))].join(", ");
  const head = `${run}: ${result.ended.status} in ${result.seconds.toFixed(0)}s, ${result.calls.length} model requests at effort ${result.efforts.join(", ")} (${tokens.input.toLocaleString("en-US")} tokens in, ${tokens.output.toLocaleString("en-US")} out; ${stops}); the slowest took ${(Math.max(...result.calls.map((c) => c.ms)) / 1000).toFixed(0)}s`;
  if (result.ended.status !== "sorted") {
    console.log(`${head}\n  FAIL the sort ${result.ended.status}: ${result.ended.error}\n`);
    failures.push(`${run}'s sort ${result.ended.status}: ${result.ended.error}`);
    return;
  }
  const s = score(result);
  scores.push(s);
  const onTarget = s.recall >= TARGET_RECALL && s.precision >= TARGET_PRECISION;
  if (onTarget) metTarget++;
  console.log(
    [
      head,
      `  recall ${percent(s.recall)}, precision ${percent(s.precision)}; ${onTarget ? "meets" : "short of"} the target`,
      `  ${result.cards.length} cards; ${s.whole} of ${history.skills.length} skills whole on one card; ${s.labeledUnsorted} phrasings of a skill left unsorted, ${s.oneOffsOnCards} one-offs on a card, ${result.unsorted.length} unsorted in all`,
      `  Skills not whole on one card: ${s.split.map((x) => `"${x.name}" (${tally(x.mine)})`).join("; ") || "none"}`,
      `  Cards holding more than one skill: ${s.mixed.map((c) => `"${c.skill}" (${tally(c.labels)})`).join("; ") || "none"}`,
    ].join("\n"),
    "\n",
  );
});

const mean = (pick: (s: (typeof scores)[number]) => number) => scores.reduce((sum, s) => sum + pick(s), 0) / scores.length;
const recall = mean((s) => s.recall);
const precision = mean((s) => s.precision);
const range = (pick: (s: (typeof scores)[number]) => number) => `${percent(Math.min(...scores.map(pick)))} to ${percent(Math.max(...scores.map(pick)))}`;
if (scores.length) {
  const ok = recall >= RECALL && precision >= PRECISION;
  if (!ok) failures.push(`the mean of ${scores.length} run(s), recall ${percent(recall)} at precision ${percent(precision)}, is under the floor`);
  console.log(`${ok ? "ok  " : "FAIL"} mean of ${scores.length} run(s): recall ${percent(recall)} (${range((s) => s.recall)}), precision ${percent(precision)} (${range((s) => s.precision)})`);
}
console.log(`${metTarget} of ${runs} run(s) met the target of ${percent(TARGET_RECALL)} recall at ${percent(TARGET_PRECISION)} precision.`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`The runs found ${percent(RECALL)} of the pairs or more at ${percent(PRECISION)} precision or more, on average.`);
