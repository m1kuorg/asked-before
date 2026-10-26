// Checks the Desk (m1kuorg/basics#47) on a fresh copy of the app:
// first the Desk endpoint through the SDK, then the page in a real
// browser at 1920×1080. The app's model is a stand-in in this script: a
// sort ends as the demo export's answer key says, and a cold rep takes the
// answers a step queues. Through the SDK: a new account's desk is
// empty; after the demo export is sorted it holds the key's cards, most
// borrowed first, and the latest borrows as the key dates them; a passed
// cold rep lists that return, and a newer borrow makes the card borrowed
// again; its totals always equal the shelves' own counts added up; an API
// key reads it, and another account sees none of it. In the browser, on
// Home (/app/desk): a new account sees the empty state, whose demo action
// leads to a sorted demo shelf, and whose first-upload field makes a shelf
// and goes to its upload page; then the top card's skill opens its page
// asking the model nothing, while Home's "Start a cold rep" link shows the
// rep's problem in one click and leaves no start in the address, so going
// back and forward asks nothing either; that rep, passed, shows on Home
// under Latest proven, with tiles that match the shelves' counts, Prove next
// and Latest asks as the API lists them, dates in the learner's own time
// zone, and no request but the desk and the shelves, once for Home and
// once for the sidebar, and each Prove next card once, for its asks on its
// strip, and no model request.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:desk [screenshot dir]

import { ApiError, createClient, type Client, type Desk, type Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { compareWithKey, key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { kindOf, repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-desk");
const FRAME = { width: 1920, height: 1080 };

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
// Sorts as the key does, with any phrasing `also` names placed on its skill's card; a rep or check takes the answer a step queues.
const also = new Map<string, string>();
const model = await startModelStub(sortsByKey(refuse(), also));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
const browser = await chromium.launch();

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });

let shot = 0;
async function step(name: string, run: () => Promise<void>, on?: () => Page | undefined) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  await on?.()?.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

type Watched = { learner: Learner; page: Page; apiCalls: string[]; errors: string[] };

/** A new learner, signed up, and a page logged in as them at 1920×1080 in UTC, watching its API calls and console errors. */
async function learnerPage(name: string, email: string): Promise<Watched> {
  const learner = app.browser();
  await learner.client.auth.signUp({ name, email, password: "analytical engine" });
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" });
  const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([cookie, value]) => ({ name: cookie!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const apiCalls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === app.url && ["fetch", "xhr"].includes(request.resourceType())) apiCalls.push(`${request.method()} ${url.pathname}`);
  });
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { learner, page, apiCalls, errors };
}

/** The status words, as the pills say them. */
const STATUS_WORDS = ["To prove", "Proven", "Asked since proven"];
const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();

/** Waits for `success`, or fails at once with what an alert in the page's main says. */
async function settle(page: Page, success: Locator, timeout?: number) {
  const alert = page.getByRole("main").getByRole("alert");
  await success.or(alert).first().waitFor({ timeout });
  if (!(await success.count())) throw new Error(`the page says "${await say(alert)}"`);
}

/** Home's count tiles, each as its label and value: "To prove 4". */
const tiles = (page: Page) => page.getByRole("main").locator("dl > div").evaluateAll((all) => all.map((tile) => `${tile.querySelector("dt")?.textContent} ${tile.querySelector("dd")?.textContent}`));

// Dates as the page writes them, in UTC as the browser here reads them.
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const longDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const month = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
/** "March 2025 to September 2026", or "in March 2025". */
const months = (first: string, last: string) => (month(first) === month(last) ? `in ${month(first)}` : `${month(first)} to ${month(last)}`);

const zero = (totals: Desk["totals"]) => totals.cards === 0 && totals.borrowed === 0 && totals.returned === 0 && totals.borrowedAgain === 0;

/** The shelves' own counts, added up through shelves.list: what the Desk's totals must equal. */
async function shelfSums(client: Client): Promise<Desk["totals"]> {
  const sums = { cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 };
  for (const { counts } of await client.shelves.list()) {
    for (const name of Object.keys(sums) as (keyof typeof sums)[]) sums[name] += counts[name];
  }
  return sums;
}

