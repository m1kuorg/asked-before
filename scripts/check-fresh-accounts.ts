// Checks what keeps fresh accounts from draining the app's daily caps
// (m1kuorg/basics#69), on a fresh copy of the app. Each caller's address is
// set as Cloudflare would name it, in CF-Connecting-IP. The throttle counts
// an IPv6 caller's tries by its /64, so addresses in one /64 share 20 tries
// in 15 minutes and another /64 keeps its own. Sign-ups are capped small,
// at 2 a UTC day for each network, an IPv4 address or an IPv6 /64: a third
// gets 429, through the SDK and in the sign-up page, while another network
// still signs up, and a sign-up refused for an email in use doesn't count.
// An account made today, on its first UTC day, reaches only part of the
// app's daily caps, set small: 2 of the app's 4 model requests, one sort's
// batch and second pass, and 60 of its 90 phrasings, counted across every
// account. Past it, an account made today gets 429 for a sort, a cold rep,
// and a chunk, through the SDK and in the upload page, while an account
// made before today, aged a day in the database, still uploads and sorts,
// up to the app's whole cap. A refused request counts toward nothing, as
// the database's counters show. The model is a stand-in here,
// answering as the answer key sorts the demo export.
// It prints each step's checks, saves a screenshot of each page, and exits
// 1 if any fails, naming the step.
// Run: bun run check:fresh-accounts [screenshot dir]

import { ApiError, type Phrasing } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { keySorter, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-fresh-accounts");
const DEMO = join(import.meta.dir, "..", "demo", "export.json");
const NETWORK_SIGNUPS = 2;
const PAST_SIGNUPS = `Asked Before makes at most ${NETWORK_SIGNUPS} accounts a day from one internet connection, and this one has made today's. More open at midnight UTC.`;
const PAST_FIRST_DAY_MODEL = "Asked Before has made all the model requests it can today for accounts made today. More open at midnight UTC.";
const PAST_FIRST_DAY_PHRASINGS = "These phrasings would pass what Asked Before can take today from accounts made today. More open at midnight UTC.";
const PAST_SITE_PHRASINGS = "These phrasings would pass what Asked Before can take today, across every account. More open at midnight UTC.";

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
  NETWORK_DAILY_SIGNUPS: String(NETWORK_SIGNUPS),
  SITE_DAILY_MODEL_REQUESTS: "4",
  FIRST_DAY_SITE_DAILY_MODEL_REQUESTS: "2",
  SITE_DAILY_PHRASINGS: "90",
  FIRST_DAY_SITE_DAILY_PHRASINGS: "60",
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

/** A page in a browser calling from `address`, as Cloudflare would name it. */
async function pageFrom(address: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, extraHTTPHeaders: { "cf-connecting-ip": address } });
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

