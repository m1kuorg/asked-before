// The incremental sort check (m1kuorg/basics#44), with the real model. The
// demo export is uploaded through the SDK and sorted, and the project's
// cards and unsorted phrasings are compared with demo/answer-key.json, three
// ways at once, each on its own copy of the app: the whole export in one
// upload; the export in two halves, as two uploads, so the second half must
// join the first half's cards; and the whole export with a batch size of
// 10, so it's sorted in three batches that each see the cards the earlier
// ones made. Every request is read on its way to the model: it holds only
// short ids, skills, and texts cut to 300 characters, never a date or a
// source id. It repeats the three for as many runs as asked, to tune the
// sort's effort as the grouping check did, and prints ids and skill names,
// never phrasing text. It exits 1 if any run misses the key.
// Run: bun run check:sort [runs]

import type { Client, Upload } from "@asked-before/sdk";
import { startApp, type App } from "./lib/app";
import { compareWithKey, phrasings, sortEnds, upload } from "./lib/answer-key";
import { forward, sortRequest, startModelStub, type ModelStub } from "./lib/model-stub";

const runs = Number(process.argv[2] ?? 1);

type Scenario = {
  name: string;
  app: App;
  model: ModelStub;
  client: Client;
  /** Uploads the export into the project, one upload after another, and returns how each sort ended. */
  run: (client: Client, projectId: string) => Promise<Upload[]>;
  matched: number;
};

const half = Math.floor(phrasings.length / 2);
const scenarios: Scenario[] = [];
async function scenario(name: string, env: Record<string, string>, run: Scenario["run"]) {
  const model = await startModelStub(forward);
  const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ...env });
  const { client } = app.browser();
  await client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  scenarios.push({ name, app, model, client, run, matched: 0 });
}

const one = (list: typeof phrasings) => async (client: Client, projectId: string) => [await sortEnds(client, (await upload(client, projectId, list)).id)];

await scenario("whole export", {}, one(phrasings));
await scenario("two halves", {}, async (client, projectId) => [
  ...(await one(phrasings.slice(0, half))(client, projectId)),
  ...(await one(phrasings.slice(half))(client, projectId)),
]);
await scenario("batches of 10", { SORT_BATCH_SIZE: "10" }, one(phrasings));

const failures: string[] = [];

try {
  console.log(`${runs} run(s) of ${scenarios.length} sorts of the demo export's ${phrasings.length} phrasings (two halves: ${half} then ${phrasings.length - half})\n`);
  for (let run = 1; run <= runs; run++) {
    const reports = await Promise.all(
      scenarios.map(async (s) => {
        const started = performance.now();
        const before = s.model.requests.length;
        const problems: string[] = [];
        let lines: string[] = [];
        try {
          const project = await s.client.shelves.create({ name: `${s.name}, run ${run}` });
          const ends = await s.run(s.client, project.id);
          for (const end of ends) if (end.status !== "sorted") problems.push(`an upload's sort ${end.status}: ${end.error}`);
          if (!problems.length) {
            const compared = await compareWithKey(s.client, project.id);
            lines = compared.lines;
            problems.push(...compared.problems);
          }
        } catch (error) {
          problems.push(`threw ${error instanceof Error ? error.message : String(error)}`);
        }
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        const requests = s.model.requests.length - before;
        if (!problems.length) s.matched++;
        else failures.push(`run ${run}, ${s.name}: ${problems.join("; ")}`);
        return [`Run ${run}, ${s.name}: ${problems.length ? "MISS" : "match"} (${seconds}s, ${requests} model request${requests === 1 ? "" : "s"})`, ...lines, ...problems.map((p) => `  - ${p}`)].join("\n");
      }),
    );
    console.log(reports.join("\n\n"), "\n");
  }

  // What the model saw: only the request's own short ids, skills, and cut texts.
  const requests = scenarios.flatMap((s) => s.model.requests);
  const body = (r: (typeof requests)[number]) => JSON.stringify(r.body);
  const times = phrasings.flatMap((p) => {
    const ms = Date.parse(p.time);
    return [p.time, new Date(ms).toISOString(), new Date(ms).toISOString().slice(0, 10), String(ms), String(Math.floor(ms / 1000))];
  });
  // A phrasing can hold a date of its own, as "convert '2025-10-09' string to a Date" does; that's its words, not its time.
  const timeLeaks = times.filter((t) => !phrasings.some((p) => p.text.includes(t)) && requests.some((r) => body(r).includes(t)));
  const idLeaks = phrasings.filter((p) => requests.some((r) => body(r).includes(p.sourceId)));
  const shapes = requests.every((r) => {
    const sent = sortRequest(r);
    return (
      Object.keys(JSON.parse(r.user.split("\n\n")[0]!)).sort().join() === "cards,phrasings" &&
      sent.phrasings.every((p) => Object.keys(p).sort().join() === "id,text" && /^p\d+$/.test(p.id) && p.text.length <= 300) &&
      sent.cards.every((c) => Object.keys(c).sort().join() === "id,samples,skill" && /^c\d+$/.test(c.id) && c.samples.length <= 3 && c.samples.every((t) => t.length <= 300))
    );
  });
  const efforts = [...new Set(requests.map((r) => r.body.output_config?.effort))].join(", ");
  console.log(`What the model was sent, in ${requests.length} requests at effort ${efforts}`);
  const say = (ok: boolean, what: string) => {
    console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };
  say(shapes, "each request is { cards: [{ id, skill, samples }], phrasings: [{ id, text }] }, with short ids, at most 3 samples, and texts of at most 300 characters");
  say(timeLeaks.length === 0, `no phrasing's time, date, or timestamp${timeLeaks.length ? `: ${timeLeaks.length} found` : ""}`);
  say(idLeaks.length === 0, `no export message id${idLeaks.length ? `: ${idLeaks.length} found` : ""}`);
  const leakedLogs = scenarios.filter((s) => phrasings.some((p) => s.app.log().includes(p.text)));
  say(leakedLogs.length === 0, "and the app's logs hold no phrasing");
} finally {
  await Promise.all(scenarios.map((s) => s.app.stop()));
  for (const s of scenarios) s.model.stop();
}

console.log(`\n${scenarios.map((s) => `${s.name}: ${s.matched} of ${runs}`).join(", ")} matched the answer key.`);
if (failures.length) {
  console.log(`\n${failures.length} miss(es):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("Every run matches the answer key.");
