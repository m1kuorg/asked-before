// Checks the daily caps that keep the app inside Workers Free
// (m1kuorg/basics#68): since m1kuorg/basics#73 there are two, each for the
// whole app and counted once for everyone, guests included. A fresh copy of
// the app runs with small ones, 4 model requests and 60 phrasings a day,
// and with the caps that went (each account's own, a network's sign-ups,
// and a new account's first day) set to 1, which caps nothing now. The
// model is a stand-in in this script, answering as the answer key sorts the
// demo export, and a cold rep as a step queues it. Through the SDK and in
// the upload page, in a real browser at 1920×1080: five accounts sign up
// from one address; two accounts and the guest spend the app's 4 model
// requests between them, and then a cold rep, its check, a capture, and a
// sort each answer 429 with the app's message, whoever sends them, which
// the upload page shows; and the app's phrasings, spent the same way, refuse
// any account's chunk past them, while a chunk that just fits is stored. The
// app's counters in the database say the same, and a refused request
// counts toward nothing. It prints each step's checks, saves a screenshot
// of each page, and exits 1 if any fails, naming the step.
// Run: bun run check:caps [screenshot dir]

import { ApiError, type Phrasing } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { known, repReply, sortsByKey } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-caps");
const DEMO = join(import.meta.dir, "..", "demo", "export.json");

const PAST_MODEL = "Asked Before has used today's model requests for everyone. More open at midnight UTC.";
const PAST_PHRASINGS = "These phrasings would pass what Asked Before can take today for everyone. More open at midnight UTC.";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
// Sorts as the key does; a cold rep takes the answer a step queues, and anything else is refused.
const model = await startModelStub(sortsByKey(refuse()));
const app = await startApp({
  ANTHROPIC_BASE_URL: model.url,
  ANTHROPIC_API_KEY: "stand-in",
  SITE_DAILY_MODEL_REQUESTS: "4",
  SITE_DAILY_PHRASINGS: "60",
  // The caps m1kuorg/basics#73 removed, set as small as they went: none of them holds anything back now.
  DAILY_MODEL_REQUESTS: "1",
  DAILY_PHRASINGS: "1",
  FIRST_DAY_SITE_DAILY_MODEL_REQUESTS: "1",
  FIRST_DAY_SITE_DAILY_PHRASINGS: "1",
  NETWORK_DAILY_SIGNUPS: "1",
});
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

/** A page in a browser holding `one`'s session. */
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

/** The page's notices: its alerts, inside main. */
const alerts = (page: Page) => page.getByRole("main").getByRole("alert");
/** What a locator shows, its whitespace collapsed. */
const words = async (locator: Locator) => ((await locator.first().innerText()) ?? "").replace(/\s+/g, " ").trim();
/** Whether the page's one notice holds `message` word for word, as a line of its own. */
const says = async (page: Page, message: string) => (await alerts(page).count()) === 1 && (await alerts(page).getByText(message, { exact: true }).isVisible());

/** Chooses the demo export on the shelf's upload page and sends its 27 messages, as a learner would. */
async function sendDemo(page: Page, shelfId: string) {
  const main = page.getByRole("main");
  await page.goto(`${app.url}/app/shelves/${shelfId}/upload`);
  await main.getByRole("button", { name: "Drop your chat export here Choose a file", exact: true }).setInputFiles(DEMO);
  await main.getByRole("button", { name: "Upload 27 messages", exact: true }).click();
}

/** Phrasings no export holds, for a chunk. */
const fresh = (n: number, tag: string): Phrasing[] =>
  Array.from({ length: n }, (_, i) => ({ sourceId: `${tag}-${i}`, text: `A question of ${tag}'s, number ${i}`, time: "2026-10-01T09:00:00.000Z" }));

/** The phrasings and model requests the app has counted today, from the database. */
function counted(): { phrasings: number; modelRequests: number } {
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  const site = store.query("SELECT phrasings, model_requests AS modelRequests FROM site_usage").get() as { phrasings: number; modelRequests: number };
  store.close();
  return site;
}

const learners = new Map<string, Browser & { shelfId: string }>();
const guest = app.browser();
/** The guest's demo shelf, its card A, and the cold rep the guest starts on it. */
const guestHas = { shelfId: "", cardId: "", repId: "" };

