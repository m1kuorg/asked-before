// Checks the daily caps that keep the app inside Workers Free
// (m1kuorg/basics#68) on a fresh copy of the app with small ones: 30
// phrasings a day for each account, 60 for the whole app, and 1 model
// request for the whole app. The model is a stand-in in this script,
// answering as the answer key sorts the demo export. Through the SDK and in
// the upload page, in a real browser at 1920×1080: an account past its
// phrasings gets 429, for a capture and for an upload's chunk, and the page
// shows it; the app past its one model request fails the next sort, which
// the page shows, and answers a cold rep 429; and the app past its
// phrasings answers any account's chunk 429, which the page shows, while a
// chunk that just fits is stored. A refused request counts toward neither
// cap, as the database's counters show, though a trigger this script adds
// keeps every account's count from going down: a refusal must leave the
// account's count where it was, not take it and give it back
// (m1kuorg/basics#70). It prints each step's checks, saves a screenshot of
// each page, and exits 1 if any fails, naming the step.
// Run: bun run check:caps [screenshot dir]

import { ApiError, type Phrasing } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { keySorter, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-caps");
const DEMO = join(import.meta.dir, "..", "demo", "export.json");
const ACCOUNT_PHRASINGS = 30;
const SITE_PHRASINGS = 60;

const PAST_ACCOUNT = `Your account can send ${ACCOUNT_PHRASINGS} phrasings a day, uploads and captures together, and these would pass today's. More open at midnight UTC.`;
const PAST_SITE = "These phrasings would pass what Asked Before can take today, across every account. More open at midnight UTC.";
const PAST_MODEL = "Asked Before has made all the model requests it can today, across every account. More open at midnight UTC.";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({
  ANTHROPIC_BASE_URL: model.url,
  DAILY_PHRASINGS: String(ACCOUNT_PHRASINGS),
  SITE_DAILY_PHRASINGS: String(SITE_PHRASINGS),
  SITE_DAILY_MODEL_REQUESTS: "1",
});
// No endpoint can make the database fail a write, so the give-back's failing (m1kuorg/basics#70) is made here, in
// the database: every account's count may only go up, for the whole run. One of the read-only rule's documented
// exceptions (docs/code-map.md).
{
  const store = new Database(app.databasePath, { strict: true });
  store.run(`CREATE TRIGGER usage_only_goes_up BEFORE UPDATE ON usage
    WHEN NEW.phrasings < OLD.phrasings OR NEW.model_requests < OLD.model_requests
    BEGIN SELECT RAISE(ABORT, 'an account''s count went down'); END`);
  store.close();
}
const browser = await chromium.launch();
const pages: Page[] = [];
const errors: string[] = [];

/** Runs a step, and saves a screenshot of the page it opened, if any. */
async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  const opened = pages.length;
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  const page = pages.length > opened ? pages.at(-1) : undefined;
  if (page) await page.screenshot({ path: join(OUT, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

/** The ApiError a call fails with, or null when it doesn't fail. */
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

/** A new learner through the SDK, with a shelf. */
async function learner(name: string): Promise<Browser & { shelfId: string }> {
  const one = app.browser();
  await one.client.auth.signUp({ name, email: `${name.toLowerCase()}@example.com`, password: "a long enough password" });
  const { id } = await one.client.shelves.create({ name: "Bootcamp" });
  return { ...one, shelfId: id };
}

/** A page in a browser holding the learner's session. */
async function pageOf(one: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await context.addCookies(one.cookie().split("; ").map((pair) => pair.split("=")).map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  pages.push(page);
  return page;
}

/** Sends the demo export from the shelf's upload page, as a learner would, and returns the notice the page shows. */
async function sendDemo(page: Page, shelfId: string): Promise<string> {
  await page.goto(`${app.url}/app/shelves/${shelfId}/upload`);
  await page.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
  await page.locator(".block").getByRole("button", { name: "Upload 27 messages" }).click();
  const notice = page.locator(".block .error");
  await notice.waitFor();
  return ((await notice.textContent()) ?? "").trim();
}

/** Phrasings no export holds, for a chunk. */
const fresh = (n: number, tag: string): Phrasing[] =>
  Array.from({ length: n }, (_, i) => ({ sourceId: `${tag}-${i}`, text: `A question of ${tag}'s, number ${i}`, time: "2026-10-01T09:00:00.000Z" }));

type Counts = { phrasings: number; modelRequests: number };

/** The phrasings and model requests each account and the app have counted today, from the database. */
function counted(): { accounts: Record<string, Counts>; site: Counts } {
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  const rows = store.query("SELECT u.name, g.phrasings, g.model_requests AS modelRequests FROM usage g JOIN users u ON u.id = g.user_id").all() as ({ name: string } & Counts)[];
  const site = store.query("SELECT phrasings, model_requests AS modelRequests FROM site_usage").get() as Counts;
  store.close();
  return { accounts: Object.fromEntries(rows.map(({ name, ...counts }) => [name, counts])), site };
}

const cy = await learner("Cy");
const dee = await learner("Dee");
const eve = await learner("Eve");

try {
  await step("1. An account sends phrasings up to its cap, then gets 429 for a capture and for a chunk", async () => {
    const sorted = await sortEnds(cy.client, (await upload(cy.client, cy.shelfId, phrasings)).id);
    check(sorted.status === "sorted" && sorted.phrasings === 27, `the demo export's 27 are stored and sorted: ${sorted.status}`);
    // Words already on a card join it without the model.
    const borrows = (await cy.client.cards.get((await cy.client.cards.list(cy.shelfId))[0]!.id)).borrows.map((borrow) => borrow.text);
    for (const text of borrows.slice(0, 3)) await cy.client.captures.create(cy.shelfId, { text });
    check(true, "three captures bring it to 30");
    const capture = await failure(cy.client.captures.create(cy.shelfId, { text: borrows[3]! }));
    check(capture?.status === 429 && capture.message === PAST_ACCOUNT, `a fourth capture: ${say(capture)}`);
    const open = await cy.client.uploads.create(cy.shelfId, { source: "chatgpt", fileName: "conversations.json" });
    const chunk = await failure(cy.client.uploads.append(open.id, fresh(1, "cy")));
    check(chunk?.status === 429 && chunk.message === PAST_ACCOUNT, `a chunk of one: ${say(chunk)}`);
    check((await cy.client.uploads.get(open.id)).messages === 0, "and the chunk stored nothing");
  });

  await step("2. The upload page shows an account past its phrasings", async () => {
    const page = await pageOf(cy);
    const said = await sendDemo(page, (await cy.client.shelves.create({ name: "Work" })).id);
    check(said === PAST_ACCOUNT, `the notice says "${said}"`);
    check(await page.locator(".block").getByRole("button", { name: "Try again" }).isVisible(), "with a Try again button");
  });

  await step("3. Past the app's model requests, the next sort fails, the page shows it, and a cold rep gets 429", async () => {
    check(model.requests.length === 1, `Cy's sort made the app's one model request: ${model.requests.length}`);
    const page = await pageOf(dee);
    await page.goto(`${app.url}/app/shelves/${dee.shelfId}/upload`);
    await page.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
    await page.locator(".block").getByRole("button", { name: "Upload 27 messages" }).click();
    await page.waitForURL(/[?&]upload=/);
    await page.locator(".block .error").waitFor();
    const said = ((await page.locator(".block .error").textContent()) ?? "").trim();
    check(said === PAST_MODEL, `Dee's upload is stored, and the page says "${said}"`);
    const failed = await dee.client.uploads.get(new URL(page.url()).searchParams.get("upload")!);
    check(failed.status === "failed" && failed.error === PAST_MODEL && failed.phrasings === 27, `the API has it ${failed.status}: "${failed.error}"`);
    const rep = await failure(cy.client.reps.start((await cy.client.cards.list(cy.shelfId))[0]!.id));
    check(rep?.status === 429 && rep.message === PAST_MODEL, `a cold rep on another account: ${say(rep)}`);
    check(model.requests.length === 1, `and the model wasn't asked again: ${model.requests.length} request`);
  });

  await step("4. Past the app's phrasings, any account's chunk gets 429, and the page shows it; one that just fits is stored", async () => {
    const page = await pageOf(eve);
    const said = await sendDemo(page, eve.shelfId);
    check(said === PAST_SITE, `Eve's first upload, under her own cap, says "${said}"`);
    const open = await eve.client.uploads.create(eve.shelfId, { source: "chatgpt", fileName: "conversations.json" });
    const over = await failure(eve.client.uploads.append(open.id, fresh(4, "eve")));
    check(over?.status === 429 && over.message === PAST_SITE, `a chunk of 4, with 57 of 60 counted: ${say(over)}`);
    const fits = await eve.client.uploads.append(open.id, fresh(3, "eve"));
    check(fits.phrasings === 3, `a chunk of 3 is stored: ${fits.phrasings} phrasings`);
  });

  await step("5. A refused request counts toward neither cap, with no account's count ever going down", async () => {
    const { accounts, site } = counted();
    const want = {
      accounts: { Cy: { phrasings: 30, modelRequests: 1 }, Dee: { phrasings: 27, modelRequests: 0 }, Eve: { phrasings: 3, modelRequests: 0 } },
      site: { phrasings: 60, modelRequests: 1 },
    };
    const got = { accounts: { Cy: accounts.Cy, Dee: accounts.Dee, Eve: accounts.Eve }, site };
    check(JSON.stringify(got) === JSON.stringify(want), `counted ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nThe daily caps hold.");