const sameTotals = (a: Desk["totals"], b: Desk["totals"]) => JSON.stringify(a) === JSON.stringify(b);

/** The key's phrasings on a card, newest first by their own time, as names such as "m27". */
const keyedByTime = () =>
  key.skills
    .flatMap((skill) => skill.messageIds.map((id) => ({ id, skill: skill.name, time: Date.parse(phrasings[Number(id.slice(1)) - 1]!.time) })))
    .sort((a, b) => b.time - a.time);

let demo: Shelf;
let work: Shelf;

try {
  await step("1. A new account's desk is empty", async () => {
    const desk = await ada.client.desk.get();
    check(desk.shelves === 0, `no shelves (${desk.shelves})`);
    check(zero(desk.totals), `every total is 0 (${JSON.stringify(desk.totals)})`);
    check(desk.mostBorrowed.length === 0 && desk.latestBorrows.length === 0 && desk.latestReturns.length === 0, "no cards, borrows, or returns");
  });

  await step("2. After the demo export is sorted, the Desk has the key's cards, its latest borrows, and the shelves' totals", async () => {
    demo = await ada.client.shelves.create({ name: "Demo", demo: true });
    work = await ada.client.shelves.create({ name: "Work" });
    const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
    check(sorted.status === "sorted", `the demo export is sorted (${sorted.status})`);
    const desk = await ada.client.desk.get();
    check(desk.shelves === 2, `two shelves (${desk.shelves})`);
    const sums = await shelfSums(ada.client);
    check(sameTotals(desk.totals, sums), `the totals ${JSON.stringify(desk.totals)} are the shelves' counts added up ${JSON.stringify(sums)}`);
    check(desk.totals.cards === key.skills.length && desk.totals.borrowed === key.skills.length, `${key.skills.length} cards, all borrowed`);
    const most = desk.mostBorrowed.map((card) => `${card.skill} ${card.count}`);
    const want = key.skills.map((skill) => `${skill.name} ${skill.count}`);
    check(most.join() === want.join(), `most borrowed first, ties to the later last borrow, as the key orders them: ${most.join(", ")}`);
    check(desk.mostBorrowed.every((card) => card.shelf.id === demo.id && card.shelf.name === "Demo" && card.shelf.demo && card.status === "borrowed"), "each names its shelf, a demo shelf, and is borrowed");
    const latest = desk.latestBorrows.map((borrow) => named(borrow.sourceId));
    const wantLatest = keyedByTime().slice(0, 10);
    check(latest.join() === wantLatest.map((b) => b.id).join(), `the 10 latest borrows, newest first, as the key dates them: ${latest.join(" ")}`);
    check(
      desk.latestBorrows.every((borrow, i) => borrow.card.skill === wantLatest[i]?.skill && borrow.text === phrasings[Number(wantLatest[i]!.id.slice(1)) - 1]!.text && borrow.shelf.id === demo.id),
      "each is the export's phrasing word for word, on the key's card, on the demo shelf",
    );
    check(desk.latestReturns.length === 0, "nothing is returned yet");
  });

  await step("3. After one returned card, the Desk lists that return, and its totals match the shelves' counts", async () => {
    const [cardA] = await ada.client.cards.list(demo.id);
    model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
    const { rep } = await ada.client.reps.start(cardA!.id);
    const checked = await ada.client.reps.check(rep.id, { answer: "My own answer." });
    check(checked.card.status === "returned", `card A passed its cold rep and is ${checked.card.status}`);
    const desk = await ada.client.desk.get();
    const [returned, ...others] = desk.latestReturns;
    check(others.length === 0 && returned?.id === cardA!.id && returned.status === "returned", `the latest returns hold card A alone (${desk.latestReturns.map((c) => c.skill).join(", ")})`);
    check(returned?.returnedAt === checked.rep.checkedAt, `stamped when its rep passed (${returned?.returnedAt})`);
    check(!desk.mostBorrowed.some((card) => card.id === cardA!.id) && desk.mostBorrowed[0]?.skill === key.skills[1]!.name, `card A leaves the most borrowed, which card B now heads (${desk.mostBorrowed[0]?.skill})`);
    const sums = await shelfSums(ada.client);
    check(sameTotals(desk.totals, sums) && desk.totals.returned === 1 && desk.totals.borrowed === key.skills.length - 1, `the totals ${JSON.stringify(desk.totals)} are the shelves' counts added up ${JSON.stringify(sums)}`);
  });

  await step("4. A card borrowed again stays on the most borrowed, its newer borrow leads the latest, and its stamp stays with the returns", async () => {
    const [cardA] = await ada.client.cards.list(demo.id);
    const newer = "how do i take back my last commit before pushing";
    also.set(newer, key.skills[0]!.name);
    const read = await smallExport([{ text: newer, time: new Date(Date.parse(cardA!.returnedAt!) + 1000) }]);
    const made = await ada.client.uploads.create(demo.id, { source: read.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, read.phrasings);
    await sortEnds(ada.client, (await ada.client.uploads.finish(made.id)).id);
    const desk = await ada.client.desk.get();
    const again = desk.mostBorrowed.find((card) => card.id === cardA!.id);
    check(again?.status === "borrowed_again" && again.count === key.skills[0]!.count + 1 && desk.mostBorrowed[0]?.id === cardA!.id, `card A is borrowed again, with ${again?.count} borrows, at the head of the most borrowed`);
    check(desk.latestBorrows[0]?.text === newer && desk.latestBorrows[0]?.card.id === cardA!.id && desk.latestBorrows[0]?.card.status === "borrowed_again", "its newer borrow leads the latest borrows");
    check(desk.latestReturns[0]?.id === cardA!.id && desk.latestReturns[0]?.status === "borrowed_again" && desk.latestReturns[0]?.returnedAt === cardA!.returnedAt, "its return stamp stays on the latest returns, saying it's borrowed again");
    const sums = await shelfSums(ada.client);
    check(sameTotals(desk.totals, sums) && desk.totals.borrowedAgain === 1 && desk.totals.returned === 0, `the totals ${JSON.stringify(desk.totals)} are the shelves' counts added up ${JSON.stringify(sums)}`);
  });

  await step("5. The Desk is the account's own: an API key reads it, another account sees none of it, and no one logged out does", async () => {
    const mine = await ada.client.desk.get();
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    const viaKey = await createClient({ baseUrl: app.url, apiKey }).desk.get();
    check(JSON.stringify(viaKey) === JSON.stringify(mine), "an API key reads the same desk as the session");
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const hers = await bea.client.desk.get();
    check(hers.shelves === 0 && zero(hers.totals) && !hers.mostBorrowed.length && !hers.latestBorrows.length && !hers.latestReturns.length, "another account's desk is empty");
    const status = await createClient({ baseUrl: app.url }).desk.get().then(() => 200, (error) => (error instanceof ApiError ? error.status : 0));
    check(status === 401, `logged out, it's a 401 (${status})`);
  });

  let cy: Watched | undefined;
  await step(
    "6. A new account sees the empty state, and its demo action leads to a sorted demo shelf",
    async () => {
      cy = await learnerPage("Cy Example", "cy@example.com");
      const { page, learner } = cy;
      const main = page.getByRole("main");
      await page.goto(`${app.url}/app/desk`);
      await settle(page, main.getByRole("heading", { level: 1, name: "No cards yet.", exact: true }));
      check((await tiles(page)).join(", ") === "To prove 0, Asked since proven 0, Proven 0, All cards 0", `headed "${await say(main.getByRole("heading", { level: 1 }))}", over the tiles ${(await tiles(page)).join(", ")}`);
      const prove = main.getByRole("region", { name: "Prove next" });
      check(await prove.getByRole("button", { name: "Try the demo shelf", exact: true }).isVisible(), "it offers the demo shelf");
      check(await prove.getByLabel("Or name your first shelf", { exact: true }).isVisible(), "and a first shelf to upload into");
      await page.screenshot({ path: join(OUT, `${++shot}-empty-state.png`) });

      await prove.getByRole("button", { name: "Try the demo shelf", exact: true }).click();
      await page.waitForURL(/\/app\/shelves\/[^/]+\/upload/);
      const [made] = await learner.client.shelves.list();
      check(made?.demo === true, `it made "${made?.name}", flagged demo: ${made?.demo}`);
      await settle(page, main.getByRole("status").filter({ hasText: /^They're sorted into the cards on Demo\.$/ }), 30_000);
      const compared = await compareWithKey(learner.client, made!.id);
      console.log(compared.lines.join("\n"));
      check(compared.problems.length === 0, `the demo shelf is sorted as the key says${compared.problems.length ? `: ${compared.problems.join("; ")}` : ""}`);
      await main.getByRole("link", { name: "Go to Demo", exact: true }).click();
      const cards = main.getByRole("list", { name: "Cards on Demo, most asked first" });
      await settle(page, cards);
      const first = await say(cards.getByRole("listitem").first().getByRole("link"));
      check(first === key.skills[0]!.name, `and its shelf lists card A first, "${first}"`);
    },
    () => cy?.page,
  );

  let dee: Watched | undefined;
  await step(
    "7. The empty state's first upload names a shelf and goes to its upload page",
    async () => {
      dee = await learnerPage("Dee Example", "dee@example.com");
      const { page, learner } = dee;
      const main = page.getByRole("main");
      await page.goto(`${app.url}/app/desk`);
      const first = main.getByLabel("Or name your first shelf", { exact: true });
      await settle(page, first);
      await main.getByRole("button", { name: "Upload a chat export", exact: true }).click();
      const said = main.getByRole("alert");
      await said.waitFor();
      check((await say(said)) === "A shelf needs a name." && (await first.getAttribute("aria-invalid")) === "true", `with no name, it says "${await say(said)}", marking the field`);
      await first.fill("Bootcamp");
      await main.getByRole("button", { name: "Upload a chat export", exact: true }).click();
      await main.getByRole("heading", { level: 1, name: "Upload a chat export", exact: true }).waitFor();
      const [made] = await learner.client.shelves.list();
      check(made?.name === "Bootcamp" && !made.demo, `it made "${made?.name}"`);
      check(new URL(page.url()).pathname === `/app/shelves/${made!.id}/upload` && (await main.locator('input[type="file"]').count()) === 1, `and went to its upload page, with its file input (${new URL(page.url()).pathname})`);
    },
    () => dee?.page,
  );

  await step(
    "8. After one Proven card, Home lists it, and its totals match the shelves' counts",
    async () => {
      const { page, learner, apiCalls, errors } = cy!;
      const main = page.getByRole("main");
      const A = key.skills[0]!.name;
      const [cardA] = await learner.client.cards.list((await learner.client.shelves.list())[0]!.id);
      const cardAt = `${app.url}/app/cards/${cardA!.id}`;
      const repPanel = main.getByRole("region", { name: "Prove it without AI" });
      const startOffered = repPanel.getByRole("button", { name: `Start a cold rep on ${A}`, exact: true });
      const prove = main.getByRole("region", { name: "Prove next" });
      await page.goto(`${app.url}/app/desk`);
      const take = prove.getByRole("link", { name: `Start a cold rep on ${A}`, exact: true });
      await settle(page, take);

      // A plain visit, by the card's skill in Prove next, opens the card and asks the model nothing.
      let before = model.requests.length;
      await prove.getByRole("link", { name: A, exact: true }).click();
      await settle(page, startOffered);
      check(page.url() === cardAt && model.requests.length === before && (await learner.client.cards.get(cardA!.id)).reps.length === 0, `the skill's link opens the card, offering a cold rep, with ${model.requests.length - before} model requests and no rep`);

      // Home's action starts the rep in one click: the card page, with its problem showing.
      await page.goBack();
      await take.waitFor();
      model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
      before = model.requests.length;
      await take.click();
      const problem = repPanel.getByRole("heading", { name: "The problem", exact: true });
      await settle(page, problem);
      const started = model.requests.slice(before).map(kindOf);
      check(started.join() === "rep" && (await learner.client.cards.get(cardA!.id)).reps.length === 1, `one click on "Start a cold rep on ${A}" shows the rep's problem, after one model request (${started.join(", ")})`);
      const words = await problem.evaluate((title) => title.nextElementSibling?.textContent ?? "");
      check(words === "A problem of the card's skill." && (await startOffered.count()) === 0, "the problem is the rep's, with no second Start a cold rep to click");
      check(page.url() === cardAt, `the address keeps no start, so going back or reloading starts nothing (${new URL(page.url()).pathname}${new URL(page.url()).search})`);
      await repPanel.getByLabel("Your answer, in your own words, without AI", { exact: true }).fill("My own answer.");
      await repPanel.getByRole("button", { name: "Check my answer", exact: true }).click();
      await settle(page, repPanel.getByRole("link", { name: "Back to Home", exact: true }));

      // Back to Home and forward again opens the Proven card, and asks the model nothing.
      before = model.requests.length;
      await page.goBack();
      await main.getByRole("list", { name: "Latest proven, latest first" }).waitFor();
      await page.goForward();
      await startOffered.waitFor();
      check(page.url() === cardAt && model.requests.length === before && (await learner.client.cards.get(cardA!.id)).reps.length === 1, `back, then forward, opens the card with ${model.requests.length - before} model requests, still one rep`);

      // A fresh load of Home, which the shell around it also loads its sidebar for.
      apiCalls.length = 0;
      before = model.requests.length;
      await page.goto(`${app.url}/app/desk`);
      const nav = page.getByRole("navigation", { name: "Asked Before" });
      await settle(page, main.getByRole("list", { name: "Latest proven, latest first" }));
      await main.getByRole("list", { name: "Your shelves" }).waitFor();
      await nav.getByRole("list", { name: "Shelves" }).waitFor();
      await nav.getByRole("link", { name: /cards? needs? a cold rep$/ }).waitFor();
      await page.waitForLoadState("networkidle");
      const desk = await learner.client.desk.get();
      const sums = await shelfSums(learner.client);
      check(desk.latestReturns.length === 1 && desk.latestReturns[0]!.skill === A, `the API lists card A as proven (${desk.latestReturns.map((c) => c.skill).join(", ")})`);

      const proven = await main
        .getByRole("list", { name: "Latest proven, latest first" })
        .getByRole("listitem")
        .evaluateAll(
          (items, words) =>
            items.map((item) => {
              const spans = [...item.querySelectorAll("span")].map((span) => (span.textContent ?? "").trim());
              return {
                skill: item.querySelector("a")?.textContent ?? "",
                shelf: spans.includes("Demo") && spans.includes("Demo data"),
                dates: [...item.querySelectorAll("time")].map((time) => time.textContent),
                status: spans.find((said) => words.includes(said)) ?? "",
              };
            }),
          STATUS_WORDS,
        );
      const provenOn = shortDate(desk.latestReturns[0]!.returnedAt!);
      check(
        proven.length === 1 && proven[0]!.skill === A && proven[0]!.shelf && proven[0]!.dates.join() === provenOn && proven[0]!.status === "Proven",
        `Latest proven lists it, on Demo, labeled as demo data: ${JSON.stringify(proven)}, proven ${provenOn}`,
      );

      const queue = sums.borrowed + sums.borrowedAgain;
      const want = [`To prove ${sums.borrowed}`, `Asked since proven ${sums.borrowedAgain}`, `Proven ${sums.returned}`, `All cards ${sums.cards}`];
      check((await tiles(page)).join(", ") === want.join(", "), `the tiles (${(await tiles(page)).join(", ")}) match the shelves' counts added up (${want.join(", ")})`);
      const sum = await say(main.locator("dl > div").last().locator("dd").last());
      check(sum === `${sums.borrowed} + ${sums.borrowedAgain} + ${sums.returned}`, `and All cards adds them up: "${sum}"`);
      const greeting = await say(main.getByRole("heading", { level: 1 }));
      check(greeting === `${queue} ${queue === 1 ? "card needs" : "cards need"} a cold rep, ${sums.returned} is proven.`, `the h1 counts the cards that need a cold rep: "${greeting}"`);
      check((await nav.getByRole("link", { name: new RegExp(`^Home\\W+${queue} cards need a cold rep$`) }).count()) === 1, `the sidebar's Home counts them too (${queue})`);

      const rows = await prove.getByRole("listitem").evaluateAll((items) =>
        items.map((item) => {
          const links = [...item.querySelectorAll("a")];
          const start = links.find((link) => link.getAttribute("aria-label")?.startsWith("Start a cold rep on "));
          const spans = [...item.querySelectorAll("span")].map((span) => (span.textContent ?? "").replace(/\s+/g, " ").trim());
          return [
            links[0]?.textContent ?? "",
            links[0]?.getAttribute("href") ?? "",
            `${links[1]?.textContent ?? ""}${spans.includes("Demo data") ? ", Demo data" : ""}`,
            spans.find((said) => /^asked [\d,]+ times?$/.test(said)) ?? "",
            item.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "",
            start?.getAttribute("aria-label") ?? "",
            start?.getAttribute("href") ?? "",
          ];
        }),
      );
      const wantRows = desk.mostBorrowed.map((card) => [
        card.skill,
        `/app/cards/${card.id}`,
        "Demo, Demo data",
        `asked ${card.count} ${card.count === 1 ? "time" : "times"}`,
        `Asked ${card.count} ${card.count === 1 ? "time" : "times"}, ${months(card.firstBorrowAt, card.lastBorrowAt)}${card.returnedAt ? `, proven ${longDate(card.returnedAt)}` : ""}`,
        `Start a cold rep on ${card.skill}`,
        `/app/cards/${card.id}?rep=start`,
      ]);
      check(JSON.stringify(rows) === JSON.stringify(wantRows), `Prove next is the API's most asked, in order, each with its shelf, count, span, and start: ${rows.map((r) => `${r[0]} (${r[3]})`).join(", ")}`);
      check(rows.length === queue && (await prove.getByText(/^Showing /).count()) === 0, `all ${queue} that need a cold rep show, so nothing says some are left out`);

      const asks = await main
        .getByRole("list", { name: "Latest asks, newest first" })
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => ({
            text: item.querySelector("p")?.textContent ?? "",
            date: item.querySelector("time")?.textContent ?? "",
            datetime: item.querySelector("time")?.getAttribute("datetime") ?? "",
            skill: item.querySelector("a")?.textContent ?? "",
            href: item.querySelector("a")?.getAttribute("href") ?? "",
          })),
        );
      const wantAsks = desk.latestBorrows.map((ask) => ({ text: ask.text, date: shortDate(ask.time), datetime: ask.time, skill: ask.card.skill, href: `/app/cards/${ask.card.id}` }));
      check(JSON.stringify(asks) === JSON.stringify(wantAsks), `Latest asks holds the ${asks.length} latest, newest first, each word for word with its date and card`);

      const home = apiCalls.filter((call) => call !== "GET /api/v1/auth/me").sort();
      const me = apiCalls.length - home.length;
      // Each Prove next row fetches its own card once, after the list draws, to trade its span for one dot per ask.
      const budget = ["GET /api/v1/desk", "GET /api/v1/desk", "GET /api/v1/shelves", "GET /api/v1/shelves", ...desk.mostBorrowed.map((card) => `GET /api/v1/cards/${card.id}`)].sort();
      check(
        me === 1 && home.join(", ") === budget.join(", "),
        `the page asks who's logged in once, then the desk and the shelves once for Home and once for the sidebar, and each of Prove next's ${desk.mostBorrowed.length} cards once for its asks, nothing else (${apiCalls.join(", ")})`,
      );
      check(model.requests.length === before, `and makes no model request (${model.requests.length - before})`);
      check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    },
    () => cy?.page,
  );

  await step("9. Home in another time zone dates asks in the learner's own", async () => {
    const { learner } = cy!;
    const ZONE = "Pacific/Kiritimati";
    const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: ZONE });
    const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
    await context.addCookies(cookies.map(([cookie, value]) => ({ name: cookie!, value: value!, url: app.url })));
    const page = await context.newPage();
    await page.goto(`${app.url}/app/desk`);
    const latest = page.getByRole("main").getByRole("list", { name: "Latest asks, newest first" });
    await settle(page, latest);
    const desk = await learner.client.desk.get();
    const there = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: ZONE });
    const dates = await latest.locator("time").allTextContents();
    check(dates.join() === desk.latestBorrows.map((b) => there.format(new Date(b.time))).join(), `Latest asks dates each ask at UTC+14 (${dates.slice(0, 3).join(", ")}, …)`);
    await context.close();
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