/** A page in a browser calling from `address` and holding `one`'s session. */
async function pageOf(one: Browser, address: string): Promise<Page> {
  const page = await pageFrom(address);
  await page.context().addCookies(one.cookie().split("; ").map((pair) => pair.split("=")).map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
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

/** A new learner from `address` through the SDK, with a shelf. */
async function learner(address: string, name: string): Promise<Browser & { shelfId: string }> {
  const one = app.browser(address);
  await one.client.auth.signUp({ name, email: `${name.toLowerCase()}@example.com`, password: "a long enough password" });
  const { id } = await one.client.shelves.create({ name: "Bootcamp" });
  return { ...one, shelfId: id };
}

/** The phrasings each account and the app have counted today, and the app's model requests, from the database. */
function counted(): { accounts: Record<string, number>; site: { phrasings: number; modelRequests: number } } {
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  const rows = store.query("SELECT u.name, g.phrasings FROM usage g JOIN users u ON u.id = g.user_id").all() as { name: string; phrasings: number }[];
  const site = store.query("SELECT phrasings, model_requests AS modelRequests FROM site_usage").get() as { phrasings: number; modelRequests: number };
  store.close();
  return { accounts: Object.fromEntries(rows.map((row) => [row.name, row.phrasings])), site };
}

/** Signs up `name` from `address` through the SDK. */
const signUp = (address: string, name: string) =>
  app.browser(address).client.auth.signUp({ name, email: `${name.toLowerCase()}@example.com`, password: "a long enough password" });

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

const TOO_MANY_TRIES = "Too many tries. Wait a few minutes, then try again.";

try {
  await step("1. Log-in tries from addresses in one IPv6 /64 share its 20, and another /64 keeps its own", async () => {
    const wrong = { email: "nobody@example.com", password: "not the password at all" };
    const answers: (ApiError | null)[] = [];
    // Twenty addresses, each written its own way, all in 2001:db8:1:1::/64.
    for (let i = 1; i <= 20; i++) answers.push(await failure(app.browser(i % 2 ? `2001:db8:1:1::${i.toString(16)}` : `2001:0DB8:0001:0001:${i.toString(16)}:0:0:1`).client.auth.logIn(wrong)));
    check(answers.every((answer) => answer?.status === 401), `20 tries from 20 addresses in the /64: ${[...new Set(answers.map((answer) => answer?.status))].join(", ")}`);
    const next = await failure(app.browser("2001:db8:1:1:ffff:ffff:ffff:ffff").client.auth.logIn(wrong));
    check(next?.status === 429 && next.message === TOO_MANY_TRIES, `a 21st from yet another address in it: ${say(next)}`);
    const other = await failure(app.browser("2001:db8:1:2::1").client.auth.logIn(wrong));
    check(other?.status === 401, `a try from the next /64: ${say(other)}`);
    const ipv4 = await failure(app.browser("203.0.113.1").client.auth.logIn(wrong));
    check(ipv4?.status === 401, `a try from an IPv4 address: ${say(ipv4)}`);
  });

  await step("2. One network signs up twice a day, then gets 429; another still signs up", async () => {
    for (const [network, addresses, names] of [
      ["an IPv6 /64", ["2001:db8:2:2::1", "2001:db8:2:2:ffff::2", "2001:db8:2:2::3"], ["Ann", "Ben", "Cal"]],
      ["an IPv4 address", ["203.0.113.7", "203.0.113.7", "203.0.113.7"], ["Amy", "Bo", "Cy"]],
    ] as const) {
      const made = [await failure(signUp(addresses[0], names[0])), await failure(signUp(addresses[1], names[1]))];
      check(made.every((error) => error === null), `${network} makes two accounts: ${made.map(say).join(", ")}`);
      const capped = await failure(signUp(addresses[2], names[2]));
      check(capped?.status === 429 && capped.message === PAST_SIGNUPS, `a third from ${network}: ${say(capped)}`);
    }
    const next = await failure(signUp("2001:db8:2:3::1", "Dot"));
    check(next === null, `the next /64 still signs up: ${say(next)}`);
    const neighbour = await failure(signUp("203.0.113.8", "Eli"));
    check(neighbour === null, `the next IPv4 address still signs up: ${say(neighbour)}`);
  });

  await step("3. A sign-up refused for an email in use doesn't count toward its network's", async () => {
    const first = await failure(signUp("198.51.100.1", "Fay"));
    const taken = await failure(signUp("198.51.100.1", "Fay"));
    check(first === null && taken?.status === 409, `Fay signs up, then again: ${say(taken)}`);
    const second = await failure(signUp("198.51.100.1", "Gus"));
    check(second === null, `a second account from that address: ${say(second)}`);
    const third = await failure(signUp("198.51.100.1", "Hal"));
    check(third?.status === 429, `and a third: ${say(third)}`);
    const again = await failure(signUp("198.51.100.1", "Gus"));
    check(again?.status === 409, `Gus signing up again from there, at its cap, is told the email has an account: ${say(again)}`);
    const mapped = [await failure(signUp("::ffff:198.51.100.2", "Ida")), await failure(signUp("::ffff:198.51.100.3", "Jay")), await failure(signUp("::FFFF:198.51.100.4", "Kim"))];
    check(mapped.every((error) => error === null), `three IPv4 addresses written in IPv6 are three networks: ${mapped.map(say).join(", ")}`);
  });

  await step("4. The sign-up page shows a network past its sign-ups", async () => {
    const page = await pageFrom("2001:db8:2:2:1234:5678:9abc:def0");
    await page.goto(`${app.url}/signup`);
    await page.getByLabel("Name").fill("Ivy");
    await page.getByLabel("Email").fill("ivy@example.com");
    await page.getByLabel("Password").fill("a long enough password");
    await page.getByRole("button", { name: "Sign up" }).click();
    const notice = page.locator(".block .error");
    await notice.waitFor();
    const said = ((await notice.textContent()) ?? "").trim();
    check(said === PAST_SIGNUPS, `the notice says "${said}"`);
    check(new URL(page.url()).pathname === "/signup", "and the page stays on sign up");
  });

  const jo = await learner("192.0.2.10", "Jo");
  const kit = await learner("192.0.2.11", "Kit");
  const lee = await learner("192.0.2.12", "Lee");
  // An account's creation time is the server's clock, which no endpoint sets, so Lee's first day passes here, in
  // the database, rather than in a day's wait: one of the read-only rule's documented exceptions (docs/code-map.md).
  const store = new Database(app.databasePath, { strict: true });
  store.query("UPDATE users SET created_at = created_at - 24 * 60 * 60 * 1000 WHERE name = 'Lee'").run();
  store.close();

  await step("5. Past the app's first-day model requests, an account made today fails a sort, which the page shows, and gets 429 for a cold rep", async () => {
    const sorted = await sortEnds(jo.client, (await upload(jo.client, jo.shelfId, phrasings)).id);
    check(sorted.status === "sorted" && model.requests.length === 2, `Jo's demo upload is sorted, with the app's two first-day model requests, its batch and its second pass: ${sorted.status}, ${model.requests.length}`);
    const page = await pageOf(kit, "192.0.2.11");
    await page.goto(`${app.url}/app/shelves/${kit.shelfId}/upload`);
    await page.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
    await page.locator(".block").getByRole("button", { name: "Upload 27 messages" }).click();
    await page.waitForURL(/[?&]upload=/);
    await page.locator(".block .error").waitFor();
    const said = ((await page.locator(".block .error").textContent()) ?? "").trim();
    check(said === PAST_FIRST_DAY_MODEL, `Kit's upload is stored, and the page says "${said}"`);
    const failed = await kit.client.uploads.get(new URL(page.url()).searchParams.get("upload")!);
    check(failed.status === "failed" && failed.error === PAST_FIRST_DAY_MODEL && failed.phrasings === 27, `the API has it ${failed.status}: "${failed.error}"`);
    const rep = await failure(jo.client.reps.start((await jo.client.cards.list(jo.shelfId))[0]!.id));
    check(rep?.status === 429 && rep.message === PAST_FIRST_DAY_MODEL, `a cold rep of Jo's: ${say(rep)}`);
    check(model.requests.length === 2, `and the model wasn't asked again: ${model.requests.length} requests`);
  });

  await step("6. Past the app's first-day phrasings, an account made today gets 429 for a chunk, which the page shows; one that just fits is stored", async () => {
    const open = await jo.client.uploads.create(jo.shelfId, { source: "chatgpt", fileName: "conversations.json" });
    const over = await failure(jo.client.uploads.append(open.id, fresh(7, "jo")));
    check(over?.status === 429 && over.message === PAST_FIRST_DAY_PHRASINGS, `a chunk of 7 from Jo, with 54 of 60 counted: ${say(over)}`);
    const fits = await jo.client.uploads.append(open.id, fresh(6, "jo"));
    check(fits.phrasings === 6, `a chunk of 6 is stored: ${fits.phrasings} phrasings`);
    const page = await pageOf(kit, "192.0.2.11");
    const said = await sendDemo(page, (await kit.client.shelves.create({ name: "Work" })).id);
    check(said === PAST_FIRST_DAY_PHRASINGS, `Kit's next upload, in the page, says "${said}"`);
    check(await page.locator(".block").getByRole("button", { name: "Try again" }).isVisible(), "with a Try again button");
  });

  await step("7. An account made before today isn't held to the first day's part, only to the app's whole cap", async () => {
    const sorted = await sortEnds(lee.client, (await upload(lee.client, lee.shelfId, phrasings)).id);
    check(sorted.status === "sorted" && sorted.phrasings === 27, `Lee's demo upload, past the 60, is stored and sorted: ${sorted.status}, ${sorted.phrasings} phrasings`);
    check(model.requests.length === 4, `with two more model requests: ${model.requests.length}`);
    const open = await lee.client.uploads.create(lee.shelfId, { source: "chatgpt", fileName: "conversations.json" });
    const over = await failure(lee.client.uploads.append(open.id, fresh(4, "lee")));
    check(over?.status === 429 && over.message === PAST_SITE_PHRASINGS, `a chunk of 4 from Lee, with 87 of 90 counted: ${say(over)}`);
  });

  await step("8. A refused request counts toward nothing", async () => {
    const { accounts, site } = counted();
    const want = { accounts: { Jo: 33, Kit: 27, Lee: 27 }, site: { phrasings: 87, modelRequests: 4 } };
    const got = { accounts: { Jo: accounts.Jo, Kit: accounts.Kit, Lee: accounts.Lee }, site };
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
console.log("\nFresh accounts can't drain the app's day.");
