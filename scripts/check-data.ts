// Checks downloading and deleting your data (m1kuorg/basics#49), on Workers
// since m1kuorg/basics#63, end to end on a fresh copy of the app under
// `wrangler dev`, whose model is a stand-in in this script, never in the
// app: it sorts as the demo export's answer key does, and answers the one
// cold rep and check queued for it. Through the SDK, after the demo shelf
// and one returned card: the download holds the account and every shelf,
// upload, phrasing (on a card, unsorted, or waiting for its sort), card,
// and cold rep, matching the API and the phrasings sent, and nothing of
// another account's, no key, and no password; only a session may download
// it. Deleting the account needs the password, deletes everything in it
// (read in the database too), ends every session, and leaves logging in
// failing, with another account's data untouched. The download is read in
// one D1 batch, as Wrangler's local traces show, and a big account, 8,000
// phrasings of the longest length, downloads whole and deletes whole. Then,
// in a real browser at 1920×1080, the settings page: both sections saying
// that the host keeps deleted data in its backups for up to 30 days; the
// download saved as one JSON file, the same as the SDK's; deleting, which
// asks for the password and a confirmation, refuses a wrong password, keeps
// everything on Escape or Keep it, and then deletes and logs out to the
// landing page. It prints ids, counts, and the app's messages, never a
// phrasing, saves screenshots, and exits 1 if any check fails, naming the
// step.
// Run: bun run check:data [screenshot dir]

import { ApiError, createClient, MAX_CHUNK, MAX_PHRASING_LENGTH, type AccountData, type Client, type Phrasing, type Upload } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
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

/**
 * The D1 calls a download made, by name, in order, read from the traces
 * that `wrangler dev` keeps locally (its Local Explorer): "d1_first" for
 * the session, then one "d1_batch" for the data, however much it holds.
 */
