// Checks signing in as a guest to the shared guest workspace
// (m1kuorg/basics#73) on a fresh copy of the app, in real browsers at
// 1920×1080 and through the SDK. "Try it as a guest" on the landing page,
// the day's first, restores the guest workspace's demo shelf from
// demo/sorted.json with no model request, and lands on Home with it,
// sorted as the answer key sorts the demo export;
// a second browser, signing in from the log-in page, and a third, from the
// sign-up page, share the same shelves and see the first guest's cold rep;
// a guest's navigation names the shared guest and has Settings, with no
// areas under it, leading to the guest's one view, which says why the guest
// has no settings and what an account's hold; its three paths (Account, API
// keys, Your data) each hold no form or snippet, and the API answers a
// guest 403 on every account and key endpoint;
// the Guest account can't be logged into with a password, signed up for,
// or given a key; a guest's upload page warns that every guest sees what's
// uploaded before a file is chosen; the cron, run at Wrangler's local route
// as at the next midnight UTC, wipes the guest workspace and restores the
// sorted demo shelf with no model request, counting the phrasings it
// deleted toward the new day's, while every guest stays signed in and
// another account's shelves stay as they were; and signing up from the guest's navigation leads to an account of
// one's own. The model is a stand-in in this script, sorting as the answer
// key does and answering a cold rep as a step queues it. It prints each
// step's checks, saves a screenshot of each page, and exits 1 if any fails,
// naming the step.
// Run: bun run check:guest [screenshot dir]

import { ApiError, createClient, type Client, type Shelf } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { compareWithKey, key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { repReply, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-guest");
const DEMO = join(import.meta.dir, "..", "demo", "export.json");
const FRAME = { width: 1920, height: 1080 };
const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOR_GUESTS = "A guest can't do this. Sign up for an account of your own to do it.";
/** The guest's settings view, at every settings path: its h2, and the h2 of what an account's settings hold. */
const GUEST_SETTINGS = "Settings are for your own account";
const ACCOUNTS_SETTINGS = "What an account's settings hold";
/** The guest's line in the sidebar, and the upload page's warning, word for word (inventory.md, "Copy with product, legal, or privacy weight"). */
const GUEST_LINE = "Every guest shares this workspace, and it's wiped daily at midnight UTC.";
const UPLOAD_WARNING =
  "You're signed in as the shared guest, so every guest will see what you upload here, with its cards and cold reps. The guest workspace is wiped daily at midnight UTC, though Cloudflare's backups keep it for up to 30 days. Sign up to keep an export to yourself.";
const A = key.skills[0]!.name;

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
// Sorts as the key does; a cold rep or its check takes the answer a step queues, and anything else is refused.
const model = await startModelStub(sortsByKey(refuse()));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();
const errors: string[] = [];
let shot = 0;

async function step(name: string, run: () => Promise<Page | void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    const page = await run();
    if (page) await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
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

/** Runs the cron as Wrangler's local route does, at `time`, as Cloudflare's scheduler would then. */
const cron = (time: number) => fetch(`${app.url}/cdn-cgi/local/scheduled?cron=${encodeURIComponent("*/5 * * * *")}&time=${time}`);

/** A fresh browser at 1920×1080, watching for console errors. */
async function newPage(): Promise<Page> {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}

/** The SDK, with the session cookie a page holds, as that browser's own requests send it. */
async function clientOf(page: Page): Promise<Client> {
  const cookie = (await page.context().cookies(app.url)).map(({ name, value }) => `${name}=${value}`).join("; ");
  return createClient({ baseUrl: app.url, fetch: (url, init) => fetch(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), cookie, origin: app.url } }) });
}

const words = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const main = (page: Page) => page.getByRole("main");
const nav = (page: Page) => page.getByRole("navigation", { name: "Asked Before" });
const h1 = (page: Page) => main(page).getByRole("heading", { level: 1 });
/** Home's "Prove next": the cards that need a cold rep, most asked first. */
const proveNext = (page: Page) => main(page).getByRole("region", { name: "Prove next", exact: true });

/** Waits for `success`, or fails at once with what an alert in the page's main says. */
async function settle(page: Page, success: Locator, timeout?: number) {
  const alert = main(page).getByRole("alert");
  await success.or(alert).first().waitFor({ timeout });
  if (!(await success.count())) throw new Error(`the page says "${await words(alert)}"`);
}

/** Presses "Try it as a guest" on a public page and waits for Home: in the landing page's head, or under the log-in or sign-up form. */
async function signInAsGuest(page: Page, path: string): Promise<void> {
  await page.goto(`${app.url}${path}`);
  const where = path === "/" ? page.getByRole("banner") : main(page).getByRole("region", { name: "Just looking?", exact: true });
  await where.getByRole("button", { name: "Try it as a guest", exact: true }).click();
  await page.waitForURL(/\/app\/desk$/);
  await h1(page).waitFor();
}

