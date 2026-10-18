// Checks the sort's rules and the cards endpoints (m1kuorg/basics#44)
// through the SDK, on fresh copies of the app, with the model stubbed in
// this script and never in the app: each app's ANTHROPIC_BASE_URL points
// at a stand-in that answers as the answer key sorts the demo export,
// unless a step queues another answer. Finishing an upload starts its sort,
// which ends sorted with the cards and unsorted phrasings the key says, in
// margin-key order; the model sees only short ids, skills, and texts cut
// to 300 characters. The code checks hold: a new skill named like a card
// joins it, one of a single phrasing makes no card, and an answer that
// breaks a rule is asked again with the error, then fails the sort with no
// card made. A failed sort resumes on retry from the first phrasing not yet
// offered; sorts run one at a time on a shelf and side by side across
// shelves; deleting a shelf stops its sort; a restart carries on the
// sort it cut off; and past the daily cap, the next model request gets 429,
// which the upload records. It prints each step's checks, ids, and skill
// names, never phrasing text, and exits 1 if any fails, naming the step.
// Run: bun run check:sort-rules

import { ApiError, createClient, type Client, type Phrasing, type Shelf } from "@asked-before/sdk";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp, type App } from "./lib/app";
import { allUnsorted, compareWithKey, key, keySorter, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { hold, refuse, reply, sortRequest, startModelStub, type ModelStub } from "./lib/model-stub";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};
async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
  }
}
async function failure(call: Promise<unknown>): Promise<ApiError | null> {
  try {
    await call;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}
const say = (error: ApiError | null) => (error ? `${error.status} "${error.message}"` : "no error");

const apps: App[] = [];
const models: ModelStub[] = [];
/** A copy of the app whose model is a stand-in answering as the key does, and a learner signed up on it. */
async function copy(env: Record<string, string> = {}) {
  const model = await startModelStub(reply(keySorter));
  const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ...env });
  models.push(model);
  apps.push(app);
  const { client } = app.browser();
  await client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  return { model, app, client };
}

let made = 0;
/** Phrasings of the learner's own that aren't in the demo export. */
const extra = (...texts: string[]): Phrasing[] => texts.map((text) => ({ sourceId: `extra-${++made}`, text, time: new Date(Date.UTC(2026, 9, 1, 10, made)).toISOString() }));
const half = Math.floor(phrasings.length / 2);
const textOf = new Map(phrasings.map((p, i) => [p.text, `m${i + 1}`]));
const sentNames = (request: ModelStub["requests"][number]) => sortRequest(request).phrasings.map((p) => textOf.get(p.text) ?? "other");

const main = await copy();
const ada = main.client;
const bea = main.app.browser().client;
await bea.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
let work: Shelf;
let failedUpload = "";
const cardNamed = async (client: Client, shelfId: string, skill: string) => (await client.cards.list(shelfId)).find((c) => c.skill === skill);

