// Checks signing in as a guest to the shared guest workspace
// (m1kuorg/basics#73) on a fresh copy of the app, in real browsers at
// 1920×1080 and through the SDK. "Sign in as a guest" on the landing page,
// the day's first, restores the guest workspace's demo shelf from
// demo/sorted.json with no model request, and lands on the Desk with it,
// sorted as the answer key sorts the demo export;
// a second browser, signing in from the log-in page, and a third, from the
// sign-up page, share the same shelves and see the first guest's cold rep;
// a guest's navigation names the shared guest and has no Settings, whose
// page holds nothing of the account's and whose API answers a guest 403;
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
import { chromium, type Page } from "playwright";
import { compareWithKey, key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { repReply, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-guest");
const DEMO = join(import.meta.dir, "..", "demo", "export.json");
const FRAME = { width: 1920, height: 1080 };
const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOR_GUESTS = "A guest can't do this. Sign up for an account of your own to do it.";

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

const text = async (page: Page, selector: string) => ((await page.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();

/** Clicks "Sign in as a guest" on a public page and waits for the Desk. */
async function signInAsGuest(page: Page, path: string): Promise<void> {
  await page.goto(`${app.url}${path}`);
  // The landing page offers it in its head and its close; the head's comes first.
  await page.getByRole("button", { name: "Sign in as a guest" }).first().click();
  await page.waitForURL(/\/app\/desk$/);
  await page.locator(".block h1").waitFor();
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
  await step("1. Sign in as a guest from the landing page: the Desk, with the demo shelf already sorted", async () => {
    const before = model.requests.length;
    await signInAsGuest(first, "/");
    check((await text(first, ".block h1")) === "Still borrowed", `it lands on the Desk: "${await text(first, ".block h1")}"`);
    const rows = first.locator(".block table").first();
    check((await rows.textContent())?.includes(key.skills[0]!.name) ?? false, `the Desk's rows hold "${key.skills[0]!.name}"`);
    check(await rows.locator(".demo-label").first().isVisible(), "on a shelf labeled demo data");
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

  await step("2. The navigation names the shared guest, with Sign up and no Settings", async () => {
    const nav = first.locator("body > nav");
    check((await nav.textContent())?.includes("Shared guest") ?? false, `the navigation says "Shared guest": "${(await nav.textContent())?.replace(/\s+/g, " ")}"`);
    check((await nav.getByRole("link", { name: "Settings", exact: true }).count()) === 0, "it has no Settings");
    check((await nav.getByRole("link", { name: "Sign up", exact: true }).getAttribute("href")) === "/signup", "it has Sign up, to the sign-up page");
    check(await nav.getByRole("button", { name: "Log out" }).isVisible(), "and Log out");
    const me = await (await clientOf(first)).auth.me();
    check(me.guest && me.name === "Guest", `auth.me says it's the guest: ${JSON.stringify({ name: me.name, guest: me.guest })}`);
  });

  await step("3. A guest's cold rep, passed, is the next guest's too, from the log-in page and the sign-up page", async () => {
    model.queue(repReply("A guest's problem.", "A guest's lesson."), verdictReply("pass", "You did it."));
    await first.goto(`${app.url}/app/cards/${cardA}`);
    await first.locator(".block").getByRole("button", { name: "Take a cold rep" }).click();
    await first.locator(".answer-box textarea").fill("My own answer.");
    await first.getByRole("button", { name: "Check my answer" }).click();
    await first.getByRole("button", { name: "Back to the stack" }).waitFor();
    await signInAsGuest(second, "/login");
    const returns = second.locator(".block .latest-returns");
    check((await returns.textContent())?.includes(key.skills[0]!.name) ?? false, `the second guest's Desk lists "${key.skills[0]!.name}" among its latest returns`);
    const seen = await (await clientOf(second)).cards.get(cardA);
    check(seen.status === "returned" && seen.reps.length === 1 && seen.reps[0]!.answer === "My own answer.", `the card is returned, with the first guest's rep and answer: ${seen.status}, ${seen.reps.length} rep`);
    await signInAsGuest(third, "/signup");
    const shelves = (await (await clientOf(third)).shelves.list()).map((shelf) => shelf.id);
    check(shelves.length === 1 && shelves[0] === demo.id, "a third guest, from the sign-up page, has the same shelves");
    return second;
  });

  await step("4. Settings holds nothing of the account's for a guest, and its API answers a guest 403", async () => {
    await first.goto(`${app.url}/app/settings`);
    await first.locator(".block .empty").waitFor();
    check((await first.locator(".block form, .block input, .block .code-block").count()) === 0, "the settings page has no form, field, or setup snippet");
    check(await first.locator(".block .empty").getByRole("link", { name: "Sign up" }).isVisible(), `it leads to Sign up: "${await text(first, ".block .empty")}"`);
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
    const warning = first.locator(".block .guest-warning");
    await warning.waitFor();
    const said = await text(first, ".block .guest-warning");
    check(/every guest/i.test(said) && /midnight UTC/.test(said), `the warning says "${said}"`);
    const order = await first.locator(".block").evaluate((block) => {
      const warned = block.querySelector(".guest-warning");
      const zone = block.querySelector(".drop-zone");
      return !!warned && !!zone && (warned.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    check(order, "above the drop zone");
    await first.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
    await first.locator(".block").getByRole("button", { name: "Upload 27 messages" }).waitFor();
    check(await warning.isVisible(), "and still there beside the preview, before anything is sent");
    await first.locator(".block").getByRole("button", { name: "Upload 27 messages" }).click();
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
    await first.locator(".block table").first().waitFor();
    check(new URL(first.url()).pathname === "/app/desk" && ((await first.locator(".block table").first().textContent())?.includes(key.skills[0]!.name) ?? false), "the first guest's Desk shows the restored shelf's cards");
    const again = await cron(tomorrow + 1000);
    const still = await guest.shelves.list();
    check(again.ok && still.length === 1 && still[0]!.id === shelves[0]!.id, "the cron's next run that day changes nothing");
    const adas = await ada.client.shelves.list();
    check(adas.length === 1 && adas[0]!.id === adaShelf.id && adas[0]!.counts.cards === key.skills.length, `another account's shelves are as they were: ${adas.map((s) => `${s.name} ${s.counts.cards} cards`).join(", ")}`);
    return first;
  });

  await step("8. Signing up from the guest's navigation leads to an account of one's own", async () => {
    const wasGuest = await clientOf(first);
    await first.locator("body > nav").getByRole("link", { name: "Sign up", exact: true }).click();
    await first.waitForURL(/\/signup$/);
    await first.getByLabel("Name").fill("Bea Example");
    await first.getByLabel("Email").fill("bea@example.com");
    await first.getByLabel("Password").fill("a long enough password");
    await first.getByRole("button", { name: "Sign up", exact: true }).click();
    await first.waitForURL(/\/app\/desk$/);
    await first.locator(".block .empty").waitFor();
    const nav = (await first.locator("body > nav").textContent()) ?? "";
    check(nav.includes("Bea Example") && !nav.includes("Shared guest") && (await first.locator("body > nav").getByRole("link", { name: "Settings", exact: true }).isVisible()), "the navigation names Bea, with Settings");
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
