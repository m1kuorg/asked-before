// Checks the rules of cold reps (m1kuorg/basics#46) through the SDK, on a
// fresh copy of the app whose model is a stand-in in this script, never in
// the app: it sorts as the demo export's answer key does, and answers each
// rep and check request with the reply queued for it. On the demo
// shelf's card A: the lesson is written with the first rep and kept,
// returned again after a failed rep and not after a pass; a rep is written
// from the card's phrasings and earlier problems, never a time; a check
// sends only the skill, the problem, and the answer; a pass stamps the card
// returned; a rep is checked once (409), and starting another leaves the
// open one unchecked for good (409). Uploading a small export with a newer
// phrasing of card A's skill makes it borrowed again. Then the edges:
// another account's card or rep is a 404, an API key may take reps, bad
// bodies are 400 and a long answer 413, a model failure stores nothing,
// the daily cap counts reps and checks, and deleting an upload that leaves
// a card under two borrows deletes the card's reps. The app logs none of
// the texts. It prints ids, counts, statuses, and the app's messages, and
// exits 1 if any check fails, naming the step.
// Run: bun run check:rep-rules

import { ApiError, createClient, MAX_CHUNK, type Card, type Client, type Phrasing, type Shelf, type Rep } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { checkRequest, kindOf, known, repReply, repRequest, smallExport, sortsByKey, stopped, verdictReply } from "./lib/reps";

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

// Rep and check requests nobody queued an answer for are refused, and counted, so nothing here reaches the real model.
const unqueued: string[] = [];
const also = new Map<string, string>();
const model = await startModelStub(
  sortsByKey((request, raw, body) => {
    unqueued.push(kindOf(request));
    return refuse()(request, raw, body);
  }, also),
);
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });

/** Every text a model stand-in wrote or an answer held, to look for in the logs at the end. */
const texts: string[] = [known.wrong, known.right];
const lastRequest = () => model.requests.at(-1)!;
const newRequests = (since: number) => model.requests.slice(since);
const TIME = /\d{4}-\d{2}-\d{2}|\b1[67]\d{11}\b/;
const today = () => new Date().toISOString().slice(0, 10);

/** Starts a rep on the card with the stand-in answering `problem`, and `lesson` if the app asks for one. */
async function start(client: Client, cardId: string, problem: string, lesson?: string) {
  texts.push(problem, ...(lesson ? [lesson] : []));
  model.queue(repReply(problem, lesson));
  return client.reps.start(cardId);
}

/** Checks the rep with the stand-in answering `verdict` and `reason`. */
async function answer(client: Client, repId: string, text: string, verdict: "pass" | "fail", reason: string) {
  texts.push(reason);
  model.queue(verdictReply(verdict, reason));
  return client.reps.check(repId, { answer: text });
}

/** Uploads phrasings onto a shelf as the page does, from an export of `source`, and waits for the sort. */
async function uploadExport(client: Client, shelfId: string, source: "chatgpt" | "claude", list: Phrasing[], fileName: string) {
  const made = await client.uploads.create(shelfId, { source, fileName });
  for (let i = 0; i < list.length; i += MAX_CHUNK) await client.uploads.append(made.id, list.slice(i, i + MAX_CHUNK));
  await client.uploads.finish(made.id);
  return sortEnds(client, made.id);
}

let demo: Shelf;
/** When card A was first stamped returned. */
let returnedAt: string | null = null;
let A: Card;
let B: Card;
let C: Card;
const LESSON = "Move the branch back with git reset, or add a commit that undoes it with git revert once it's shared.";
const reps: Rep[] = [];

