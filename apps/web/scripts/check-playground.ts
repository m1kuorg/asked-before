// Checks the playground (/app/playground) end to end on a fresh copy of the
// app, in a real browser at 1440×900 and 390×844. It seeds a learner (signed
// up, with a Work shelf holding the demo export, sorted by a stand-in model
// as the answer key sorts it, so no model key is needed and no real model
// request is spent) and the shared guest. Then: a deep link opens its
// endpoint and nothing is sent on load; picking another endpoint changes
// the address without remounting the screen; GET /shelves as the session
// answers 200 with the learner's shelves; POST /shelves, sent with ⌘Enter
// or Ctrl+Enter, makes a shelf the SDK then lists; a DELETE asks first,
// naming the shelf, sends nothing until asked, and keeps it on "Keep it";
// an id clicked in a response fills its field for the next endpoint; a
// model-spending endpoint says its cost and sends nothing on the first
// click, nor on a second click of Send, and sends on its own action; a
// pasted API key on GET /account/export answers 403, while the code tabs,
// the address, and the page's storage never hold the key; a made-up key's
// 401 shows in the pane rather than sending the page to log in; the guest
// sees GET /keys answer 403; and on the phone the endpoint list is a
// select. Opening each select, the Shelf picker and the phone's endpoint
// list, logs no console error, such as a CSP violation, and the desktop's
// steps log none at all. It prints each step's checks, saves screenshots,
// and exits 1 if any fails, naming the step.
// Run: bun run check:playground [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { keySorter, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";
import { repReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-playground");
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const LEARNER = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const MADE = "Made in the playground";

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
const browser = await chromium.launch();
const failures: string[] = [];
let current = "";
/** The page a step works in, shot when the step throws. */
let open: Page | null = null;

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
    check(false, `threw ${error instanceof Error ? `${error.name}: ${error.message.split("\n")[0]}` : String(error)}`);
    await open?.screenshot({ path: join(OUT, `failed-${name.split(".")[0]}.png`), fullPage: true }).catch(() => undefined);
  }
}

/** The Worker's request lines since `from`, as "METHOD /path STATUS". */
const requestsSince = (from: number) => app.workerLog().requests.slice(from);
const logLength = () => app.workerLog().requests.length;

/** Every page's console errors, less Chrome's line for each 4xx answer, which the steps ask for on purpose. */
const consoleErrors: string[] = [];

async function contextFor(viewport: { width: number; height: number }, cookie: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  context.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text().split("\n")[0]!);
  });
  const pairs = cookie.split("; ").map((pair) => pair.split("="));
  await context.addCookies(pairs.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  return context;
}

const send = (page: Page) => page.getByRole("button", { name: "Send", exact: true });
/** The address's path, from /api/v1. */
const address = (page: Page) => page.getByRole("group", { name: "Address" }).locator("code").last();
const response = (page: Page) => page.getByRole("region", { name: "Response" });
const pickEndpoint = (page: Page, id: string) => page.getByRole("link", { name: id, exact: true }).click();
/** Opens the select named `name`, checks that its open menu logged no console error, and picks `option`. */
async function pickFromSelect(page: Page, name: string, option: string) {
  const before = consoleErrors.length;
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("listbox").waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const since = consoleErrors.slice(before);
  check(since.length === 0, `opening the ${name} select logs no console error${since.length ? `: ${since.join("; ")}` : ""}`);
  await page.getByRole("option", { name: option }).click();
}
/** The status the response pane shows, once one shows. */
async function answered(page: Page, status: string) {
  await response(page).getByText(status, { exact: true }).waitFor({ timeout: 15_000 });
  return true;
}
const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });

try {
  const learner = app.browser();
  await learner.client.auth.signUp(LEARNER);
  const work = await learner.client.shelves.create({ name: "Work" });
  const sorted = await sortEnds(learner.client, (await upload(learner.client, work.id, phrasings, "conversations.json")).id);
  if (sorted.status !== "sorted") throw new Error(`the demo export didn't sort: ${sorted.status}`);
  const guest = app.browser();
  await guest.client.auth.signInAsGuest();

  const context = await contextFor(DESKTOP, learner.cookie());
  const page = await context.newPage();
  open = page;
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await step("1. A deep link opens its endpoint, nothing is sent on load, and picking another doesn't remount", async () => {
    const sent: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v1/")) sent.push(`${request.method()} ${url.pathname}`);
    });
    await page.goto(`${app.url}/app/playground?endpoint=GET%20/keys`);
    await page.getByRole("heading", { level: 1, name: "Playground" }).waitFor();
    await page.waitForLoadState("networkidle");
    check(!sent.includes("GET /api/v1/keys"), `nothing but the app's own reads went out on load: ${sent.join(", ")}`);
    check(sent.every((line) => ["GET /api/v1/auth/me", "GET /api/v1/desk", "GET /api/v1/shelves"].includes(line)), "only who's logged in, the desk, and the shelves were read");
    check(((await address(page).textContent()) ?? "").includes("/api/v1/keys"), `the address is GET /api/v1/keys: "${await address(page).textContent()}"`);
    const open = page.locator('a[aria-current="true"]');
    check((await open.count()) === 1 && (await open.textContent())?.replace(/\s+/g, " ").trim() === "GET /keys", `the list marks GET /keys as open: "${await open.textContent()}"`);

    await page.evaluate(() => ((document.querySelector("main h1") as HTMLElement & { mark?: boolean }).mark = true));
    await pickEndpoint(page, "GET /shelves");
    await page.waitForURL(/endpoint=GET%20\/shelves$/);
    check(((await address(page).textContent()) ?? "").endsWith("/api/v1/shelves"), "picking GET /shelves changes the address");
    check(await page.evaluate(() => (document.querySelector("main h1") as HTMLElement & { mark?: boolean }).mark === true), "and the screen wasn't remounted");
    check(!sent.some((line) => line === "GET /api/v1/keys"), "picking sends nothing either");
    await shot(page, "deep-link");
  });

  await step("2. GET /shelves as this session answers 200 with the learner's shelves", async () => {
    await send(page).click();
    check(await answered(page, "200 OK"), "it answers 200 OK");
    const body = (await response(page).locator("pre").textContent()) ?? "";
    check(body.includes(work.id) && body.includes('"Work"'), "the body lists the Work shelf by its id and name");
    check(((await response(page).textContent()) ?? "").includes("as this session"), "the pane says it went as this session");
    await shot(page, "get-shelves");
  });

  await step("3. POST /shelves, sent with the shortcut, makes a shelf the SDK lists", async () => {
    await pickEndpoint(page, "POST /shelves");
    const body = page.getByLabel("JSON body");
    check((await body.inputValue()).includes('"name"'), `the body is prefilled: ${(await body.inputValue()).replace(/\s+/g, " ")}`);
    await body.fill(JSON.stringify({ name: MADE }));
    await body.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
    check(await answered(page, "201 Created"), "it answers 201 Created");
    const shelves = await learner.client.shelves.list();
    check(shelves.some((shelf) => shelf.name === MADE), `the SDK lists it: ${shelves.map((shelf) => shelf.name).join(", ")}`);
    await page.getByRole("navigation", { name: "Asked Before" }).getByRole("link", { name: MADE }).waitFor();
    check(true, "and the sidebar does too");
  });

  await step("4. A DELETE asks first, naming the shelf, and sends nothing until it's confirmed", async () => {
    const made = (await learner.client.shelves.list()).find((shelf) => shelf.name === MADE)!;
    await pickEndpoint(page, "DELETE /shelves/:shelfId");
    await pickFromSelect(page, "Shelf", MADE);
    check(((await address(page).textContent()) ?? "").includes(made.id), "the address holds the picked shelf's id");
    const before = logLength();
    await send(page).click();
    const asks = page.getByRole("group", { name: `Delete ${MADE}?` });
    await asks.waitFor();
    check(true, `it asks "Delete ${MADE}?"`);
    await page.waitForTimeout(500);
    check(!requestsSince(before).some((line) => line.startsWith("DELETE ")), "and nothing was deleted yet");
    await shot(page, "delete-asks");
    await asks.getByRole("button", { name: "Keep it" }).click();
    await asks.waitFor({ state: "hidden" });
    check((await learner.client.shelves.list()).some((shelf) => shelf.id === made.id), "Keep it keeps the shelf");

    await send(page).click();
    await asks.getByRole("button", { name: `Delete ${MADE}` }).click();
    check(await answered(page, "204 No Content"), "confirmed, it answers 204 No Content");
    check(!(await learner.client.shelves.list()).some((shelf) => shelf.id === made.id), "and the SDK no longer lists it");
  });

  await step("5. An id clicked in a response fills its field, and a model-spending endpoint sends nothing on the first click", async () => {
    await pickEndpoint(page, "GET /shelves/:shelfId/cards");
    await pickFromSelect(page, "Shelf", "Work");
    await send(page).click();
    check(await answered(page, "200 OK"), "the Work shelf's cards answer 200 OK");
    const [card] = await learner.client.cards.list(work.id);
    const id = response(page).getByRole("button", { name: `${card!.id}, fill the card id field` });
    await id.click();
    check(((await response(page).getByRole("status").last().textContent()) ?? "").includes(card!.id), "the pane says the card id was filled");

    await pickEndpoint(page, "POST /cards/:cardId/reps");
    check((await page.getByRole("textbox", { name: "Card id", exact: true }).inputValue()) === card!.id, "the card id field holds the clicked id");
    check(((await page.getByRole("note").first().textContent()) ?? "").includes("1 model request"), "the line under the address says it spends 1 model request");
    const before = logLength();
    const asked = model.requests.length;
    await send(page).click();
    const asks = page.getByRole("group", { name: "Start a cold rep on this card?" });
    await asks.waitFor();
    check(await page.evaluate(() => document.activeElement?.textContent === "Don't send"), "it asks, with focus on Don't send");
    await send(page).click();
    await page.waitForTimeout(800);
    check(!requestsSince(before).some((line) => line.startsWith("POST /api/v1/cards/")), "neither the first click nor a second click on Send sent it");
    check(model.requests.length === asked, `and the model was asked nothing: ${model.requests.length - asked} request(s)`);
    await shot(page, "spend-asks");

    model.queue(repReply("A stand-in's problem: undo the last commit and keep its changes staged."));
    await asks.getByRole("button", { name: "Start it" }).click();
    check(await answered(page, "201 Created"), "its own action sends it: 201 Created");
    check(model.requests.length === asked + 1, "with one request to the stand-in model");
  });

  await step("6. A pasted API key on GET /account/export answers 403, and the key is never printed or kept", async () => {
    const made = await learner.client.keys.create({ name: "Playground check" });
    await pickEndpoint(page, "GET /account/export");
    await page.getByRole("button", { name: "An API key" }).click();
    await page.getByLabel("API key", { exact: true }).fill(made.key);
    await send(page).click();
    check(await answered(page, "403 Forbidden"), "it answers 403 Forbidden");
    check(((await response(page).textContent()) ?? "").includes("with an API key"), "the pane says it went with an API key");
    const code = await page.locator("[data-slot=tabs-content] pre").allTextContents();
    check(code.length === 3 && code.every((text) => text.includes("YOUR_API_KEY") && !text.includes(made.key)), "all three code tabs say YOUR_API_KEY, never the key");
    check(!page.url().includes(made.key), "the address doesn't hold it");
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    check(!stored.includes(made.key), "nor does storage or a cookie");
    await shot(page, "key-403");

    await pickEndpoint(page, "GET /shelves");
    await page.getByLabel("API key", { exact: true }).fill("ab_nope_nope");
    await send(page).click();
    check(await answered(page, "401 Unauthorized"), "a made-up key answers 401 Unauthorized in the pane");
    check(new URL(page.url()).pathname === "/app/playground", "and the page stays here, not sent to log in");
  });

  check(errors.length === 0 && consoleErrors.length === 0, `no page or console errors: ${[...errors, ...consoleErrors].join("; ")}`);
  await context.close();

  await step("7. The guest sees GET /keys answer 403", async () => {
    const guestContext = await contextFor(DESKTOP, guest.cookie());
    const guestPage = await guestContext.newPage();
    open = guestPage;
    await guestPage.goto(`${app.url}/app/playground?endpoint=GET%20/keys`);
    await guestPage.getByRole("heading", { level: 1, name: "Playground" }).waitFor();
    check(((await guestPage.locator("main").textContent()) ?? "").includes("As the shared guest, it answers 403"), "it says so before it's sent");
    await send(guestPage).click();
    check(await answered(guestPage, "403 Forbidden"), "and it answers 403 Forbidden");
    await shot(guestPage, "guest-keys");
    await guestContext.close();
  });

  await step("8. On the phone the endpoint list is a select", async () => {
    const phone = await contextFor(PHONE, learner.cookie());
    const phonePage = await phone.newPage();
    open = phonePage;
    await phonePage.goto(`${app.url}/app/playground`);
    await phonePage.getByRole("heading", { level: 1, name: "Playground" }).waitFor();
    check(!(await phonePage.getByRole("link", { name: "GET /shelves", exact: true }).isVisible()), "the list is folded away");
    const select = phonePage.getByRole("combobox", { name: "Endpoint" });
    check(await select.isVisible(), "and the select shows");
    await pickFromSelect(phonePage, "Endpoint", "GET /desk");
    await phonePage.waitForURL(/endpoint=GET%20\/desk$/);
    check(((await address(phonePage).textContent()) ?? "").endsWith("/api/v1/desk"), "picking GET /desk opens it");
    const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(overflow <= 0, `the page doesn't scroll sideways: ${overflow}px`);
    await shot(phonePage, "phone");
    await phone.close();
  });
} catch (error) {
  failures.push(`threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