try {
  await step("1. Five accounts sign up from one address, with a network's sign-ups set to 1", async () => {
    for (const name of ["Cy", "Dee", "Eve", "Fay", "Gus"]) {
      const one = app.browser();
      const made = await failure(one.client.auth.signUp({ name, email: `${name.toLowerCase()}@example.com`, password: "a long enough password" }));
      if (!made) learners.set(name, { ...one, shelfId: (await one.client.shelves.create({ name: "Bootcamp" })).id });
      check(made === null, `${name} signs up: ${say(made)}`);
    }
    // Signing in restores the guest workspace's demo shelf for the day, with no model request.
    await guest.client.auth.signInAsGuest();
    check((await guest.client.auth.me()).guest, "and the guest signs in");
  });

  await step("2. Two accounts and the guest spend the app's 4 model requests between them, past the caps each account had", async () => {
    const cy = learners.get("Cy")!;
    const sorted = await sortEnds(cy.client, (await upload(cy.client, cy.shelfId, phrasings)).id);
    check(sorted.status === "sorted" && model.requests.length === 2, `Cy's sort spends 2, its batch and its second pass: ${sorted.status}, ${model.requests.length} requests`);
    const [demo] = await guest.client.shelves.list();
    const [cardA] = await guest.client.cards.list(demo!.id);
    model.queue(repReply("A guest's problem.", "A guest's lesson."));
    const { rep } = await guest.client.reps.start(cardA!.id);
    check(rep.problem === "A guest's problem." && model.requests.length === 3, `the guest's cold rep spends 1: ${model.requests.length} requests`);
    const dee = learners.get("Dee")!;
    await dee.client.captures.create(dee.shelfId, { text: "how do i rename a git branch" });
    const second = await dee.client.captures.create(dee.shelfId, { text: "what's the command to rename a branch in git" });
    check(second.card === null && model.requests.length === 4, `Dee's second capture, sorted against her first, spends the last: ${model.requests.length} requests`);
    Object.assign(guestHas, { shelfId: demo!.id, cardId: cardA!.id, repId: rep.id });
  });

  await step("3. Past them, every model request is a 429 with the app's message, whoever sends it", async () => {
    const cy = learners.get("Cy")!;
    const dee = learners.get("Dee")!;
    const cyCard = (await cy.client.cards.list(cy.shelfId))[0]!;
    const refused = {
      "Cy's cold rep": await failure(cy.client.reps.start(cyCard.id)),
      "the guest's check": await failure(guest.client.reps.check(guestHas.repId, { answer: known.right })),
      "the guest's next cold rep": await failure(guest.client.reps.start(guestHas.cardId)),
      "Dee's capture": await failure(dee.client.captures.create(dee.shelfId, { text: "how do i delete a git branch" })),
    };
    for (const [what, error] of Object.entries(refused)) check(error?.status === 429 && error.message === PAST_MODEL, `${what}: ${say(error)}`);
    check(model.requests.length === 4, `and the model wasn't asked again: ${model.requests.length} requests`);
  });

  await step("4. The upload page shows a sort past the app's model requests", async () => {
    const eve = learners.get("Eve")!;
    const page = await pageOf(eve);
    await sendDemo(page, eve.shelfId);
    await page.waitForURL(/[?&]upload=/);
    await alerts(page).first().waitFor();
    check(await says(page, PAST_MODEL), `Eve's upload is stored, and the page says "${await words(alerts(page))}"`);
    const failed = await eve.client.uploads.get(new URL(page.url()).searchParams.get("upload")!);
    check(failed.status === "failed" && failed.error === PAST_MODEL && failed.phrasings === 27, `the API has it ${failed.status}: "${failed.error}"`);
    check(await page.getByRole("main").getByRole("button", { name: "Try again", exact: true }).isVisible(), "with a Try again button");
  });

  await step("5. Past the app's phrasings, any account's chunk is a 429, and the page shows it; one that just fits is stored", async () => {
    // Cy's 27, Eve's 27, and Dee's 3 captures, the one refused at the model counted too, make 57 of 60.
    check(counted().phrasings === 57, `57 of 60 are counted: ${counted().phrasings}`);
    const open = await guest.client.uploads.create(guestHas.shelfId, { source: "chatgpt", fileName: "conversations.json" });
    const over = await failure(guest.client.uploads.append(open.id, fresh(4, "guest")));
    check(over?.status === 429 && over.message === PAST_PHRASINGS, `the guest's chunk of 4: ${say(over)}`);
    const fits = await guest.client.uploads.append(open.id, fresh(3, "guest"));
    check(fits.phrasings === 3, `a chunk of 3 is stored: ${fits.phrasings} phrasings`);
    const fay = learners.get("Fay")!;
    const page = await pageOf(fay);
    await sendDemo(page, fay.shelfId);
    await alerts(page).first().waitFor();
    check(await says(page, PAST_PHRASINGS), `Fay's upload, her first, says "${await words(alerts(page))}"`);
    check(!new URL(page.url()).searchParams.has("upload"), `and stays on sending, with no upload to watch: ${new URL(page.url()).search || "no query"}`);
    check(await alerts(page).getByRole("button", { name: "Try again", exact: true }).isVisible(), "with a Try again button");
  });

  await step("6. The app's counters hold what was taken, and nothing refused", async () => {
    const got = counted();
    const want = { phrasings: 60, modelRequests: 4 };
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
console.log("\nThe app's daily caps hold, for everyone at once.");
