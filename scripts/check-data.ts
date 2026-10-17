// Checks downloading and deleting your data (m1kuorg/basics#49) end to end,
// on a fresh copy of the app whose model is a stand-in in this script,
// never in the app: it sorts as the demo export's answer key does, and
// answers the one cold rep and check queued for it. Through the SDK, after
// the demo project and one returned card: the download holds the account
// and every project, upload, phrasing (on a card, unsorted, or waiting for
// its sort), card, and cold rep, matching the API and the phrasings sent,
// and nothing of another account's, no key, and no password; only a session
// may download it. It prints ids, counts, and the app's messages, never a
// phrasing, and exits 1 if any check fails, naming the step.
// Run: bun run check:data [screenshot dir]

import { ApiError, createClient, type AccountData, type Client, type Phrasing, type Upload } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { phrasings as demoPhrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { known, repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-data");
await mkdir(OUT, { recursive: true });

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
const same = (a: unknown, b: unknown) => Bun.deepEquals(a, b, true);

// Rep and check requests nobody queued an answer for are refused, so nothing here reaches the real model.
const model = await startModelStub(sortsByKey((request, raw, body) => refuse()(request, raw, body)));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const withKey = (apiKey: string) => createClient({ baseUrl: app.url, apiKey });

const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const BEA = { name: "Bea Example", email: "bea@example.com", password: "difference engine" };
const ada = app.browser();
const bea = app.browser();
await ada.client.auth.signUp(ADA);
await bea.client.auth.signUp(BEA);

/** Every phrasing each upload was sent, by upload id: the independent record the download is checked against. */
const sent = new Map<string, Phrasing[]>();

/** Uploads phrasings as the page does and waits for the sort to end. */
async function sorted(client: Client, projectId: string, list: Phrasing[], fileName: string): Promise<Upload> {
  const made = await upload(client, projectId, list, fileName);
  sent.set(made.id, list);
  return sortEnds(client, made.id);
}

// Ada: the demo project, its card A returned by one passed cold rep, and a Work project with
// one unsorted phrasing and an upload still receiving, whose phrasing waits for its sort.
const demo = await ada.client.projects.create({ name: "Demo export", demo: true });
const demoUpload = await sorted(ada.client, demo.id, demoPhrasings, "export.json");
const cardA = (await ada.client.cards.list(demo.id))[0]!;
model.queue(repReply("A stand-in's problem.", "A stand-in's lesson."), verdictReply("pass", "A stand-in's reason."));
const rep = (await ada.client.reps.start(cardA.id)).rep;
const passed = await ada.client.reps.check(rep.id, { answer: known.right });

const work = await ada.client.projects.create({ name: "Work" });
const lone = (await smallExport([{ text: "How do I rotate a PDF page?", time: new Date("2026-09-01T10:00:00Z") }])).phrasings;
await sorted(ada.client, work.id, lone, "lone.json");
const receiving = await ada.client.uploads.create(work.id, { source: "claude", fileName: "half-sent.json" });
const waiting = (await smallExport([{ text: "How do I merge two PDFs?", time: new Date("2026-09-02T10:00:00Z") }])).phrasings;
await ada.client.uploads.append(receiving.id, waiting);
sent.set(receiving.id, waiting);
const adaKey = await ada.client.keys.create({ name: "Laptop" });

// Bea: one project of her own.
const beaWork = await bea.client.projects.create({ name: "Bea's work" });
const beaAsks = (await smallExport([
  { text: "How do I center a div?", time: new Date("2026-08-01T09:00:00Z") },
  { text: "What's the way to center a div horizontally?", time: new Date("2026-08-03T09:00:00Z") },
])).phrasings;
await sorted(bea.client, beaWork.id, beaAsks, "bea.json");

/** Every page of a project's uploads, oldest first. */
async function allUploads(client: Client, projectId: string): Promise<Upload[]> {
  const all: Upload[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.uploads.list(projectId, { limit: 1, cursor });
    all.push(...page.uploads);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all.reverse();
}

/** Every page of a project's unsorted phrasings, oldest first. */
async function allUnsorted(client: Client, projectId: string) {
  const all = [];
  let cursor: string | undefined;
  do {
    const page = await client.cards.unsorted(projectId, { limit: 1, cursor });
    all.push(...page.phrasings);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all.reverse();
}

/** Checks a download against the API, as the same client reads it, and against the phrasings each upload was sent. */
async function matchesApi(client: Client, data: AccountData) {
  check(same(data.account, await client.auth.me()), `the account is the current account: ${data.account.email}`);
  check(!Number.isNaN(Date.parse(data.exportedAt)) && Math.abs(Date.now() - Date.parse(data.exportedAt)) < 60_000, `it says when it was made: ${data.exportedAt}`);
  const listed = await client.projects.list();
  check(same(data.projects.map((p) => p.id), listed.map((p) => p.id)), `every project, oldest first: ${data.projects.map((p) => p.name).join(", ")}`);

  for (const project of data.projects) {
    const { uploads, phrasings, cards, ...shown } = project;
    const name = `"${project.name}"`;
    check(same(shown, listed.find((p) => p.id === project.id)), `${name} is as projects.list shows it: ${project.counts.cards} cards, ${project.counts.returned} returned`);

    const apiUploads = await allUploads(client, project.id);
    check(same(uploads, apiUploads), `${name}'s ${uploads.length} uploads, oldest first, are as uploads.list shows them`);

    const apiCards = await client.cards.list(project.id);
    check(same(cards.map(({ lesson: _l, reps: _r, ...card }) => card), apiCards), `${name}'s ${cards.length} cards, in the stack's order, are as cards.list shows them`);
    let borrowsMatch = true;
    let repsMatch = true;
    for (const card of cards) {
      const detail = await client.cards.get(card.id);
      const onIt = phrasings.filter((p) => p.cardId === card.id).map(({ id, sourceId, text, time }) => ({ id, sourceId, text, time }));
      if (!same(onIt, detail.borrows)) borrowsMatch = false;
      if (!same({ lesson: card.lesson, reps: card.reps }, { lesson: detail.lesson, reps: detail.reps })) repsMatch = false;
    }
    check(borrowsMatch, `each card's phrasings are its borrows in cards.get, word for word, oldest first`);
    check(repsMatch, `each card's lesson and cold reps are as cards.get shows them`);

    const unsorted = await allUnsorted(client, project.id);
    const offOnes = phrasings.filter((p) => p.cardId === null).map(({ id, sourceId, text, time }) => ({ id, sourceId, text, time }));
    const waitingIds = new Set(uploads.filter((u) => u.status === "receiving").map((u) => u.id));
    const sortedOff = offOnes.filter((p) => !waitingIds.has(phrasings.find((q) => q.id === p.id)!.uploadId ?? ""));
    check(same(sortedOff, unsorted), `${name}'s ${unsorted.length} unsorted phrasings are as cards.unsorted shows them`);

    // Every phrasing each upload was sent, once, word for word, at its own time, and nothing else.
    const expected = uploads.flatMap((u) => (sent.get(u.id) ?? []).map((p) => ({ uploadId: u.id, sourceId: p.sourceId, text: p.text, time: new Date(p.time).toISOString() })));
    const got = phrasings.map((p) => ({ uploadId: p.uploadId, sourceId: p.sourceId, text: p.text, time: p.time }));
    const bySource = (a: { sourceId: string }, b: { sourceId: string }) => a.sourceId.localeCompare(b.sourceId);
    check(same([...got].sort(bySource), [...expected].sort(bySource)), `${name} holds all ${phrasings.length} phrasings its uploads were sent (${expected.length}), each with its upload, and no other`);
    check(phrasings.every((p) => p.origin === "export"), "each says it came from a chat export");
    const times = phrasings.map((p) => `${p.time} ${p.id}`);
    check(same(times, [...times].sort()), "its phrasings are oldest first");
  }
}

await step("1. The download holds the account, and every project, upload, phrasing, card, and cold rep, matching the API", async () => {
  const data = await ada.client.account.export();
  await matchesApi(ada.client, data);

  const demoData = data.projects.find((p) => p.id === demo.id)!;
  check(demoData.demo === true, "the demo project says it's demo data");
  check(demoData.phrasings.length === demoPhrasings.length && demoData.uploads[0]?.id === demoUpload.id, `the demo project holds the demo export's ${demoPhrasings.length} phrasings`);
  const a = demoData.cards.find((c) => c.id === cardA.id);
  check(a?.status === "returned" && a.returnedAt === passed.rep.checkedAt, `card A is returned, stamped ${a?.returnedAt}`);
  const held = a?.reps[0];
  check(a?.reps.length === 1 && held?.verdict === "pass" && held.answer === known.right && held.reason === "A stand-in's reason." && held.problem === "A stand-in's problem.", "card A's one cold rep holds its problem, the answer, the pass, and the reason");
  check(a?.lesson === "A stand-in's lesson.", "card A holds its lesson");

  const workData = data.projects.find((p) => p.id === work.id)!;
  const pending = workData.phrasings.find((p) => p.uploadId === receiving.id);
  check(pending !== undefined && pending.cardId === null, "the phrasing still waiting for its sort is there too");

  const text = JSON.stringify(data);
  check(!text.includes(beaWork.id) && !text.includes(BEA.email) && beaAsks.every((p) => !text.includes(p.text)), "nothing of Bea's is in it");
  check(!text.includes(adaKey.key.split("_")[2]!) && !text.includes(adaKey.id), "no API key is in it");
  check(!/\$argon2/.test(text) && !text.includes(ADA.password), "no password or its hash is in it");
});

await step("2. Only a session downloads the data: a key gets 403, and no one at all 401", async () => {
  const byKey = await failure(withKey(adaKey.key).account.export());
  check(byKey?.status === 403, `an API key: ${say(byKey)}`);
  const nobody = await failure(createClient({ baseUrl: app.url }).account.export());
  check(nobody?.status === 401, `no session: ${say(nobody)}`);
  const raw = await fetch(`${app.url}/api/v1/account/export`, { headers: { cookie: ada.cookie() } });
  check(raw.status === 200 && /^application\/json/.test(raw.headers.get("content-type") ?? "") && raw.headers.get("cache-control") === "no-store", `the answer is JSON, never cached: ${raw.status}, ${raw.headers.get("content-type")}, ${raw.headers.get("cache-control")}`);

  const beas = await bea.client.account.export();
  check(beas.projects.length === 1 && beas.projects[0]!.id === beaWork.id && beas.account.email === BEA.email, `Bea's download holds only her own project: ${beas.projects.map((p) => p.name).join(", ")}`);
  await matchesApi(bea.client, beas);
});

/** Bea's data before Ada deletes her account, to compare with after. */
let beaBefore: AccountData | null = null;
const withoutTime = ({ exportedAt: _, ...data }: AccountData) => data;

await step("3. Deleting the account needs a session, from the page's origin, and the password", async () => {
  beaBefore = await bea.client.account.export();
  const byKey = await failure(withKey(adaKey.key).account.delete({ password: ADA.password }));
  check(byKey?.status === 403, `an API key: ${say(byKey)}`);
  const wrong = await failure(ada.client.account.delete({ password: "the wrong password" }));
  check(wrong?.status === 403, `a wrong password: ${say(wrong)}`);
  const none = await failure(ada.client.account.delete({ password: "" }));
  check(none?.status === 400, `no password: ${say(none)}`);
  const bare = await fetch(`${app.url}/api/v1/account`, { method: "DELETE", headers: { cookie: ada.cookie(), origin: app.url } });
  check(bare.status === 400, `no body: ${bare.status} ${JSON.stringify(await bare.json().catch(() => null))}`);
  const forged = await fetch(`${app.url}/api/v1/account`, {
    method: "DELETE",
    headers: { cookie: ada.cookie(), origin: "https://elsewhere.example", "content-type": "application/json" },
    body: JSON.stringify({ password: ADA.password }),
  });
  check(forged.status === 403, `from another site's page: ${forged.status} ${JSON.stringify(await forged.json().catch(() => null))}`);
  check((await ada.client.auth.me()).email === ADA.email && (await ada.client.projects.list()).length === 2, "none of them deleted anything");
});

await step("4. Deleted, the account and everything in it are gone, every session ends, and logging in fails", async () => {
  const other = app.browser();
  await other.client.auth.logIn({ email: ADA.email, password: ADA.password });
  const before = await ada.client.account.export();

  await ada.client.account.delete({ password: ADA.password });
  check(ada.cookie() === "", "the answer clears this browser's session cookie");
  const here = await failure(ada.client.auth.me());
  check(here?.status === 401, `this browser is logged out: ${say(here)}`);
  const elsewhere = await failure(other.client.auth.me());
  check(elsewhere?.status === 401, `another browser is logged out: ${say(elsewhere)}`);
  const key = await failure(withKey(adaKey.key).projects.list());
  check(key?.status === 401, `the account's API key: ${say(key)}`);
  const login = await failure(app.browser().client.auth.logIn({ email: ADA.email, password: ADA.password }));
  check(login?.status === 401, `logging in: ${say(login)}`);

  // The store, read directly: no row is left of anything the download held.
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  try {
    const left = (table: string, column: string, ids: string[]) =>
      ids.length ? (store.query(`SELECT count(*) AS n FROM ${table} WHERE ${column} IN (${ids.map(() => "?").join(", ")})`).get(...ids) as { n: number }).n : 0;
    const projects = before.projects;
    const counts = {
      users: left("users", "id", [before.account.id]),
      sessions: left("sessions", "user_id", [before.account.id]),
      api_keys: left("api_keys", "user_id", [before.account.id]),
      usage: left("usage", "user_id", [before.account.id]),
      projects: left("projects", "id", projects.map((p) => p.id)),
      uploads: left("uploads", "id", projects.flatMap((p) => p.uploads.map((u) => u.id))),
      upload_messages: left("upload_messages", "upload_id", projects.flatMap((p) => p.uploads.map((u) => u.id))),
      phrasings: left("phrasings", "id", projects.flatMap((p) => p.phrasings.map((f) => f.id))),
      cards: left("cards", "id", projects.flatMap((p) => p.cards.map((c) => c.id))),
      reps: left("reps", "id", projects.flatMap((p) => p.cards.flatMap((c) => c.reps.map((r) => r.id)))),
    };
    const held = Object.entries(counts).filter(([, n]) => n > 0);
    check(held.length === 0, `no row is left in users, sessions, keys, usage, projects, uploads, phrasings, cards, or reps${held.length ? `: ${JSON.stringify(Object.fromEntries(held))}` : ""}`);
  } finally {
    store.close();
  }

  const beaAfter = await bea.client.account.export();
  check(beaBefore !== null && same(withoutTime(beaAfter), withoutTime(beaBefore)), `Bea's data is untouched: ${beaAfter.projects.map((p) => `${p.name}, ${p.phrasings.length} phrasings`).join("; ")}`);
  check((await app.browser().client.auth.logIn({ email: BEA.email, password: BEA.password })).account.email === BEA.email, "Bea still logs in");

  const again = app.browser();
  const fresh = await again.client.auth.signUp(ADA);
  check(fresh.account.id !== before.account.id && (await again.client.projects.list()).length === 0 && (await again.client.keys.list()).length === 0, "Ada's email can sign up again, to an empty account");
  await again.client.account.delete({ password: ADA.password });
});

await step("5. The app logged none of the phrasings, and no password", async () => {
  const log = app.log();
  const texts = [...demoPhrasings, ...lone, ...waiting, ...beaAsks].map((p) => p.text);
  check(texts.every((text) => !log.includes(text)) && !log.includes(ADA.password), `${texts.length} phrasings and the password are nowhere in ${log.split("\n").length} lines of log`);
  check(/DELETE \/api\/v1\/account 204/.test(log) && /GET \/api\/v1\/account\/export 200/.test(log), "the log has the download and the delete, by method, path, and status");
});

await app.stop();
model.stop();

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nYour data holds up.");