try {
  await step("1. Before a sort, a shelf has no cards and nothing unsorted, and another account's are a 404", async () => {
    work = await ada.shelves.create({ name: "Work" });
    const cards = await ada.cards.list(work.id);
    const unsorted = await ada.cards.unsorted(work.id);
    check(cards.length === 0 && unsorted.phrasings.length === 0 && unsorted.next === null, `${cards.length} cards, ${unsorted.phrasings.length} unsorted`);
    for (const [what, call] of [
      ["cards", () => bea.cards.list(work.id)],
      ["unsorted", () => bea.cards.unsorted(work.id)],
      ["a missing card", () => ada.cards.get("no-such-card")],
    ] as const) {
      const refused = await failure(call());
      check(refused?.status === 404, `Bea's ${what}: ${say(refused)}`);
    }
    const response = await fetch(`${main.app.url}/api/v1/shelves/${work.id}/cards`);
    check(response.status === 401, `no session: ${response.status}`);
  });

  await step("2. Finishing the demo export starts its sort, which ends sorted with every phrasing offered", async () => {
    const finished = await upload(ada, work.id, phrasings);
    check(finished.status === "waiting" && finished.offered === 0, `the finish answers ${finished.status}, ${finished.offered} offered`);
    const end = await sortEnds(ada, finished.id);
    check(end.status === "sorted" && end.offered === 27 && end.phrasings === 27 && end.error === null, `it ends ${end.status}, ${end.offered} of ${end.phrasings} offered, error ${end.error}`);
    check(main.model.requests.length === 1, `in ${main.model.requests.length} model request at effort ${main.model.requests[0]?.body.output_config?.effort}`);
  });

  await step("3. Its cards match the answer key, in margin-key order, each with its borrows word for word and no reps", async () => {
    const { lines, problems } = await compareWithKey(ada, work.id);
    console.log(lines.join("\n"));
    check(problems.length === 0, problems.length ? problems.join("; ") : "every card matches the key");
    const [a] = await ada.cards.list(work.id);
    const card = await ada.cards.get(a!.id);
    const oldestFirst = card.borrows.every((b, i, list) => i === 0 || list[i - 1]!.time <= b.time);
    check(card.lesson === null && card.reps.length === 0 && card.returnedAt === null && oldestFirst, `card A: lesson ${card.lesson}, ${card.reps.length} reps, returned ${card.returnedAt}, borrows oldest first: ${oldestFirst}`);
    const theirs = await failure(bea.cards.get(a!.id));
    check(theirs?.status === 404, `Bea getting it: ${say(theirs)}`);
  });

  await step("4. Unsorted lists the one-offs, newest first, a page at a time", async () => {
    const page1 = await ada.cards.unsorted(work.id, { limit: 3 });
    const page2 = await ada.cards.unsorted(work.id, { limit: 3, cursor: page1.next! });
    const page3 = await ada.cards.unsorted(work.id, { limit: 3, cursor: page2.next! });
    check(page1.phrasings.length === 3 && page2.phrasings.length === 3 && page3.phrasings.length === 1 && page3.next === null, `pages of 3: ${page1.phrasings.length}, ${page2.phrasings.length}, ${page3.phrasings.length}, then next ${page3.next}`);
    const all = [...page1.phrasings, ...page2.phrasings, ...page3.phrasings];
    const newestFirst = all.every((p, i) => i === 0 || all[i - 1]!.time >= p.time);
    check(newestFirst && all.map((p) => named(p.sourceId)).join(" ") === [...key.oneOffs].reverse().join(" "), `newest first: ${all.map((p) => named(p.sourceId)).join(" ")}`);
    const bad = await failure(ada.cards.unsorted(work.id, { limit: 101 }));
    check(bad?.status === 400, `a limit of 101: ${say(bad)}`);
  });

  await step("5. A later upload is sent with the cards and the recent unsorted, cut to 300 characters, and joins a card", async () => {
    const long = `how do i undo a git commit, here's my whole log: ${"commit 1a2b3c ".repeat(140)}`.slice(0, 2000);
    const [longOne, other] = extra(long, "how do I write a haiku about autumn");
    const before = main.model.requests.length;
    main.model.queue(
      reply((request) => {
        const sent = sortRequest(request);
        const undo = sent.cards.find((c) => c.skill === key.skills[0]!.name)!;
        return { joins: [{ cardId: undo.id, phrasingIds: [sent.phrasings.find((p) => p.text.startsWith("how do i undo a git commit, here"))!.id] }], newSkills: [] };
      }),
    );
    const end = await sortEnds(ada, (await upload(ada, work.id, [longOne!, other!])).id);
    const sent = sortRequest(main.model.requests[before]!);
    check(end.status === "sorted", `the upload ends ${end.status}`);
    check(sent.cards.length === 5 && sent.cards.every((c) => c.samples.length <= 3), `sent ${sent.cards.length} cards, each with at most 3 samples: ${sent.cards.map((c) => c.samples.length).join(", ")}`);
    const undoSamples = sent.cards.find((c) => c.skill === key.skills[0]!.name)!.samples.map((t) => textOf.get(t));
    check(undoSamples.join(" ") === "m1 m5 m8", `card A's samples are its first three borrows: ${undoSamples.join(" ")}`);
    const names = sentNames(main.model.requests[before]!);
    check(sent.phrasings.length === 9 && key.oneOffs.every((id) => names.includes(id)), `sent the 2 new phrasings and the 7 unsorted: ${sent.phrasings.length} (${names.join(" ")})`);
    const cut = sent.phrasings.find((p) => p.text.startsWith("how do i undo a git commit, here"));
    check(cut?.text === long.slice(0, 300), `the 2,000-character phrasing reached the model as its first ${cut?.text.length} characters`);
    const a = await ada.cards.get((await cardNamed(ada, work.id, key.skills[0]!.name))!.id);
    const kept = a.borrows.find((b) => b.sourceId === longOne!.sourceId);
    check(a.count === 10 && kept?.text === long, `card A has ${a.count} borrows, the new one stored whole (${kept?.text.length} characters)`);
    const unsorted = await allUnsorted(ada, work.id);
    check(unsorted.length === 8 && unsorted[0]?.sourceId === other!.sourceId, `the other one waits unsorted, newest: ${unsorted.length} unsorted`);
  });

  await step("6. A new skill named like a card joins it, one of a single phrasing makes no card, and two of one name make one card", async () => {
    const [rebase, squash1, squash2, cat] = extra("rebase my branch onto main", "squash my last three commits into one", "combine several git commits into a single one", "a good name for a grey cat");
    main.model.queue(
      reply((request) => {
        const id = (s: Phrasing) => sortRequest(request).phrasings.find((p) => p.text === s.text)!.id;
        return {
          joins: [],
          newSkills: [
            { name: "UNDO A GIT COMMIT", phrasingIds: [id(rebase!)] },
            { name: "Squash git commits", phrasingIds: [id(squash1!)] },
            { name: " squash git commits ", phrasingIds: [id(squash2!)] },
            { name: "Name a pet ".repeat(10), phrasingIds: [id(cat!)] },
          ],
        };
      }),
    );
    const end = await sortEnds(ada, (await upload(ada, work.id, [rebase!, squash1!, squash2!, cat!])).id);
    check(end.status === "sorted", `the upload ends ${end.status}: ${end.error}`);
    const cards = await ada.cards.list(work.id);
    const a = cards.find((c) => c.skill === key.skills[0]!.name);
    check(a?.count === 11 && !cards.some((c) => c.skill.toLowerCase() === "undo a git commit" && c !== a), `"UNDO A GIT COMMIT" joined card A, now ${a?.count}, and made no card of its own`);
    const squash = cards.find((c) => c.skill.toLowerCase() === "squash git commits");
    check(squash?.count === 2 && squash.skill === "Squash git commits", `the two "Squash git commits" made one card, "${squash?.skill}", of ${squash?.count}`);
    const unsorted = await allUnsorted(ada, work.id);
    check(cards.length === 6 && unsorted.some((p) => p.sourceId === cat!.sourceId), `a skill of one phrasing made no card, even with a 110-character name, and its phrasing is unsorted (${cards.length} cards)`);
  });

  await step("7. An answer that breaks a rule is asked again with the error, and a third bad one fails the sort with no card made", async () => {
    const [r1, r2] = extra("rename a local git branch", "how to change a branch's name in git");
    const before = main.model.requests.length;
    main.model.queue(
      reply({ joins: [{ cardId: "c99", phrasingIds: ["p1"] }], newSkills: [] }),
      reply((request) => ({ joins: [], newSkills: [{ name: "Rename a git branch", phrasingIds: sortRequest(request).phrasings.filter((p) => p.text === r1!.text || p.text === r2!.text).map((p) => p.id) }] })),
    );
    const end = await sortEnds(ada, (await upload(ada, work.id, [r1!, r2!])).id);
    const again = sortRequest(main.model.requests[before + 1]!);
    check(end.status === "sorted" && main.model.requests.length === before + 2, `asked twice, then ${end.status}`);
    check(/c99/.test(again.note) && again.phrasings.length === sortRequest(main.model.requests[before]!).phrasings.length, `the second request adds the error: "${again.note.trim()}"`);
    check((await cardNamed(ada, work.id, "Rename a git branch"))?.count === 2, "and its answer made the card");

    const [s1, s2] = extra("cherry-pick a commit onto another branch", "copy one commit from a branch to mine");
    const cardsBefore = (await ada.cards.list(work.id)).length;
    const both = (request: Parameters<typeof keySorter>[0]) => sortRequest(request).phrasings.filter((p) => p.text === s1!.text || p.text === s2!.text).map((p) => p.id);
    main.model.queue(
      reply((request) => ({ joins: [{ cardId: "c1", phrasingIds: [both(request)[0]] }], newSkills: [{ name: "Cherry-pick a commit", phrasingIds: both(request) }] })),
      reply({ joins: [], newSkills: [{ name: "Cherry-pick a commit", phrasingIds: ["p1", "p999"] }] }),
      reply((request) => ({ joins: [], newSkills: [{ name: `Cherry-pick a commit ${"onto a branch ".repeat(5)}`, phrasingIds: both(request) }] })),
    );
    const failed = await sortEnds(ada, (await upload(ada, work.id, [s1!, s2!])).id);
    const notes = main.model.requests.slice(-2).map((r) => sortRequest(r).note);
    check(failed.status === "failed" && failed.offered === 0, `three bad answers: ${failed.status}, ${failed.offered} offered`);
    check(/3 times/.test(failed.error ?? "") && /longer than 60 characters/.test(failed.error ?? "") && !/cherry/i.test(failed.error ?? ""), `the upload says "${failed.error}"`);
    check(/placed phrasing p\d+ twice/.test(notes[0]!) && /p999/.test(notes[1]!), `each retry named the error before it: "${notes[0]!.trim()}" / "${notes[1]!.trim()}"`);
    check((await ada.cards.list(work.id)).length === cardsBefore, "no card was made");
    const unsorted = await allUnsorted(ada, work.id);
    check(!unsorted.some((p) => p.sourceId === s1!.sourceId), "and its phrasings aren't unsorted: no sort has seen them");
    failedUpload = failed.id;
  });

  await step("8. Retrying a failed sort, with an API key too, carries on with the same upload; retrying anything else is a 409, and another account's a 404", async () => {
    const script = createClient({ baseUrl: main.app.url, apiKey: (await ada.keys.create({ name: "Sort script" })).key });
    const retried = await script.uploads.retry(failedUpload);
    check(retried.status === "waiting" && retried.error === null, `the key's retry answers ${retried.status}, error ${retried.error}`);
    const end = await sortEnds(ada, failedUpload);
    check(end.status === "sorted" && end.offered === 2, `then ends ${end.status}, ${end.offered} offered`);
    const twice = await failure(ada.uploads.retry(failedUpload));
    check(twice?.status === 409, `retrying a sorted upload: ${say(twice)}`);
    const theirs = await failure(bea.uploads.retry(failedUpload));
    check(theirs?.status === 404, `Bea retrying it: ${say(theirs)}`);
  });

  const small = await copy({ SORT_BATCH_SIZE: "10" });
  await step("9. With a batch size of 10, a sort that fails midway resumes on retry from the first phrasing not yet offered", async () => {
    const shelf = await small.client.shelves.create({ name: "Bootcamp" });
    small.model.queue(reply(keySorter), refuse());
    const failed = await sortEnds(small.client, (await upload(small.client, shelf.id, phrasings)).id);
    check(failed.status === "failed" && failed.offered === 10 && failed.error === "The model request failed (400).", `batch 2 failed: ${failed.status}, ${failed.offered} of ${failed.phrasings} offered, "${failed.error}"`);
    const [first, second] = small.model.requests.map(sentNames);
    check(first!.join(" ") === "m1 m2 m3 m4 m5 m6 m7 m8 m9 m10", `batch 1 was ${first!.join(" ")}`);
    check(second!.slice(0, 10).join(" ") === "m11 m12 m13 m14 m15 m16 m17 m18 m19 m20" && second!.slice(10).join(" ") === "m9 m7 m6 m4 m2", `batch 2 was m11 to m20 with the window ${second!.slice(10).join(" ")}`);
    await small.client.uploads.retry(failed.id);
    const end = await sortEnds(small.client, failed.id);
    const resumed = sentNames(small.model.requests[2]!);
    check(resumed.slice(0, 10).join(" ") === "m11 m12 m13 m14 m15 m16 m17 m18 m19 m20", `the retry starts again at m11: ${resumed.slice(0, 10).join(" ")}`);
    check(end.status === "sorted" && small.model.requests.length === 4, `then ends ${end.status}, in ${small.model.requests.length} requests in all`);
    const { problems } = await compareWithKey(small.client, shelf.id);
    check(problems.length === 0, problems.length ? problems.join("; ") : "and its cards match the key");
  });

  await step("10. Sorts run one at a time on a shelf, and side by side across shelves", async () => {
    const one = await small.client.shelves.create({ name: "One" });
    const other = await small.client.shelves.create({ name: "Other" });
    const before = small.model.requests.length;
    const held = hold();
    small.model.queue(held.answer);
    const first = await upload(small.client, one.id, phrasings.slice(0, 5));
    await held.reached;
    const second = await upload(small.client, one.id, phrasings.slice(5, 10));
    const elsewhere = await upload(small.client, other.id, phrasings.slice(0, 5));
    await small.model.arrived(before + 2);
    await Bun.sleep(500);
    const waiting = await small.client.uploads.get(second.id);
    check(small.model.requests.length === before + 2, `with One's first sort held, Other's sort still asked the model (${small.model.requests.length - before} requests)`);
    check(waiting.status === "waiting", `and One's second upload waits: ${waiting.status}`);
    held.release(reply(keySorter));
    const ends = [await sortEnds(small.client, first.id), await sortEnds(small.client, second.id), await sortEnds(small.client, elsewhere.id)];
    check(ends.every((u) => u.status === "sorted") && small.model.requests.length === before + 3, `all three end ${ends.map((u) => u.status).join(", ")}, in ${small.model.requests.length - before} requests`);
  });

  await step("11. Deleting a shelf stops its sort", async () => {
    const doomed = await small.client.shelves.create({ name: "Doomed" });
    const held = hold();
    small.model.queue(held.answer);
    const sorting = await upload(small.client, doomed.id, phrasings);
    await held.reached;
    const asked = small.model.requests.length;
    await small.client.shelves.delete(doomed.id);
    held.release(reply(keySorter));
    await Bun.sleep(1000);
    check(small.model.requests.length === asked, `after its first batch's answer came back, no more were asked (${small.model.requests.length - asked} more)`);
    const gone = await failure(small.client.uploads.get(sorting.id));
    const odd = small.app.log().trim().split("\n").slice(1).filter((line) => !/^(GET|POST|PATCH|DELETE) \/\S* \d{3} \d+ms$/.test(line));
    check(gone?.status === 404 && odd.length === 0, `its upload is ${say(gone)}, and the app logged its requests and nothing else${odd.length ? `: ${odd.slice(0, 3).join(" | ")}` : ""}`);
  });

  await step("12. A sort a restart cuts off carries on when the app starts again", async () => {
    const dir = await mkdtemp(join(tmpdir(), "asked-before-restart-"));
    const env = { DATABASE_PATH: join(dir, "app.sqlite") };
    const model = await startModelStub(reply(keySorter));
    models.push(model);
    try {
      const before = await startApp({ ANTHROPIC_BASE_URL: model.url, ...env });
      const learner = before.browser().client;
      await learner.auth.signUp({ name: "Cy Example", email: "cy@example.com", password: "jacquard loom" });
      const shelf = await learner.shelves.create({ name: "Restarted" });
      const held = hold();
      model.queue(held.answer);
      const cut = await upload(learner, shelf.id, phrasings);
      await held.reached;
      await before.stop();
      held.release(refuse());
      const after = await startApp({ ANTHROPIC_BASE_URL: model.url, ...env });
      apps.push(after);
      const again = after.browser().client;
      await again.auth.logIn({ email: "cy@example.com", password: "jacquard loom" });
      const end = await sortEnds(again, cut.id);
      check(end.status === "sorted" && model.requests.length === 2, `the restarted app asked the model again and the upload ends ${end.status}`);
      const { problems } = await compareWithKey(again, shelf.id);
      check(problems.length === 0, problems.length ? problems.join("; ") : "and its cards match the key");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  const capped = await copy({ DAILY_MODEL_REQUESTS: "2" });
  await step("13. Past the daily cap, the next model request gets 429, and the upload says so", async () => {
    const shelf = await capped.client.shelves.create({ name: "Capped" });
    const first = await sortEnds(capped.client, (await upload(capped.client, shelf.id, phrasings.slice(0, half))).id);
    const second = await sortEnds(capped.client, (await upload(capped.client, shelf.id, phrasings.slice(half))).id);
    check(first.status === "sorted" && second.status === "sorted" && capped.model.requests.length === 2, `two sorts spend the day's 2 requests: ${first.status}, ${second.status}`);
    const third = await sortEnds(capped.client, (await upload(capped.client, shelf.id, extra("how do i undo a commit i already pushed", "push a branch to a new remote"))).id);
    check(third.status === "failed" && /today's 2 model requests/.test(third.error ?? "") && capped.model.requests.length === 2, `the third: ${third.status}, "${third.error}", and the model wasn't asked (${capped.model.requests.length} requests)`);
    await capped.client.uploads.retry(third.id);
    const retried = await sortEnds(capped.client, third.id);
    check(retried.status === "failed" && /today's 2 model requests/.test(retried.error ?? ""), `retried the same day, it fails again: "${retried.error}"`);
  });

  await step("14. The logs hold no phrasing", async () => {
    const leaked = apps.filter((app) => [...phrasings.map((p) => p.text), "squash my last three commits into one"].some((text) => app.log().includes(text)));
    check(leaked.length === 0, `${apps.length} apps' logs, ${leaked.length} holding a phrasing`);
  });
} finally {
  await Promise.all(apps.map((app) => app.stop()));
  for (const model of models) model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
