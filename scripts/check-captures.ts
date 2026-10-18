// Checks captures (m1kuorg/basics#50) through the SDK, on a fresh copy of
// the app whose model is a stand-in in this script, never in the app: it
// sorts the demo export's upload as the answer key does, and answers each
// capture's sort with the reply queued for it. On the demo shelf: a
// capture with a card's phrasing word for word, ignoring case and spacing,
// joins that card without the model; the same words again within ten
// minutes return that capture with no new borrow, and after ten minutes
// add one; a rephrasing is one sort request at low effort, holding the
// cards and the capture with the recent unsorted, never a time, and joins
// its card; a question nothing asks waits unsorted; in an empty shelf
// the model isn't asked, and a second capture asking the same thing makes
// a card of the two. Then the sort's checks (an answer breaking a rule is
// asked again), a model failure or a deleted shelf storing nothing, a
// capture after a return stamp making the card borrowed again, an API key,
// 404, 401, 400 and 413, an answer moving only the capture, the 50 most
// recent unsorted, the daily cap's 429, and logs without the words.
// It prints ids, counts, statuses, and the app's messages, and exits 1 if
// any check fails, naming the step.
// Run: bun run check:captures

import { ApiError, createClient, MAX_PHRASING_LENGTH, type Capture } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { allUnsorted, key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, reply, sortRequest, startModelStub, type ModelRequest } from "./lib/model-stub";
import { kindOf, repReply, sortsByKey, verdictReply } from "./lib/reps";

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
    check(false, `threw ${error instanceof ApiError ? `${error.status} ` : ""}${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

/** True when a sort request holds only short ids, skills, samples, and texts, and neither `time` nor its day. */
const timeless = (request: ModelRequest, time: string) => {
  const { cards, phrasings: sent } = sortRequest(request);
  const keys = (items: object[], want: string) => items.every((item) => Object.keys(item).sort().join() === want);
  return keys(cards, "id,samples,skill") && keys(sent, "id,text") && ![time, time.slice(0, 10), String(Date.parse(time))].some((t) => request.user.includes(t));
};
const textOf = new Map(phrasings.map((p) => [p.text, named(p.sourceId)]));
/** The names of a sort request's phrasings: m1 and so on for the demo export's, else "new". */
const sentNames = (request: ModelRequest) => sortRequest(request).phrasings.map((p) => textOf.get(p.text) ?? "new");
/** A stand-in's answer that puts the phrasing with `text` on the card with `skill`. */
const joinTo = (skill: string, text: string) =>
  reply((request) => {
    const sent = sortRequest(request);
    return { joins: [{ cardId: sent.cards.find((c) => c.skill === skill)!.id, phrasingIds: [sent.phrasings.find((p) => p.text === text)!.id] }], newSkills: [] };
  });

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

const model = await startModelStub(sortsByKey());
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });

try {
  const demo = await ada.client.shelves.create({ name: "Demo", demo: true });
  await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
  const [cardA] = await ada.client.cards.list(demo.id);

  let first: Capture;

  await step("1. A capture with a card's phrasing word for word, ignoring case and spacing, joins that card without the model", async () => {
    const before = model.requests.length;
    first = await ada.client.captures.create(demo.id, { text: "  How do I UNDO my last\tgit   commit " });
    check(first.card?.id === cardA!.id && first.card.count === 10 && !first.alreadyCaptured, `it landed on card A, now ${first.card?.count} borrows, already captured ${first.alreadyCaptured}`);
    check(model.requests.length === before, `${model.requests.length - before} model requests`);
    const age = Date.now() - Date.parse(first.phrasing.time);
    check(age >= 0 && age < 5_000 && first.phrasing.sourceId !== "" && first.phrasing.text === "How do I UNDO my last\tgit   commit", `stamped by the server's clock ${age}ms ago, with source id ${first.phrasing.sourceId}, its words trimmed`);
  });

  await step("2. The same words again within ten minutes return that capture, with no new borrow; after ten minutes they add one", async () => {
    const before = model.requests.length;
    const response = await fetch(`${app.url}/api/v1/shelves/${demo.id}/captures`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: app.url, cookie: ada.cookie() },
      body: JSON.stringify({ text: "how do i undo my last git commit" }),
    });
    const again = (await response.json()) as Capture;
    check(response.status === 200 && again.alreadyCaptured && again.phrasing.id === first.phrasing.id, `${response.status}, already captured ${again.alreadyCaptured}, the earlier capture: ${again.phrasing.id === first.phrasing.id}`);
    check(again.card?.id === cardA!.id && again.card.count === 10, `card A still has ${again.card?.count} borrows`);
    check(model.requests.length === before, `${model.requests.length - before} model requests`);

    // A capture's time is the server's clock, which no endpoint sets, so the ten minutes pass here, in the database, rather than in a ten-minute wait:
    // the one write a check makes to the local database, the read-only rule's documented exception (docs/code-map.md).
    const db = new Database(app.databasePath, { strict: true });
    db.query("UPDATE phrasings SET time = time - 11 * 60 * 1000 WHERE id = $id").run({ id: first.phrasing.id });
    db.close();
    const later = await ada.client.captures.create(demo.id, { text: "how do i undo my last git commit" });
    check(!later.alreadyCaptured && later.phrasing.id !== first.phrasing.id && later.card?.count === 11, `once the first is 11 minutes old: already captured ${later.alreadyCaptured}, card A now ${later.card?.count}`);
  });

  await step("3. A rephrasing is sorted at once, at low effort, against the cards and the recent unsorted, and joins its card", async () => {
    const text = "how do I take back the commit I just made in git?";
    const before = model.requests.length;
    model.queue(joinTo(key.skills[0]!.name, text));
    const captured = await ada.client.captures.create(demo.id, { text });
    const sent = model.requests.slice(before);
    check(sent.length === 1 && kindOf(sent[0]!) === "sort" && sent[0]!.body.output_config?.effort === "low", `${sent.length} model request: a ${sent[0] && kindOf(sent[0])} at effort ${sent[0]?.body.output_config?.effort}`);
    const request = sortRequest(sent[0]!);
    check(request.cards.length === 5 && request.cards.every((c) => c.samples.length <= 3), `it sent the shelf's ${request.cards.length} cards, each with up to 3 samples`);
    const names = sentNames(sent[0]!);
    check(names[0] === "new" && names.length === 1 + key.oneOffs.length && key.oneOffs.every((id) => names.includes(id)), `and the capture first, then the unsorted: ${names.join(" ")}`);
    check(timeless(sent[0]!, captured.phrasing.time), "it held only short ids, skills, samples, and texts: no time");
    check(captured.card?.id === cardA!.id && captured.card.count === 12 && captured.card.status === "borrowed", `it landed on card A, now ${captured.card?.count} borrows, ${captured.card?.status}`);
    const stored = await ada.client.cards.get(cardA!.id);
    check(stored.borrows.at(-1)?.id === captured.phrasing.id && stored.borrows.at(-1)?.text === text, "card A's latest borrow is the capture, word for word");
  });

  await step("4. A question nothing asks yet waits unsorted, newest of the shelf's unsorted, and makes no card", async () => {
    const text = "how do I tune a ukulele by ear";
    const before = model.requests.length;
    model.queue(reply({ joins: [], newSkills: [] }));
    const captured = await ada.client.captures.create(demo.id, { text });
    check(model.requests.length === before + 1 && captured.card === null && !captured.alreadyCaptured, `${model.requests.length - before} model request; card ${captured.card?.skill ?? null}`);
    const unsorted = await ada.client.cards.unsorted(demo.id);
    check(unsorted.phrasings[0]?.id === captured.phrasing.id && unsorted.phrasings[0]?.text === text, "it's the newest unsorted phrasing, word for word");
    check((await ada.client.cards.list(demo.id)).length === 5, "the shelf still has 5 cards");
  });

  await step("5. With no cards and nothing unsorted, a capture waits unsorted without the model; one asking the same makes a card of the two", async () => {
    const work = await ada.client.shelves.create({ name: "Work" });
    const before = model.requests.length;
    const one = await ada.client.captures.create(work.id, { text: "rename a local git branch" });
    check(model.requests.length === before && one.card === null, `${model.requests.length - before} model requests; card ${one.card?.skill ?? null}`);
    const two = "how to change a branch's name in git";
    model.queue(
      reply((request) => {
        const sent = sortRequest(request).phrasings;
        return { joins: [], newSkills: [{ name: "Rename a git branch", phrasingIds: sent.map((p) => p.id) }] };
      }),
    );
    const captured = await ada.client.captures.create(work.id, { text: two });
    const sent = sortRequest(model.requests.at(-1)!);
    check(sent.cards.length === 0 && sent.phrasings.map((p) => p.text).join(" | ") === `${two} | rename a local git branch`, `the model saw the capture and the one unsorted: ${sent.phrasings.length} phrasings, ${sent.cards.length} cards`);
    check(captured.card?.skill === "Rename a git branch" && captured.card.count === 2 && captured.card.status === "borrowed", `it made "${captured.card?.skill}", ${captured.card?.count} borrows, ${captured.card?.status}`);
    const unsorted = await ada.client.cards.unsorted(work.id);
    check(unsorted.phrasings.length === 0, `${unsorted.phrasings.length} unsorted left`);
    await ada.client.shelves.delete(work.id);
  });

  await step("6. A sort answer that breaks a rule is asked again with the error; a model failure stores nothing, so the capture can be sent again", async () => {
    const text = "git undo the commit I made a minute ago";
    let before = model.requests.length;
    model.queue(reply({ joins: [{ cardId: "c99", phrasingIds: ["p1"] }], newSkills: [] }), joinTo(key.skills[0]!.name, text));
    const fixed = await ada.client.captures.create(demo.id, { text });
    const again = sortRequest(model.requests.at(-1)!);
    check(model.requests.length === before + 2 && /c99/.test(again.note) && fixed.card?.id === cardA!.id, `asked ${model.requests.length - before} times, the second with the error ("${again.note.trim().slice(0, 60)}..."), then on card A`);

    const lost = "how can I see which commit introduced a bug";
    const unsortedBefore = (await ada.client.cards.unsorted(demo.id)).phrasings.length;
    model.queue(refuse());
    const refused = await failure(ada.client.captures.create(demo.id, { text: lost }));
    check(refused?.status === 502, `a refused model request: ${say(refused)}`);
    const bad = { joins: [], newSkills: [{ name: "Find a bug\nwith git", phrasingIds: ["p1", "p2"] }] };
    model.queue(reply(bad), reply(bad), reply(bad));
    const broken = await failure(ada.client.captures.create(demo.id, { text: lost }));
    check(broken?.status === 502 && /3 times/.test(broken.message), `three answers breaking a rule: ${say(broken)}`);
    const unsortedAfter = (await ada.client.cards.unsorted(demo.id)).phrasings.length;
    check(unsortedAfter === unsortedBefore && (await ada.client.cards.list(demo.id)).length === 5, `nothing was stored: ${unsortedAfter} unsorted, as before`);
    before = model.requests.length;
    model.queue(reply({ joins: [], newSkills: [] }));
    const sent = await ada.client.captures.create(demo.id, { text: lost });
    check(!sent.alreadyCaptured && sent.card === null && model.requests.length === before + 1, `sent again, it's sorted afresh: already captured ${sent.alreadyCaptured}, unsorted`);
  });

  await step("7. A shelf deleted while its capture is with the model is a 404, and keeps nothing", async () => {
    const gone = await ada.client.shelves.create({ name: "Gone soon" });
    await ada.client.captures.create(gone.id, { text: "how do I list docker containers" });
    const held = hold();
    model.queue(held.answer);
    const pending = failure(ada.client.captures.create(gone.id, { text: "show running docker containers" }));
    await held.reached;
    await ada.client.shelves.delete(gone.id);
    held.release(reply({ joins: [], newSkills: [] }));
    const refused = await pending;
    check(refused?.status === 404, `the capture: ${say(refused)}`);
  });

  await step("8. A capture dated after a card's return stamp makes it borrowed again", async () => {
    model.queue(repReply("A stand-in's problem."), verdictReply("pass", "A stand-in's reason."));
    const { rep } = await ada.client.reps.start(cardA!.id);
    const { card } = await ada.client.reps.check(rep.id, { answer: "A stand-in's answer." });
    check(card.status === "returned", `after a pass, card A is ${card.status}`);
    // A borrow in the same millisecond as the pass leaves the card returned, and a capture that needs no model can be that quick.
    await Bun.sleep(5);
    const captured = await ada.client.captures.create(demo.id, { text: "revert last commit git" });
    check(captured.card?.id === cardA!.id && captured.card.status === "borrowed_again" && captured.card.returnedAt === card.returnedAt, `then a capture of its words: ${captured.card?.status}, return stamp kept`);
  });

  await step("9. An API key may capture; another account's shelf is a 404, no account a 401, a bad body a 400, a long one a 413", async () => {
    const { key: apiKey } = await ada.client.keys.create({ name: "Agent" });
    const agent = createClient({ baseUrl: app.url, apiKey });
    model.queue(reply({ joins: [], newSkills: [] }));
    const byKey = await agent.captures.create(demo.id, { text: "how do I write a haiku" });
    check(byKey.card === null && !byKey.alreadyCaptured, "an API key's capture is recorded");

    const bea = app.browser().client;
    await bea.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const theirs = await failure(bea.captures.create(demo.id, { text: "how do i undo my last git commit" }));
    check(theirs?.status === 404, `Bea capturing into Ada's shelf: ${say(theirs)}`);
    const nobody = await fetch(`${app.url}/api/v1/shelves/${demo.id}/captures`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"text":"hello"}' });
    check(nobody.status === 401, `no session or key: ${nobody.status}`);

    for (const [what, body] of [
      ["no text", {}],
      ["blank text", { text: "  \n " }],
      ["text that isn't a string", { text: 7 }],
      ["a time beside the text", { text: "how do I undo a commit", time: "2026-01-01T00:00:00Z" }],
    ] as const) {
      const bad = await failure(agent.captures.create(demo.id, body as never));
      check(bad?.status === 400, `${what}: ${say(bad)}`);
    }
    const long = await failure(agent.captures.create(demo.id, { text: "x".repeat(MAX_PHRASING_LENGTH + 1) }));
    check(long?.status === 413, `${MAX_PHRASING_LENGTH + 1} characters: ${say(long)}`);
    const trimmed = await agent.captures.create(demo.id, { text: `${"y".repeat(MAX_PHRASING_LENGTH)}\n` });
    check(trimmed.phrasing.text.length === MAX_PHRASING_LENGTH, `${MAX_PHRASING_LENGTH} characters and a newline are kept, trimmed`);
  });

  await step("10. A capture's sort moves only the capture: other phrasings its answer places wait for the next upload's sort", async () => {
    const text = "how do i back out a commit i made by accident";
    const id = (request: ModelRequest, name: string) => sortRequest(request).phrasings.find((p) => textOf.get(p.text) === name)!.id;
    model.queue(
      reply((request) => {
        const sent = sortRequest(request);
        const capture = sent.phrasings.find((p) => p.text === text)!.id;
        const undoCard = sent.cards.find((c) => c.skill === key.skills[0]!.name)!.id;
        return { joins: [{ cardId: undoCard, phrasingIds: [capture, id(request, "m7")] }], newSkills: [{ name: "Explain a concept simply", phrasingIds: [id(request, "m9"), id(request, "m25")] }] };
      }),
    );
    const before = (await ada.client.cards.get(cardA!.id)).count;
    const captured = await ada.client.captures.create(demo.id, { text });
    check(captured.card?.id === cardA!.id && captured.card.count === before + 1, `the capture joined card A, now ${captured.card?.count}`);
    const unsorted = (await allUnsorted(ada.client, demo.id)).map((p) => named(p.sourceId));
    const cards = await ada.client.cards.list(demo.id);
    check(["m7", "m9", "m25"].every((m) => unsorted.includes(m)) && cards.length === 5, `m7, m9, and m25 still wait unsorted, and the shelf still has ${cards.length} cards`);
  });

  await step("11. A capture is compared with the 50 most recent unsorted phrasings", async () => {
    const backlog = Array.from({ length: 60 }, (_, i) => ({ sourceId: `backlog-${i}`, text: `a one-off question, number ${i}`, time: new Date(Date.UTC(2026, 9, 1, 9, i)).toISOString() }));
    await sortEnds(ada.client, (await upload(ada.client, demo.id, backlog, "backlog.json")).id);
    // The model sees each text cut to 300 characters.
    const newest = (await allUnsorted(ada.client, demo.id)).slice(0, 50).map((p) => p.text.slice(0, 300));
    model.queue(reply({ joins: [], newSkills: [] }));
    await ada.client.captures.create(demo.id, { text: "how do I juggle three balls" });
    const sent = sortRequest(model.requests.at(-1)!).phrasings.map((p) => p.text);
    check(sent.length === 51 && sent[0] === "how do I juggle three balls" && sent.slice(1).join("|") === newest.join("|"), `it sent the capture and ${sent.length - 1} unsorted, the newest 50 of ${(await allUnsorted(ada.client, demo.id)).length - 1}`);
  });

  await step("12. Past the daily cap, a capture the model must sort is a 429 and keeps nothing; the same words again need no model", async () => {
    const capped = await startApp({ ANTHROPIC_BASE_URL: model.url, DAILY_MODEL_REQUESTS: "1" });
    try {
      const { client } = capped.browser();
      await client.auth.signUp({ name: "Cy Example", email: "cy@example.com", password: "jacquard loom" });
      const work = await client.shelves.create({ name: "Work" });
      await client.captures.create(work.id, { text: "what does chmod 755 mean" });
      model.queue(reply({ joins: [], newSkills: [] }));
      await client.captures.create(work.id, { text: "how do I make a script executable" });
      const before = model.requests.length;
      const over = await failure(client.captures.create(work.id, { text: "give a file permission to run" }));
      check(over?.status === 429 && model.requests.length === before, `the third, past a cap of 1: ${say(over)}, ${model.requests.length - before} model requests`);
      const unsorted = await client.cards.unsorted(work.id);
      check(unsorted.phrasings.length === 2, `${unsorted.phrasings.length} unsorted kept`);
      const again = await client.captures.create(work.id, { text: "what does chmod 755 mean" });
      check(again.alreadyCaptured, `the first again: already captured ${again.alreadyCaptured}`);
    } finally {
      await capped.stop();
    }
  });
} finally {
  await app.stop();
  model.stop();
}

current = "13. The app's logs hold none of the captures' words";
console.log(`\n${current}`);
const words = ["git   commit", "take back the commit", "tune a ukulele", "change a branch's name", "minute ago", "introduced a bug", "docker containers", "write a haiku"];
const leaked = words.filter((text) => app.log().includes(text));
check(leaked.length === 0, `${words.length} looked for, ${leaked.length} found${leaked.length ? `: ${leaked.join(", ")}` : ""}`);

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nCaptures hold up.");