async function downloadsD1Calls(download: () => Promise<unknown>): Promise<string[]> {
  const traces = `${app.url}/cdn-cgi/local/explorer/api/local/observability`;
  await fetch(`${traces}/clear`, { method: "POST" });
  await download();
  const sql = "SELECT name FROM spans WHERE kind = 'd1' AND trace_id IN (SELECT trace_id FROM logs WHERE message LIKE '%GET /api/v1/account/export 200%') ORDER BY start_ms";
  const answer = (await (await fetch(`${traces}/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sql }) })).json()) as { result: { rows: [string][] } };
  return answer.result.rows.map(([name]) => name);
}
const ONE_BATCH = ["d1_first", "d1_batch"];

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
async function sorted(client: Client, shelfId: string, list: Phrasing[], fileName: string): Promise<Upload> {
  const made = await upload(client, shelfId, list, fileName);
  sent.set(made.id, list);
  return sortEnds(client, made.id);
}

// Ada: the demo shelf, its card A returned by one passed cold rep, and a Work shelf with
// one unsorted phrasing and an upload still receiving, whose phrasing waits for its sort.
const demo = await ada.client.shelves.create({ name: "Demo export", demo: true });
const demoUpload = await sorted(ada.client, demo.id, demoPhrasings, "export.json");
const cardA = (await ada.client.cards.list(demo.id))[0]!;
model.queue(repReply("A stand-in's problem.", "A stand-in's lesson."), verdictReply("pass", "A stand-in's reason."));
const rep = (await ada.client.reps.start(cardA.id)).rep;
const passed = await ada.client.reps.check(rep.id, { answer: known.right });

const work = await ada.client.shelves.create({ name: "Work" });
const lone = (await smallExport([{ text: "How do I rotate a PDF page?", time: new Date("2026-09-01T10:00:00Z") }])).phrasings;
await sorted(ada.client, work.id, lone, "lone.json");
const receiving = await ada.client.uploads.create(work.id, { source: "claude", fileName: "half-sent.json" });
const waiting = (await smallExport([{ text: "How do I merge two PDFs?", time: new Date("2026-09-02T10:00:00Z") }])).phrasings;
await ada.client.uploads.append(receiving.id, waiting);
sent.set(receiving.id, waiting);
const adaKey = await ada.client.keys.create({ name: "Laptop" });

// Bea: one shelf of her own.
const beaWork = await bea.client.shelves.create({ name: "Bea's work" });
const beaAsks = (await smallExport([
  { text: "How do I center a div?", time: new Date("2026-08-01T09:00:00Z") },
  { text: "What's the way to center a div horizontally?", time: new Date("2026-08-03T09:00:00Z") },
])).phrasings;
await sorted(bea.client, beaWork.id, beaAsks, "bea.json");

/** Every page of a shelf's uploads, oldest first. */
async function allUploads(client: Client, shelfId: string): Promise<Upload[]> {
  const all: Upload[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.uploads.list(shelfId, { limit: 1, cursor });
    all.push(...page.uploads);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all.reverse();
}

/** Every page of a shelf's unsorted phrasings, oldest first. */
async function allUnsorted(client: Client, shelfId: string) {
  const all = [];
  let cursor: string | undefined;
  do {
    const page = await client.cards.unsorted(shelfId, { limit: 1, cursor });
    all.push(...page.phrasings);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all.reverse();
}

/** Checks a download against the API, as the same client reads it, and against the phrasings each upload was sent. */
async function matchesApi(client: Client, data: AccountData) {
  check(same(data.account, await client.auth.me()), `the account is the current account: ${data.account.email}`);
  check(!Number.isNaN(Date.parse(data.exportedAt)) && Math.abs(Date.now() - Date.parse(data.exportedAt)) < 60_000, `it says when it was made: ${data.exportedAt}`);
  const listed = await client.shelves.list();
  check(same(data.shelves.map((p) => p.id), listed.map((p) => p.id)), `every shelf, oldest first: ${data.shelves.map((p) => p.name).join(", ")}`);

  for (const shelf of data.shelves) {
    const { uploads, phrasings, cards, ...shown } = shelf;
    const name = `"${shelf.name}"`;
    check(same(shown, listed.find((p) => p.id === shelf.id)), `${name} is as shelves.list shows it: ${shelf.counts.cards} cards, ${shelf.counts.returned} returned`);

    const apiUploads = await allUploads(client, shelf.id);
    check(same(uploads, apiUploads), `${name}'s ${uploads.length} uploads, oldest first, are as uploads.list shows them`);

    const apiCards = await client.cards.list(shelf.id);
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

    const unsorted = await allUnsorted(client, shelf.id);
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

await step("1. The download holds the account, and every shelf, upload, phrasing, card, and cold rep, matching the API", async () => {
  let data!: AccountData;
  const calls = await downloadsD1Calls(async () => (data = await ada.client.account.export()));
  await matchesApi(ada.client, data);
  const cards = data.shelves.flatMap((p) => p.cards).length;
  check(same(calls, ONE_BATCH), `it's read in one batch, for ${data.shelves.length} shelves and ${cards} cards: ${calls.join(", ")}`);

  const demoData = data.shelves.find((p) => p.id === demo.id)!;
  check(demoData.demo === true, "the demo shelf says it's demo data");
  check(demoData.phrasings.length === demoPhrasings.length && demoData.uploads[0]?.id === demoUpload.id, `the demo shelf holds the demo export's ${demoPhrasings.length} phrasings`);
  const a = demoData.cards.find((c) => c.id === cardA.id);
  check(a?.status === "returned" && a.returnedAt === passed.rep.checkedAt, `card A is returned, stamped ${a?.returnedAt}`);
  const held = a?.reps[0];
  check(a?.reps.length === 1 && held?.verdict === "pass" && held.answer === known.right && held.reason === "A stand-in's reason." && held.problem === "A stand-in's problem.", "card A's one cold rep holds its problem, the answer, the pass, and the reason");
  check(a?.lesson === "A stand-in's lesson.", "card A holds its lesson");

  const workData = data.shelves.find((p) => p.id === work.id)!;
  const pending = workData.phrasings.find((p) => p.uploadId === receiving.id);
  check(pending !== undefined && pending.cardId === null, "the phrasing still waiting for its sort is there too");

  const text = JSON.stringify(data);
  check(!text.includes(beaWork.id) && !text.includes(BEA.email) && beaAsks.every((p) => !text.includes(p.text)), "nothing of Bea's is in it");
  check(!text.includes(adaKey.key.split("_")[2]!) && !text.includes(adaKey.id), "no API key is in it");
  check(!/\$scrypt\$/.test(text) && !text.includes(ADA.password), "no password or its hash is in it");
});

await step("2. Only a session downloads the data: a key gets 403, and no one at all 401", async () => {
  const byKey = await failure(withKey(adaKey.key).account.export());
  check(byKey?.status === 403, `an API key: ${say(byKey)}`);
  const nobody = await failure(createClient({ baseUrl: app.url }).account.export());
  check(nobody?.status === 401, `no session: ${say(nobody)}`);
  const raw = await fetch(`${app.url}/api/v1/account/export`, { headers: { cookie: ada.cookie() } });
  check(raw.status === 200 && /^application\/json/.test(raw.headers.get("content-type") ?? "") && raw.headers.get("cache-control") === "no-store", `the answer is JSON, never cached: ${raw.status}, ${raw.headers.get("content-type")}, ${raw.headers.get("cache-control")}`);

  const beas = await bea.client.account.export();
  check(beas.shelves.length === 1 && beas.shelves[0]!.id === beaWork.id && beas.account.email === BEA.email, `Bea's download holds only her own shelf: ${beas.shelves.map((p) => p.name).join(", ")}`);
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
  check((await ada.client.auth.me()).email === ADA.email && (await ada.client.shelves.list()).length === 2, "none of them deleted anything");
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
  const key = await failure(withKey(adaKey.key).shelves.list());
  check(key?.status === 401, `the account's API key: ${say(key)}`);
  const login = await failure(app.browser().client.auth.logIn({ email: ADA.email, password: ADA.password }));
  check(login?.status === 401, `logging in: ${say(login)}`);

  // The store, read directly: no row is left of anything the download held.
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  try {
    const left = (table: string, column: string, ids: string[]) =>
      ids.length ? (store.query(`SELECT count(*) AS n FROM ${table} WHERE ${column} IN (${ids.map(() => "?").join(", ")})`).get(...ids) as { n: number }).n : 0;
    const shelves = before.shelves;
    const counts = {
      users: left("users", "id", [before.account.id]),
      sessions: left("sessions", "user_id", [before.account.id]),
      api_keys: left("api_keys", "user_id", [before.account.id]),
      usage: left("usage", "user_id", [before.account.id]),
      shelves: left("shelves", "id", shelves.map((p) => p.id)),
      uploads: left("uploads", "id", shelves.flatMap((p) => p.uploads.map((u) => u.id))),
      upload_messages: left("upload_messages", "upload_id", shelves.flatMap((p) => p.uploads.map((u) => u.id))),
      phrasings: left("phrasings", "id", shelves.flatMap((p) => p.phrasings.map((f) => f.id))),
      cards: left("cards", "id", shelves.flatMap((p) => p.cards.map((c) => c.id))),
      reps: left("reps", "id", shelves.flatMap((p) => p.cards.flatMap((c) => c.reps.map((r) => r.id)))),
    };
    const held = Object.entries(counts).filter(([, n]) => n > 0);
    check(held.length === 0, `no row is left in users, sessions, keys, usage, shelves, uploads, phrasings, cards, or reps${held.length ? `: ${JSON.stringify(Object.fromEntries(held))}` : ""}`);
  } finally {
    store.close();
  }

  const beaAfter = await bea.client.account.export();
  check(beaBefore !== null && same(withoutTime(beaAfter), withoutTime(beaBefore)), `Bea's data is untouched: ${beaAfter.shelves.map((p) => `${p.name}, ${p.phrasings.length} phrasings`).join("; ")}`);
  check((await app.browser().client.auth.logIn({ email: BEA.email, password: BEA.password })).account.email === BEA.email, "Bea still logs in");

  const again = app.browser();
  const fresh = await again.client.auth.signUp(ADA);
  check(fresh.account.id !== before.account.id && (await again.client.shelves.list()).length === 0 && (await again.client.keys.list()).length === 0, "Ada's email can sign up again, to an empty account");
  await again.client.account.delete({ password: ADA.password });
});

// Dee: one shelf holding 8,000 phrasings of the longest length, some of their characters past ASCII, sent MAX_CHUNK at a time and left waiting for their sort.
const DEE = { name: "Dee Example", email: "dee@example.com", password: "a fourth long password" };
const BIG = 4 * MAX_CHUNK;
const long: Phrasing[] = Array.from({ length: BIG }, (_, i) => {
  const head = `Question ${i + 1}, asked at length: café, naïve, 日本語, `;
  return { sourceId: `long-${i + 1}`, text: head + "x".repeat(MAX_PHRASING_LENGTH - head.length), time: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString() };
});

await step("5. A big account's download comes whole, in one batch, and deleting it deletes it all", async () => {
  const dee = app.browser();
  await dee.client.auth.signUp(DEE);
  const shelf = await dee.client.shelves.create({ name: "Everything" });
  const receiving = await dee.client.uploads.create(shelf.id, { source: "chatgpt", fileName: "conversations.json" });
  for (let i = 0; i < long.length; i += MAX_CHUNK) await dee.client.uploads.append(receiving.id, long.slice(i, i + MAX_CHUNK));

  const started = performance.now();
  let text = "";
  const calls = await downloadsD1Calls(async () => (text = await (await fetch(`${app.url}/api/v1/account/export`, { headers: { cookie: dee.cookie() } })).text()));
  const took = Math.round(performance.now() - started);
  check(same(calls, ONE_BATCH), `it's read in one batch: ${calls.join(", ")}`);
  const data = JSON.parse(text) as AccountData;
  const held = new Map(data.shelves[0]?.phrasings.map((p) => [p.sourceId, p]));
  const whole = long.every((p) => held.get(p.sourceId)?.text === p.text && held.get(p.sourceId)?.time === p.time);
  check(held.size === BIG && whole, `all ${BIG.toLocaleString("en-US")} phrasings of ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters, word for word: ${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB in ${took} ms`);
  check(same(withoutTime(data), withoutTime(await dee.client.account.export())), "the SDK downloads the same");

  await dee.client.account.delete({ password: DEE.password });
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  try {
    const left = store.query<{ n: number }, [string, string]>("SELECT (SELECT count(*) FROM phrasings WHERE shelf_id = ?1) + (SELECT count(*) FROM upload_messages WHERE upload_id = ?2) AS n").get(shelf.id, receiving.id)!.n;
    check(left === 0, `deleted, none of its phrasings or messages is left: ${left}`);
  } finally {
    store.close();
  }
});

await step("6. The app logged none of the phrasings, and no password", async () => {
  const log = app.log();
  const texts = [...demoPhrasings, ...lone, ...waiting, ...beaAsks, ...long].map((p) => p.text);
  check(texts.every((text) => !log.includes(text)) && !log.includes(ADA.password), `${texts.length} phrasings and the password are nowhere in ${log.split("\n").length} lines of log`);
  check(/DELETE \/api\/v1\/account 204/.test(log) && /GET \/api\/v1\/account\/export 200/.test(log), "the log has the download and the delete, by method, path, and status");
});

// The settings page, in a real browser at 1920×1080, on Cy's session: Cy has one shelf with one upload.
const CY = { name: "Cy Example", email: "cy@example.com", password: "a third long password" };
const cy = app.browser();
await cy.client.auth.signUp(CY);
const cyNotes = await cy.client.shelves.create({ name: "Notes" });
const cyAsks = (await smallExport([{ text: "How do I split a PDF?", time: new Date("2026-07-01T08:00:00Z") }])).phrasings;
await sorted(cy.client, cyNotes.id, cyAsks, "cy.json");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true });
await context.addCookies(cy.cookie().split("; ").map((pair) => {
  const [name, value] = pair.split("=");
  return { name: name!, value: value!, url: app.url };
}));
const page = await context.newPage();
page.setDefaultTimeout(10_000);
let shot = 0;
const screenshot = (name: string) => page.screenshot({ path: join(OUT, `${++shot}-${name}.png`) });

/** Every request the page sent to the server's API, and every console error, CSP violations included. */
const apiCalls: string[] = [];
const consoleErrors: string[] = [];
page.on("request", (request) => {
  const { origin, pathname } = new URL(request.url());
  if (origin === app.url && pathname.startsWith("/api/")) apiCalls.push(`${request.method()} ${pathname}`);
});
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const section = (name: string) => page.locator("section", { has: page.getByRole("heading", { name, exact: true, level: 2 }) });
/** What the data and delete sections say of D1's Time Travel, which keeps deleted data and can't be turned off. */
const BACKUPS = /stays in the backups of Cloudflare, Asked Before's host, for up to 30 days/;
const stillThere = async () => (await cy.client.auth.me()).email === CY.email && (await cy.client.shelves.list()).length === 1;

try {
  await step("7. In settings, Download your data saves one JSON file, the same as the SDK's", async () => {
    await page.goto(`${app.url}/app/settings`);
    const data = section("Your data");
    await data.waitFor();
    check(BACKUPS.test((await data.textContent()) ?? ""), `it says: "${BACKUPS.source}"`);
    const [download] = await Promise.all([page.waitForEvent("download"), data.getByRole("button", { name: "Download your data" }).click()]);
    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    const name = download.suggestedFilename();
    check(name === `asked-before-${today}.json`, `the file is named for today, in the learner's own time zone: ${name}`);
    const file = JSON.parse(await Bun.file((await download.path())!).text()) as AccountData;
    check(same(withoutTime(file), withoutTime(await cy.client.account.export())), `it holds what the SDK downloads: ${file.shelves.map((p) => `${p.name}, ${p.phrasings.length} phrasings`).join("; ")}`);
    const said = await data.locator("[role=status]").textContent();
    check(said?.includes(name) ?? false, `the section says so: "${said}"`);
    await screenshot("data-downloaded");
  });

  await step("8. Deleting in the page needs the password and a confirmation; a wrong one, Escape, and Keep it delete nothing", async () => {
    const del = section("Delete your account");
    await del.scrollIntoViewIfNeeded();
    check(BACKUPS.test((await del.textContent()) ?? ""), `it says so too: "${BACKUPS.source}"`);
    const password = del.getByLabel("Your password");
    await password.fill("the wrong password");
    await del.getByRole("button", { name: "Delete your account" }).click();
    const confirm = del.locator(".confirm");
    await confirm.waitFor();
    const asks = await confirm.locator("h2").textContent();
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    check(asks === "Delete your account and everything in it?" && focused === "Keep it", `it asks first, "${asks}", with Keep it focused: ${focused}`);
    check((await del.getByRole("button", { name: "Delete your account" }).isDisabled()) === true, "the form's button is locked while it asks");
    await screenshot("delete-confirm");
    await confirm.getByRole("button", { name: "Delete everything" }).click();
    const refusal = del.locator(".error");
    await refusal.waitFor();
    const field = await password.evaluate((input) => ({ invalid: input.getAttribute("aria-invalid"), focused: input === document.activeElement }));
    check((await refusal.textContent()) === "That isn't your password." && field.invalid === "true" && field.focused, `a wrong password says "${await refusal.textContent()}", marking that field: ${JSON.stringify(field)}`);
    check((await confirm.count()) === 0, "the confirmation is gone");
    await screenshot("delete-refused");
    check(await stillThere(), "Cy's account and shelf are still there");

    await password.fill(CY.password);
    await del.getByRole("button", { name: "Delete your account" }).click();
    await confirm.waitFor();
    await page.keyboard.press("Escape");
    await confirm.waitFor({ state: "detached" });
    check(await password.evaluate((input) => input === document.activeElement), "Escape keeps it, and goes back to the password");
    await del.getByRole("button", { name: "Delete your account" }).click();
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await confirm.waitFor({ state: "detached" });
    check((await del.getByRole("button", { name: "Delete your account" }).isEnabled()) && (await stillThere()), "Keep it keeps it too, and the form takes another try");
  });

  await step("9. Deleted in the page, Cy is logged out to the landing page, and logging in fails", async () => {
    const del = section("Delete your account");
    await del.getByRole("button", { name: "Delete your account" }).click();
    await del.locator(".confirm").getByRole("button", { name: "Delete everything" }).click();
    await page.waitForURL(`${app.url}/`);
    check(true, `the page goes to the landing page: ${new URL(page.url()).pathname}`);
    await page.locator("body > nav").getByRole("link", { name: "Log in" }).waitFor();
    check(true, "its navigation offers Log in");
    await screenshot("deleted");
    const gone = await failure(cy.client.auth.me());
    check(gone?.status === 401, `the session is over: ${say(gone)}`);

    await page.goto(`${app.url}/app/settings`);
    await page.waitForURL(/\/login\?next=/);
    check(true, `settings now sends the browser to log in: ${new URL(page.url()).pathname}`);
    await page.getByLabel("Email").fill(CY.email);
    await page.getByLabel("Password").fill(CY.password);
    await page.getByRole("button", { name: "Log in" }).click();
    const refused = page.locator(".error");
    await refused.waitFor();
    check((await refused.textContent()) === "Wrong email or password.", `logging in with the right password says "${await refused.textContent()}"`);
    const beaAfter = await bea.client.account.export();
    check(beaBefore !== null && same(withoutTime(beaAfter), withoutTime(beaBefore)), "Bea's data is still untouched");
  });

  await step("10. The page reached the server only through /api/v1, within its security policy", async () => {
    const outside = apiCalls.filter((call) => !call.split(" ")[1]!.startsWith("/api/v1/"));
    check(apiCalls.includes("GET /api/v1/account/export") && apiCalls.includes("DELETE /api/v1/account"), "it downloaded and deleted through the API");
    check(outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
}

await app.stop();
model.stop();
console.log(`\nscreenshots in ${OUT}`);

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nYour data holds up.");