// Another account, whose shelves the guest workspace's reset must leave alone.
const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
const adaShelf = await ada.client.shelves.create({ name: "Work" });
await sortEnds(ada.client, (await upload(ada.client, adaShelf.id, phrasings)).id);

const first = await newPage();
const second = await newPage();
const third = await newPage();
let demo: Shelf;
let mine: Shelf;
let cardA = "";

try {
  await step("1. Sign in as a guest from the landing page: Home, with the demo shelf already sorted", async () => {
    const before = model.requests.length;
    await signInAsGuest(first, "/");
    // Home's h1 says how many cards need a cold rep: every card of the sorted demo shelf, none proven.
    const greeting = `${key.skills.length} cards need a cold rep, none is proven yet.`;
    await settle(first, main(first).getByRole("heading", { level: 1, name: greeting, exact: true }));
    check((await words(h1(first))) === greeting, `it lands on Home: "${await words(h1(first))}"`);
    const rows = proveNext(first);
    check(await rows.getByRole("link", { name: A, exact: true }).isVisible(), `Home's Prove next holds "${A}"`);
    check(await rows.getByText("Demo data", { exact: true }).first().isVisible(), "on a shelf labeled demo data");
    const guest = await clientOf(first);
    const shelves = await guest.shelves.list();
    check(shelves.length === 1 && shelves[0]!.name === "Demo" && shelves[0]!.demo, `the guest workspace holds one shelf: ${shelves.map((s) => `${s.name}${s.demo ? " (demo)" : ""}`).join(", ")}`);
    demo = shelves[0]!;
    const { lines, problems } = await compareWithKey(guest, demo.id);
    console.log(lines.join("\n"));
    check(problems.length === 0, problems.length ? problems.join("; ") : "its cards and unsorted are the answer key's");
    const [uploaded] = (await guest.uploads.list(demo.id)).uploads;
    check(uploaded?.status === "sorted" && uploaded.fileName === "demo-export.json" && uploaded.messages === phrasings.length, `with one sorted upload of the demo export: ${uploaded?.status}, ${uploaded?.messages} messages`);
    check(model.requests.length === before, `and no model request: ${model.requests.length - before}`);
    cardA = (await guest.cards.list(demo.id))[0]!.id;
    return first;
  });

  await step("2. The navigation names the shared guest, with Sign up, and Settings leading to the guest's view", async () => {
    const sidebar = nav(first);
    check((await sidebar.textContent())?.includes("Shared guest") ?? false, `the navigation says "Shared guest": "${await words(sidebar)}"`);
    check(await sidebar.getByText(GUEST_LINE, { exact: true }).isVisible(), "and that every guest shares the workspace, wiped daily at midnight UTC");
    check((await sidebar.getByRole("link", { name: "Sign up", exact: true }).getAttribute("href")) === "/signup", "it has Sign up, to the sign-up page");
    check(await sidebar.getByRole("button", { name: "Log out", exact: true }).isVisible(), "and Log out");
    const me = await (await clientOf(first)).auth.me();
    check(me.guest && me.name === "Guest", `auth.me says it's the guest: ${JSON.stringify({ name: me.name, guest: me.guest })}`);
    const settings = sidebar.getByRole("link", { name: "Settings", exact: true });
    check((await settings.getAttribute("href")) === "/app/settings", `it has Settings, to ${await settings.getAttribute("href")}`);
    await settings.click();
    await first.waitForURL(/\/app\/settings$/);
    await settle(first, main(first).getByRole("heading", { level: 2, name: GUEST_SETTINGS, exact: true }));
    // The view names its tab once it draws.
    await first.waitForFunction(() => document.title === "Settings · Asked Before", undefined, { timeout: 5_000 }).catch(() => {});
    check((await words(h1(first))) === "Settings" && (await first.title()) === "Settings · Asked Before", `it leads to the guest's view, headed Settings, and so is its tab: "${await first.title()}"`);
    check((await settings.getAttribute("aria-current")) === "page", "Settings is marked current");
    check((await sidebar.getByRole("list", { name: "Settings" }).count()) === 0, "with no areas under it");
    return first;
  });

  await step("3. A guest's cold rep, passed, is the next guest's too, from the log-in page and the sign-up page", async () => {
    model.queue(repReply("A guest's problem.", "A guest's lesson."), verdictReply("pass", "You did it."));
    await first.goto(`${app.url}/app/cards/${cardA}`);
    const rep = main(first).getByRole("region", { name: "Prove it without AI", exact: true });
    await rep.getByRole("button", { name: `Start a cold rep on ${A}`, exact: true }).click();
    const answer = rep.getByLabel("Your answer, in your own words, without AI", { exact: true });
    await settle(first, answer);
    await answer.fill("My own answer.");
    await rep.getByRole("button", { name: "Check my answer", exact: true }).click();
    await settle(first, rep.getByRole("link", { name: "Back to Home", exact: true }));
    await signInAsGuest(second, "/login");
    const proven = main(second).getByRole("list", { name: "Latest proven, latest first", exact: true });
    await settle(second, proven);
    check(await proven.getByRole("link", { name: A, exact: true }).isVisible(), `the second guest's Home lists "${A}" among the latest proven`);
    const seen = await (await clientOf(second)).cards.get(cardA);
    check(seen.status === "returned" && seen.reps.length === 1 && seen.reps[0]!.answer === "My own answer.", `the card is returned, with the first guest's rep and answer: ${seen.status}, ${seen.reps.length} rep`);
    await signInAsGuest(third, "/signup");
    const shelves = (await (await clientOf(third)).shelves.list()).map((shelf) => shelf.id);
    check(shelves.length === 1 && shelves[0] === demo.id, "a third guest, from the sign-up page, has the same shelves");
    return second;
  });

  await step("4. Settings holds no account or key form for a guest, at any of its three paths, and its API answers a guest 403", async () => {
    // Account last, so the screenshot is Settings' own path.
    for (const path of ["/app/settings/keys", "/app/settings/data", "/app/settings"]) {
      await first.goto(`${app.url}${path}`);
      const why = main(first).getByRole("region", { name: GUEST_SETTINGS, exact: true });
      await settle(first, why);
      check((await main(first).locator("form, input, textarea, pre, code").count()) === 0, `${path} has no form, field, or setup snippet`);
      const signUp = why.getByRole("link", { name: "Sign up", exact: true });
      check((await signUp.isVisible()) && (await signUp.getAttribute("href")) === "/signup", `it leads to Sign up: "${await words(why)}"`);
      const areas = await main(first).getByRole("region", { name: ACCOUNTS_SETTINGS, exact: true }).locator("dt").allTextContents();
      check(areas.join(", ") === "Account, API keys, Your data", `and says what an account's three areas hold: ${areas.join(", ")}`);
    }
    const guest = await clientOf(first);
    const refused = {
      "renaming the account": await failure(guest.account.update({ name: "Mallory" })),
      "changing its email": await failure(guest.account.update({ email: "mallory@example.com", password: "a long enough password" })),
      "changing its password": await failure(guest.account.changePassword({ currentPassword: "a long enough password", newPassword: "another long password" })),
      "downloading its data": await failure(guest.account.export()),
      "deleting it": await failure(guest.account.delete({ password: "a long enough password" })),
      "listing keys": await failure(guest.keys.list()),
      "making a key": await failure(guest.keys.create({ name: "Mine" })),
      "revoking a key": await failure(guest.keys.revoke("0123456789abcdef")),
    };
    for (const [what, error] of Object.entries(refused)) check(error?.status === 403 && error.message === NOT_FOR_GUESTS, `${what}: ${say(error)}`);
    const me = await guest.auth.me();
    check(me.name === "Guest", `the Guest account is as it was: ${me.name}`);
    return first;
  });

  await step("5. The Guest account can't be logged into with a password, and its email can't sign up", async () => {
    const { email } = await (await clientOf(first)).auth.me();
    const login = await failure(app.browser("198.51.100.7").client.auth.logIn({ email, password: "a long enough password" }));
    check(login?.status === 401 && login.message === "Wrong email or password.", `logging in with its email: ${say(login)}`);
    const signUp = await failure(app.browser("198.51.100.7").client.auth.signUp({ name: "Mallory", email, password: "a long enough password" }));
    check(email === "guest" && signUp?.status === 400, `signing up with its email, "${email}", which has no @: ${say(signUp)}`);
  });

  await step("6. A guest's upload page warns that every guest sees what's uploaded, before a file is chosen", async () => {
    const guest = await clientOf(first);
    mine = await guest.shelves.create({ name: "Mine" });
    await first.goto(`${app.url}/app/shelves/${mine.id}/upload`);
    const warning = main(first).getByRole("note");
    const input = main(first).locator('input[type="file"]');
    await settle(first, input);
    const said = await words(warning);
    check(said === UPLOAD_WARNING && /every guest/i.test(said) && /midnight UTC/.test(said), `the warning says "${said}"`);
    const order = await warning.evaluate((warned, zone) => zone !== null && (warned.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, await input.elementHandle());
    check(order, "above the drop target, before a file is chosen");
    await input.setInputFiles(DEMO);
    const send = main(first).getByRole("button", { name: `Upload ${phrasings.length} messages`, exact: true });
    await settle(first, send);
    check(await warning.isVisible(), "and still there beside the preview, before anything is sent");
    await send.click();
    await first.waitForURL(/[?&]upload=/);
    const sorted = await sortEnds(guest, new URL(first.url()).searchParams.get("upload")!);
    check(sorted.status === "sorted", `the guest's upload is sorted: ${sorted.status}`);
    const seen = (await (await clientOf(second)).shelves.list()).map((shelf) => shelf.name);
    check(seen.includes("Mine"), `and the second guest sees its shelf: ${seen.join(", ")}`);
    return first;
  });

  await step("7. The next day's cron wipes the guest workspace and restores the sorted demo shelf, with no model request; guests stay signed in", async () => {
    const before = model.requests.length;
    const tomorrow = Date.now() + DAY_MS;
    const ran = await cron(tomorrow);
    check(ran.ok, `the cron runs as at the next midnight UTC: ${ran.status}`);
    const guest = await clientOf(second);
    const shelves = await guest.shelves.list();
    check(shelves.length === 1 && shelves[0]!.name === "Demo" && shelves[0]!.demo && shelves[0]!.id !== demo.id, `the guest workspace holds one new demo shelf: ${shelves.map((s) => s.name).join(", ")}`);
    check((await failure(guest.shelves.get(mine.id)))?.status === 404, "the guest's own shelf is gone");
    const { problems } = await compareWithKey(guest, shelves[0]!.id);
    check(problems.length === 0, problems.length ? problems.join("; ") : "the demo shelf is sorted as the answer key sorts it, every card borrowed, with no rep");
    check(model.requests.length === before, `with no model request: ${model.requests.length - before}`);
    const store = new Database(app.databasePath, { readonly: true, strict: true });
    const counted = store.query("SELECT phrasings FROM site_usage WHERE day = ?").get(new Date(tomorrow).toISOString().slice(0, 10)) as { phrasings: number } | null;
    store.close();
    check(counted?.phrasings === 2 * phrasings.length, `the ${2 * phrasings.length} phrasings it deleted, the demo shelf's and the guest's own, count toward the new day's: ${counted?.phrasings}`);
    for (const [who, page] of [["first", first], ["second", second], ["third", third]] as const) {
      const me = await failure((await clientOf(page)).auth.me());
      check(me === null, `the ${who} guest is still signed in: ${say(me)}`);
    }
    await first.goto(`${app.url}/app/desk`);
    const restored = proveNext(first).getByRole("link", { name: A, exact: true });
    await settle(first, restored);
    check(new URL(first.url()).pathname === "/app/desk" && (await restored.isVisible()), "the first guest's Home shows the restored shelf's cards");
    const again = await cron(tomorrow + 1000);
    const still = await guest.shelves.list();
    check(again.ok && still.length === 1 && still[0]!.id === shelves[0]!.id, "the cron's next run that day changes nothing");
    const adas = await ada.client.shelves.list();
    check(adas.length === 1 && adas[0]!.id === adaShelf.id && adas[0]!.counts.cards === key.skills.length, `another account's shelves are as they were: ${adas.map((s) => `${s.name} ${s.counts.cards} cards`).join(", ")}`);
    return first;
  });

  await step("8. Signing up from the guest's navigation leads to an account of one's own", async () => {
    const wasGuest = await clientOf(first);
    await nav(first).getByRole("link", { name: "Sign up", exact: true }).click();
    await first.waitForURL(/\/signup$/);
    await first.getByLabel("Name", { exact: true }).fill("Bea Example");
    await first.getByLabel("Email", { exact: true }).fill("bea@example.com");
    await first.getByLabel("Password", { exact: true }).fill("a long enough password");
    await main(first).getByRole("button", { name: "Sign up", exact: true }).click();
    await first.waitForURL(/\/app\/desk$/);
    // An account of one's own starts empty: Home has no cards, and offers the demo shelf.
    await settle(first, main(first).getByRole("heading", { level: 1, name: "No cards yet.", exact: true }));
    check(await proveNext(first).getByRole("button", { name: "Try the demo shelf", exact: true }).isVisible(), "Home is empty, offering the demo shelf");
    const said = (await nav(first).textContent()) ?? "";
    check(said.includes("Bea Example") && !said.includes("Shared guest") && (await nav(first).getByRole("link", { name: "Settings", exact: true }).isVisible()), "the navigation names Bea, with Settings");
    const bea = await (await clientOf(first)).auth.me();
    check(!bea.guest && (await (await clientOf(first)).shelves.list()).length === 0, `Bea's own account, with no shelves: guest ${bea.guest}`);
    const ended = await failure(wasGuest.auth.me());
    check(ended?.status === 401, `this browser's guest session has ended: ${say(ended)}`);
    const guest = await failure((await clientOf(second)).auth.me());
    check(guest === null, `the second guest is still signed in: ${say(guest)}`);
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    return first;
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
console.log("\nGuests share one workspace, which resets daily, and nothing more.");