try {
  await step("1. The demo shelf, sorted as the answer key sorts it", async () => {
    demo = await ada.client.shelves.create({ name: "Demo", demo: true });
    const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
    [A, B, C] = (await ada.client.cards.list(demo.id)) as [Card, Card, Card];
    check(sorted.status === "sorted" && A.skill === known.skill && A.status === "borrowed", `card A is "${A.skill}", ${A.status}, ${A.count} borrows`);
  });

  await step("2. The first cold rep writes the lesson, from the card's phrasings and nothing else, never a time", async () => {
    const before = model.requests.length;
    const { rep, lesson } = await start(ada.client, A.id, "Problem one: you committed to main by mistake. What do you do?", LESSON);
    reps.push(rep);
    check(rep.problem.startsWith("Problem one") && lesson === LESSON, `the rep brings its problem and the lesson (${lesson === LESSON ? "the one written" : lesson})`);
    check(rep.answer === null && rep.verdict === null && rep.reason === null && rep.checkedAt === null, "the rep is unchecked");
    const sent = newRequests(before);
    check(sent.length === 1 && kindOf(sent[0]!) === "rep", `one model request, a rep (${sent.map(kindOf).join(", ")})`);
    const asked = repRequest(lastRequest());
    const card = await ada.client.cards.get(A.id);
    check(asked.skill === A.skill && asked.withLesson, `it asks for the lesson and a problem of "${asked.skill}"`);
    check(asked.phrasings.join("\n") === card.borrows.map((b) => b.text).join("\n"), `it sends the card's ${asked.phrasings.length} phrasings, oldest first`);
    check(asked.earlierProblems.length === 0, "with no earlier problems");
    check(!TIME.test(lastRequest().user) && lastRequest().body.output_config?.effort === "medium", `no time reaches the model, and the effort is ${lastRequest().body.output_config?.effort}`);
    check(card.lesson === LESSON && card.reps.length === 1 && card.reps[0]?.id === rep.id, `the card keeps the lesson and the rep (${card.reps.length})`);
  });

  await step("3. The known wrong answer fails; checking it again is a 409, with no model request", async () => {
    const before = model.requests.length;
    const { rep, card } = await answer(ada.client, reps[0]!.id, known.wrong, "fail", "You chose git stash, which sets aside uncommitted changes and leaves the commit in place.");
    check(rep.verdict === "fail" && rep.reason?.includes("git stash") === true && rep.answer === known.wrong && rep.checkedAt !== null, `the rep failed, with its reason and your answer (${rep.verdict})`);
    check(card.id === A.id && card.status === "borrowed" && card.returnedAt === null, `card A stays ${card.status}`);
    const sent = checkRequest(lastRequest());
    check(Object.keys(sent).join() === "skill,problem,answer" && sent.skill === A.skill && sent.problem === reps[0]!.problem && sent.answer === known.wrong, `the check sends only the skill, the problem, and your answer (${Object.keys(sent).join(", ")})`);
    check(lastRequest().body.output_config?.effort === "medium", `at ${lastRequest().body.output_config?.effort} effort`);
    const again = await failure(ada.client.reps.check(reps[0]!.id, { answer: known.right }));
    check(again?.status === 409, `checking it again: ${say(again)}`);
    check(model.requests.length === before + 1, "the second check never reached the model");
  });

  await step("4. After a failed rep, the next start returns the lesson again, with the earlier problem sent", async () => {
    const { rep, lesson } = await start(ada.client, A.id, "Problem two: a commit on your laptop holds a typo. What do you do?", "A lesson the app must not keep.");
    reps.push(rep);
    check(lesson === LESSON, `the lesson again, the first one kept (${lesson === LESSON ? "same" : lesson})`);
    const asked = repRequest(lastRequest());
    check(!asked.withLesson && asked.earlierProblems.join() === reps[0]!.problem, `the request asks for a problem only, and sends the ${asked.earlierProblems.length} earlier problem`);
    check((await ada.client.cards.get(A.id)).lesson === LESSON, "the card's lesson is unchanged");
  });

  await step("5. The known right answer passes and stamps card A returned today, on the card and the stack", async () => {
    const { rep, card } = await answer(ada.client, reps[1]!.id, known.right, "pass", "You undo the commit with git reset HEAD~1 and keep the changes in your files.");
    returnedAt = card.returnedAt;
    check(rep.verdict === "pass" && card.status === "returned" && card.returnedAt === rep.checkedAt, `card A is ${card.status}, stamped ${card.returnedAt}`);
    check(card.returnedAt?.slice(0, 10) === today(), `the stamp is today, ${today()}`);
    const listed = (await ada.client.cards.list(demo.id)).find((c) => c.id === A.id);
    check(listed?.status === "returned" && listed.returnedAt === rep.checkedAt, `the stack lists it ${listed?.status}`);
    const { counts } = await ada.client.shelves.get(demo.id);
    check(counts.returned === 1 && counts.borrowed === key.skills.length - 1 && counts.borrowedAgain === 0, `the shelf counts ${JSON.stringify(counts)}`);
  });

  await step("6. After a pass, a start brings no lesson; a newer start leaves the open rep unchecked for good (409)", async () => {
    const third = await start(ada.client, A.id, "Problem three: you committed the wrong file and pushed nothing. What do you do?");
    reps.push(third.rep);
    check(third.lesson === null, `no lesson after a pass (${third.lesson})`);
    const asked = repRequest(lastRequest());
    check(asked.earlierProblems.join("|") === reps.slice(0, 2).map((r) => r.problem).join("|"), `both earlier problems are sent (${asked.earlierProblems.length})`);
    const fourth = await start(ada.client, A.id, "Problem four: a teammate already pulled your commit. What do you do?");
    reps.push(fourth.rep);
    check(fourth.lesson === null, "nor on the next");
    const before = model.requests.length;
    const left = await failure(ada.client.reps.check(third.rep.id, { answer: known.right }));
    check(left?.status === 409 && /newer cold rep/.test(left.message), `checking the rep left for a newer one: ${say(left)}`);
    check(model.requests.length === before, "never reached the model");
    const { card } = await answer(ada.client, fourth.rep.id, known.wrong, "fail", "You chose git stash, which leaves the pushed commit where it is.");
    check(card.status === "returned" && card.returnedAt === returnedAt, `a failed rep after a pass leaves card A ${card.status}`);
    const fifth = await start(ada.client, A.id, "Problem five: you want your edits back in your files, not committed. What do you do?");
    reps.push(fifth.rep);
    check(fifth.lesson === LESSON, "after that failed rep, the lesson comes again");
    const stored = (await ada.client.cards.get(A.id)).reps;
    check(stored.map((r) => r.id).join() === reps.map((r) => r.id).join(), `the card keeps its ${stored.length} reps, oldest first`);
    check(stored[2]?.checkedAt === null && stored[4]?.checkedAt === null, "the left one and the latest are unchecked");
  });

  await step("7. Uploading a small export with a newer phrasing of card A's skill makes it borrowed again", async () => {
    const newer = "how do i take back the git commit i made a minute ago";
    texts.push(newer);
    also.set(newer, A.skill);
    const read = await smallExport([{ text: newer, time: new Date() }]);
    check(read.source === "claude" && read.phrasings.length === 1, `the reader takes ${read.phrasings.length} phrasing from the ${read.source} export`);
    const sorted = await uploadExport(ada.client, demo.id, read.source, read.phrasings, "conversations.json");
    const card = await ada.client.cards.get(A.id);
    check(sorted.status === "sorted" && card.count === key.skills[0]!.count + 1 && card.borrows.at(-1)?.text === newer, `the phrasing joins card A: ${card.count} borrows`);
    check(card.status === "borrowed_again" && card.returnedAt === returnedAt && Date.parse(card.lastBorrowAt) > Date.parse(card.returnedAt!), `card A is ${card.status}: borrowed ${card.lastBorrowAt}, after its return stamp ${card.returnedAt}`);
    const listed = (await ada.client.cards.list(demo.id)).find((c) => c.id === A.id);
    const { counts } = await ada.client.shelves.get(demo.id);
    check(listed?.status === "borrowed_again" && counts.borrowedAgain === 1 && counts.returned === 0, `the stack lists it ${listed?.status}; the shelf counts ${JSON.stringify(counts)}`);
    const { card: after } = await answer(ada.client, reps[4]!.id, known.right, "pass", "You reset the commit and keep your edits in your files.");
    check(after.status === "returned" && Date.parse(after.returnedAt!) > Date.parse(card.lastBorrowAt), `a fresh pass returns it again, stamped ${after.returnedAt}`);
  });

  await step("8. Another account's card or rep is a 404; logged out is a 401; an API key may take a rep", async () => {
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const theirCard = await failure(bea.client.reps.start(A.id));
    check(theirCard?.status === 404, `Bea starting a rep on Ada's card: ${say(theirCard)}`);
    const open = await start(ada.client, B.id, "Problem on card B.", "Card B's lesson.");
    const theirRep = await failure(bea.client.reps.check(open.rep.id, { answer: known.right }));
    check(theirRep?.status === 404, `Bea checking Ada's rep: ${say(theirRep)}`);
    const nobody = createClient({ baseUrl: app.url });
    const out = await failure(nobody.reps.start(A.id));
    check(out?.status === 401, `logged out: ${say(out)}`);
    const missing = await failure(ada.client.reps.start("no-such-card"));
    check(missing?.status === 404, `a card that doesn't exist: ${say(missing)}`);
    const { key: apiKey } = await ada.client.keys.create({ name: "Agent" });
    const agent = createClient({ baseUrl: app.url, apiKey });
    const started = await start(agent, B.id, "Card B's problem, from an agent.");
    const { rep } = await answer(agent, started.rep.id, "git commit --amend", "fail", "You amend the commit, which keeps it.");
    check(rep.verdict === "fail", `an API key starts and checks a rep (${rep.verdict})`);
    const opened = await failure(ada.client.reps.check(open.rep.id, { answer: known.right }));
    check(opened?.status === 409, `the page's rep on card B, left for the agent's: ${say(opened)}`);
  });

  await step("9. A check takes { answer } and nothing else: bad bodies are 400, a long answer 413, none reaching the model", async () => {
    const { rep } = await start(ada.client, C.id, "Problem on card C.", "Card C's lesson.");
    const before = model.requests.length;
    const raw = async (body: string) => {
      const response = await fetch(`${app.url}/api/v1/reps/${rep.id}/check`, { method: "POST", headers: { cookie: ada.cookie(), origin: app.url, "content-type": "application/json" }, body });
      return `${response.status} "${((await response.json()) as { error?: string }).error}"`;
    };
    const cases: [string, string, RegExp][] = [
      ["not JSON", "{ oops", /^400 /],
      ["no answer", "{}", /^400 "A check needs your answer\."$/],
      ["an empty answer", JSON.stringify({ answer: "  \n " }), /^400 "A check needs your answer\."$/],
      ["a number", JSON.stringify({ answer: 7 }), /^400 /],
      ["an extra key", JSON.stringify({ answer: "git reset HEAD~1", skill: "Anything" }), /^400 "A check is \{ answer \} and nothing else\."$/],
      ["an answer of 4,001 characters", JSON.stringify({ answer: "x".repeat(4001) }), /^413 /],
    ];
    for (const [label, body, want] of cases) {
      const got = await raw(body);
      check(want.test(got), `${label}: ${got}`);
    }
    check(model.requests.length === before, "none reached the model");
    const { rep: checked } = await answer(ada.client, rep.id, "x".repeat(4000), "fail", "You wrote only the letter x.");
    check(checked.verdict === "fail", "the rep was still open, and an answer of 4,000 characters is checked");
  });

  await step("10. A model failure stores nothing: a failed start adds no rep, a failed check leaves the rep open", async () => {
    const repsOn = async (cardId: string) => (await ada.client.cards.get(cardId)).reps;
    const D = (await ada.client.cards.list(demo.id))[3]!;
    for (const [label, stand] of [["a refusal", stopped("refusal")], ["an answer cut off", stopped("max_tokens")], ["an API error", refuse()]] as const) {
      model.queue(stand);
      const failed = await failure(ada.client.reps.start(D.id));
      check(failed?.status === 502, `starting a rep, ${label}: ${say(failed)}`);
    }
    check((await repsOn(D.id)).length === 0 && (await ada.client.cards.get(D.id)).lesson === null, "card D has no rep and no lesson");
    const { rep } = await start(ada.client, D.id, "Problem on card D.", "Card D's lesson.");
    model.queue(stopped("refusal"));
    const failed = await failure(ada.client.reps.check(rep.id, { answer: known.right }));
    check(failed?.status === 502 && (await repsOn(D.id))[0]?.checkedAt === null, `checking it, a refusal: ${say(failed)}; the rep stays open`);
    const { rep: retried } = await answer(ada.client, rep.id, known.right, "pass", "You reset and keep your changes.");
    check(retried.verdict === "pass", "checking it again works");
    check(unqueued.length === 0, `every rep and check request was answered by the reply queued for it (${unqueued.length} unqueued)`);
  });

  await step("11. Past the daily cap, starting and checking a rep get 429, without asking the model", async () => {
    const CAP = 4;
    const capped = await startApp({ ANTHROPIC_BASE_URL: model.url, SITE_DAILY_MODEL_REQUESTS: String(CAP) });
    try {
      const cy = capped.browser();
      await cy.client.auth.signUp({ name: "Cy Example", email: "cy@example.com", password: "jacquard loom" });
      const shelf = await cy.client.shelves.create({ name: "Demo", demo: true });
      await sortEnds(cy.client, (await upload(cy.client, shelf.id, phrasings)).id);
      const [first] = await cy.client.cards.list(shelf.id);
      await start(cy.client, first!.id, "A capped problem.", "A capped lesson.");
      const { rep } = await start(cy.client, first!.id, "A second capped problem.");
      const before = model.requests.length;
      const started = await failure(cy.client.reps.start(first!.id));
      check(started?.status === 429 && started.message === "Asked Before has used today's model requests for everyone. More open at midnight UTC.", `the day's sort, its batch and its second pass, and two reps spent ${CAP}; the next start: ${say(started)}`);
      const checked = await failure(cy.client.reps.check(rep.id, { answer: known.right }));
      check(checked?.status === 429, `and a check: ${say(checked)}`);
      check(model.requests.length === before && (await cy.client.cards.get(first!.id)).reps.length === 2, "neither reached the model, and nothing was stored");
    } finally {
      await capped.stop();
    }
  });

  await step("12. Deleting an upload that leaves a card under two borrows deletes the card and its reps", async () => {
    const half = 13;
    const work = await ada.client.shelves.create({ name: "Work" });
    await sortEnds(ada.client, (await upload(ada.client, work.id, phrasings.slice(0, half), "march.json")).id);
    const second = await sortEnds(ada.client, (await upload(ada.client, work.id, phrasings.slice(half), "september.json")).id);
    const inFirst = (ids: string[]) => ids.filter((id) => Number(id.slice(1)) <= half).length;
    const cards = await ada.client.cards.list(work.id);
    const goes = cards.find((card) => inFirst(key.skills.find((s) => s.name === card.skill)!.messageIds) < 2)!;
    const stays = cards.find((card) => inFirst(key.skills.find((s) => s.name === card.skill)!.messageIds) >= 2)!;
    check(goes !== undefined && stays !== undefined, `"${goes?.skill}" keeps under two borrows without the second upload, "${stays?.skill}" keeps two or more`);
    const gone = await start(ada.client, goes.id, "A problem on the card that goes.", "Its lesson.");
    const { card: returned } = await answer(ada.client, gone.rep.id, known.right, "pass", "You did it.");
    const kept = await start(ada.client, stays.id, "A problem on the card that stays.", "Its lesson too.");
    // The rows are read beside the app, at the data boundary.
    const repsInStore = (cardId: string) => {
      const store = new Database(app.databasePath, { readonly: true, strict: true });
      const { n } = store.query("SELECT count(*) AS n FROM reps WHERE card_id = $cardId").get({ cardId }) as { n: number };
      store.close();
      return n;
    };
    check(returned.status === "returned" && repsInStore(goes.id) === 1, `"${goes.skill}" is ${returned.status} before the delete, with ${repsInStore(goes.id)} rep in the database`);
    await ada.client.uploads.delete(second.id);
    const card = await failure(ada.client.cards.get(goes.id));
    const rep = await failure(ada.client.reps.check(gone.rep.id, { answer: known.right }));
    check(card?.status === 404 && rep?.status === 404, `its card: ${say(card)}; its rep: ${say(rep)}`);
    const left = repsInStore(goes.id);
    const ofKept = repsInStore(stays.id);
    check(left === 0, `the database holds ${left} reps of the deleted card`);
    const still = await ada.client.cards.get(stays.id);
    check(ofKept === 1 && still.reps[0]?.id === kept.rep.id, `the card that stays keeps its rep (${ofKept} in the database, ${still.reps.length} through the API)`);
  });

  await step("13. The app's logs hold no lesson, problem, answer, reason, or phrasing", async () => {
    const logs = app.log();
    const leaked = [...texts, ...phrasings.map((p) => p.text)].filter((text) => logs.includes(text));
    check(leaked.length === 0, `${texts.length + phrasings.length} texts looked for, ${leaked.length} found`);
  });
} finally {
  await app.stop();
  model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);

