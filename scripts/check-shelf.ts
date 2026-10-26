// Checks a shelf's page (m1kuorg/basics#45) in a real browser at
// 1920×1080, on a fresh copy of the app, each step checked again through the
// SDK. The app's model is a stand-in in this script, answering as the demo
// export's answer key does, so every sort ends as the key says. The demo
// action makes the demo shelf, labeled as demo data, whose Cards tab lists
// cards A to E in the key's order with their counts; card A's page shows
// every time you asked, word for word, one list per year, each dated in the
// learner's own time zone, with its count and months. Each card's status
// shows, after real cold reps through the API, whose model answers are
// queued in this script: card A passes one, and card B passes one, then a
// small export with a newer phrasing of its skill makes it asked since
// proven. Not on a card lists the key's one-offs a page at a time, and
// Uploads each upload's date, source, messages, and new ones. Deleting the
// second of two uploads through the page, after its confirmation, removes
// its asks and any card left under two, as the key says, checked in the
// API; deleting needs the owner's session. A shelf with no cards says why,
// and the page reaches the server only through /api/v1.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:shelf [screenshot dir]

import { ApiError, createClient, type Shelf, type Upload } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { allUnsorted, idList, key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, reply, startModelStub } from "./lib/model-stub";
import { repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-shelf");
const FRAME = { width: 1920, height: 1080 };
/** The status words, as the pills say them. */
const STATUS_WORDS = ["To prove", "Proven", "Asked since proven"];

const failures: string[] = [];
let current = "";
let shot = 0;
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

const apiCalls: string[] = [];
const consoleErrors: string[] = [];

/** A page logged in as Ada, in its own context; the answer key's months and dates are in UTC, so pages read in UTC unless told otherwise. */
async function adaPage(timezoneId = "UTC") {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId });
  const cookies = ada.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === app.url && ["fetch", "xhr"].includes(request.resourceType())) apiCalls.push(`${request.method()} ${url.pathname}`);
  });
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  return page;
}

const page = await adaPage();

async function step(name: string, run: () => Promise<void>, on: Page = page) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  // Only finite animations: a spinner turns for as long as its request runs.
  await on
    .evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)).then(() => undefined))
    .catch(() => undefined);
  await on.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

const squish = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const main = (on: Page = page) => on.getByRole("main");
const say = async (locator: Locator) => squish(await locator.first().textContent());

/** Waits for `success`, or fails at once with what an alert in the page's main says. */
async function settle(success: Locator, on: Page = page, timeout?: number) {
  const alert = main(on).getByRole("alert");
  await success.or(alert).first().waitFor({ timeout });
  if (!(await success.count())) throw new Error(`the page says "${await say(alert)}"`);
}

/** The phrasing the key names, such as "m1": the demo export's own words and time. */
const keyed = (id: string) => phrasings[Number(id.slice(1)) - 1]!;
const zoned = (timeZone: string) => ({
  /** "Oct 24, 2026": a date in a list or a sentence. */
  date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }),
  /** "Mar 5": an ask's day under its year. */
  day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }),
  year: new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }),
  month: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }),
  longDate: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone }),
  iso: new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }),
});
const utc = zoned("UTC");
const on = (format: Intl.DateTimeFormat, iso: string) => format.format(new Date(iso));

/** The shelf's card rows, as the Cards tab lists them: the skill and where it leads, the status pill, times asked, and the ask strip's words. */
const cardRows = (from: Page = page) =>
  main(from)
    .getByRole("list", { name: /^Cards on .+, most asked first$/ })
    .getByRole("listitem")
    .evaluateAll(
      (rows, words) =>
        rows.map((row) => {
          const spans = [...row.querySelectorAll("span")].map((span) => (span.textContent ?? "").replace(/\s+/g, " ").trim());
          const link = row.querySelector("a");
          return {
            skill: link?.textContent ?? "",
            href: link?.getAttribute("href") ?? "",
            status: spans.find((said) => words.includes(said)) ?? "",
            count: spans.find((said) => /^[\d,]+ times asked$/.test(said))?.replace(" times asked", "") ?? "",
            again: spans.find((said) => said.startsWith("asked again ")) ?? "",
            strip: row.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "",
          };
        }),
      STATUS_WORDS,
    );

/** Waits for a card page to have its card: its h1 is the skill (while it loads, the page holds its regions and an h1 "Card"). */
const cardLoaded = (skill: string, from: Page = page) => settle(main(from).getByRole("heading", { level: 1, name: skill, exact: true }), from);

/** A card page's h1, the status pill and any chip beside it, and the line under it. */
async function cardHead(from: Page = page) {
  const h1 = main(from).getByRole("heading", { level: 1 });
  const beside = await h1.evaluate((heading) => [...(heading.parentElement?.querySelectorAll("span") ?? [])].map((span) => (span.textContent ?? "").trim()));
  return {
    skill: await say(h1),
    status: beside.find((said) => STATUS_WORDS.includes(said)) ?? "",
    line: await say(main(from).locator("header p")),
    demo: await main(from).locator("header p").first().getByText("Demo data", { exact: true }).isVisible(),
    strip: (await main(from).getByRole("img").first().getAttribute("aria-label")) ?? "",
  };
}

/** "Every time you asked" on a card page: each ask's words, its day as shown and its datetime, and the year its list is labeled with. */
const asksShown = (from: Page = page) =>
  main(from)
    .getByRole("region", { name: "Every time you asked" })
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((item) => ({
        text: item.querySelector("p")?.textContent ?? "",
        shown: item.querySelector("time")?.textContent ?? "",
        datetime: item.querySelector("time")?.getAttribute("datetime") ?? "",
        list: item.closest("ol")?.getAttribute("aria-label") ?? "",
      })),
    );

/** The asks of the key's skill, as a card page in `timeZone` must show them: newest first, each with its day, under its year. */
function wantAsks(ids: string[], timeZone: string) {
  const zone = zoned(timeZone);
  return ids
    .map(keyed)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .map((ask) => ({ text: ask.text, shown: on(zone.day, ask.time), time: ask.time, list: `Asked in ${on(zone.year, ask.time)}` }));
}

/** The shelf's view tabs, each with its count, and the current one. */
const tabs = async (from: Page = page) => {
  const links = main(from).getByRole("list", { name: /^Views of / }).getByRole("link");
  return {
    all: (await links.allTextContents()).map(squish),
    current: squish(await main(from).getByRole("list", { name: /^Views of / }).locator('[aria-current="page"]').textContent()),
  };
};

/** The rows of the Not on a card table: each message's words, and its date. */
const onceRows = (from: Page = page) =>
  main(from)
    .getByRole("table", { name: /not on a card, newest first$/ })
    .locator("tbody tr")
    .evaluateAll((rows) => rows.map((row) => ({ text: row.querySelector("p")?.textContent ?? "", shown: row.querySelector("time")?.textContent ?? "" })));

/** The Uploads table's rows, read by the column headings: the date and where it leads, the file, the source, your messages, and the new ones. */
const uploadRows = (from: Page = page) =>
  main(from)
    .getByRole("table", { name: /^Uploads into .+, newest first$/ })
    .evaluate((table) => {
      const heads = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim());
      return [...table.querySelectorAll("tbody tr")]
        .filter((row) => !row.querySelector('[role="group"]'))
        .map((row) => {
          const cells = [...row.querySelectorAll("td")];
          const cell = (name: string) => cells[heads.indexOf(name)];
          const said = (name: string) => (cell(name)?.textContent ?? "").trim();
          const link = cell("Uploaded")?.querySelector("a");
          return { date: link?.textContent ?? "", href: link?.getAttribute("href") ?? "", file: said("File"), source: said("Source"), messages: said("Your messages"), added: said("New") };
        });
    });

async function failure(call: Promise<unknown>): Promise<ApiError | null> {
  try {
    await call;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}
const sayError = (error: ApiError | null) => (error ? `${error.status} "${error.message}"` : "no error");

let demo: Shelf;

try {
  await step("1. The demo shelf: cards A to E in the key's order, labeled as demo data, and card A's every ask word for word, a list per year", async () => {
    await page.goto(`${app.url}/app/shelves`);
    await main().getByRole("button", { name: "Try the demo shelf", exact: true }).click();
    await settle(main().getByRole("status").filter({ hasText: /sorted into the cards on Demo\.$/ }), page, 60_000);
    await main().getByRole("link", { name: "Go to Demo", exact: true }).click();
    await settle(main().getByRole("list", { name: "Cards on Demo, most asked first" }));
    [demo] = (await ada.client.shelves.list()) as [Shelf];
    check(demo.demo && new URL(page.url()).pathname === `/app/shelves/${demo.id}`, `on the demo shelf's page (${new URL(page.url()).pathname})`);

    const h1 = main().getByRole("heading", { level: 1 });
    const beside = await h1.evaluate((heading) => [...(heading.parentElement?.querySelectorAll("span") ?? [])].map((span) => span.textContent));
    check((await say(h1)) === "Demo" && beside.includes("Demo data"), `headed "${await say(h1)}", with the demo-data label beside it`);
    const asks = key.skills.reduce((sum, skill) => sum + skill.count, 0);
    const subline = await say(main().locator("header p"));
    check(subline === `${key.skills.length} cards from ${asks} of your messages, last upload ${on(utc.date, demo.lastUploadAt!)}.`, `under it: "${subline}"`);

    const rows = await cardRows();
    const want = key.skills.map((skill) => `${skill.name} ${skill.count}`);
    const got = rows.map((row) => `${row.skill} ${row.count}`);
    check(got.join(" | ") === want.join(" | "), `the cards are the key's, in order, with their counts: ${got.join(" | ")}`);
    check(rows.every((row) => row.status === "To prove"), `each is To prove (${rows.map((row) => row.status).join(", ")})`);
    const A = key.skills[0]!;
    check(rows[0]?.strip === `Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}`, `card A's strip says "${rows[0]?.strip}"`);

    const [cardA] = await ada.client.cards.list(demo.id);
    const open = main().getByRole("list", { name: "Cards on Demo, most asked first" }).getByRole("link", { name: A.name, exact: true });
    check((await open.getAttribute("href")) === `/app/cards/${cardA!.id}`, `card A's row leads to ${await open.getAttribute("href")}`);
    await open.click();
    await cardLoaded(A.name);
    const head = await cardHead();
    check(head.skill === A.name && head.status === "To prove", `card A's page is headed "${head.skill}", ${head.status}`);
    check(head.line === `Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}, in Demo Demo data` && head.demo, `its line reads "${head.line}", the shelf labeled as demo data`);

    const shown = await asksShown();
    const wanted = wantAsks(A.messageIds, "UTC");
    check(shown.length === A.count, `${shown.length} asks listed`);
    check(shown.every((row, i) => row.text === wanted[i]?.text), "each is the export's phrasing, word for word, newest first");
    check(shown.every((row, i) => row.shown === wanted[i]?.shown && Date.parse(row.datetime) === Date.parse(wanted[i]!.time)), `each dated the day it was sent (${shown.map((row) => row.shown).join(", ")})`);
    const lists = [...new Set(shown.map((row) => row.list))];
    const years = [...new Set(wanted.map((row) => row.list))];
    check(shown.every((row, i) => row.list === wanted[i]?.list) && lists.join(", ") === years.join(", "), `one list per year, newest first: ${lists.join(", ")}`);
  });

  await step("2. Each card's status shows on the shelf: To prove, Proven, and Asked since proven told apart", async () => {
    // Card A passes a cold rep; card B passes one, then a small export brings a newer phrasing of its skill.
    const [cardA, cardB, cardC] = await ada.client.cards.list(demo.id);
    let stamped = "";
    for (const card of [cardA!, cardB!]) {
      model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
      const { rep } = await ada.client.reps.start(card.id);
      stamped = (await ada.client.reps.check(rep.id, { answer: "My own answer." })).card.returnedAt!;
    }
    // Asked a second after card B's proven stamp: an ask at the same moment would leave it proven.
    const newer = "how do i put a div in the middle of the page with css";
    also.set(newer, key.skills[1]!.name);
    const read = await smallExport([{ text: newer, time: new Date(Date.parse(stamped) + 1000) }]);
    const made = await ada.client.uploads.create(demo.id, { source: read.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, read.phrasings);
    await ada.client.uploads.finish(made.id);
    await sortEnds(ada.client, made.id);
    const [A, B] = await ada.client.cards.list(demo.id);
    check(A?.status === "returned" && B?.status === "borrowed_again" && B.count === key.skills[1]!.count + 1, `the API has card A ${A?.status}, card B ${B?.status} with ${B?.count} asks (its last ask ${B?.lastBorrowAt}, after its proven stamp ${B?.returnedAt})`);
    const PROVEN = A!.returnedAt!;
    const AGAIN = B!.returnedAt!;

    await page.goto(`${app.url}/app/shelves/${demo.id}`);
    await settle(main().getByRole("list", { name: "Cards on Demo, most asked first" }));
    const rows = await cardRows();
    check(rows[0]?.status === "Proven" && rows[1]?.status === "Asked since proven" && rows.slice(2).every((row) => row.status === "To prove"), `each row says its status: ${rows.map((row, i) => `${String.fromCharCode(65 + i)} ${row.status}`).join(", ")}`);
    check(rows[1]?.again === `asked again ${on(utc.date, B!.lastBorrowAt)}` && rows.every((row, i) => i === 1 || row.again === ""), `card B alone says when it was asked again: "${rows[1]?.again}"`);
    check(rows[0]?.strip.endsWith(`, proven ${on(utc.longDate, PROVEN)}`) === true && rows[1]?.strip.endsWith(`, proven ${on(utc.longDate, AGAIN)}`) === true && !rows[2]?.strip.includes("proven"), `the strips mark the day each was proven: "${rows[0]?.strip}"`);

    // The filter tells them apart too.
    const filter = main().getByRole("button", { name: /^(All|To prove|Proven|Asked since proven) \d+$/ });
    const filters = (await filter.allTextContents()).map(squish);
    check(filters.join(", ") === "All 5, To prove 3, Proven 1, Asked since proven 1", `the filter counts them: ${filters.join(", ")}`);
    await main().getByRole("button", { name: "Proven 1", exact: true }).click();
    const proven = await cardRows();
    await main().getByRole("button", { name: "Asked since proven 1", exact: true }).click();
    const askedAgain = await cardRows();
    check(proven.map((row) => row.skill).join() === key.skills[0]!.name && askedAgain.map((row) => row.skill).join() === key.skills[1]!.name, `Proven shows card A alone, Asked since proven card B alone (${proven.length}, ${askedAgain.length})`);
    await main().getByRole("button", { name: "All 5", exact: true }).click();

    await page.goto(`${app.url}/app/cards/${cardA!.id}`);
    await cardLoaded(key.skills[0]!.name);
    let head = await cardHead();
    const stamp = await say(main().getByRole("region", { name: "Prove it without AI" }).locator("p").filter({ hasText: /^Proven / }));
    check(head.status === "Proven" && stamp === `Proven ${on(utc.date, PROVEN)}`, `card A's page says ${head.status}, stamped "${stamp}"`);

    await page.goto(`${app.url}/app/shelves/${demo.id}`);
    await main().getByRole("link", { name: key.skills[1]!.name, exact: true }).click();
    await cardLoaded(key.skills[1]!.name);
    check(new URL(page.url()).pathname === `/app/cards/${cardB!.id}`, `card B has its own address (${new URL(page.url()).pathname})`);
    head = await cardHead();
    const again = await say(main().getByRole("region", { name: "Prove it without AI" }).locator("p").filter({ hasText: /^Proven / }));
    check(head.status === "Asked since proven" && again === `Proven ${on(utc.date, AGAIN)}, then asked again ${on(utc.date, B!.lastBorrowAt)}, so it needs a fresh cold rep.`, `card B's page says ${head.status}: "${again}"`);

    await page.goto(`${app.url}/app/cards/${cardC!.id}`);
    await cardLoaded(key.skills[2]!.name);
    head = await cardHead();
    check(head.status === "To prove" && !head.strip.includes("proven"), `card C's page says ${head.status}, with no proven day`);
  });

  const ZONE = "Pacific/Kiritimati";
  const east = await adaPage(ZONE);
  await step(
    `3. Dates and months are in the learner's own time zone (${ZONE}, 14 hours ahead)`,
    async () => {
      const [cardA] = await ada.client.cards.list(demo.id);
      const A = key.skills[0]!;
      await east.goto(`${app.url}/app/cards/${cardA!.id}`);
      await cardLoaded(A.name, east);
      const wanted = wantAsks(A.messageIds, ZONE);
      const shown = await asksShown(east);
      check(shown.map((row) => row.shown).join(", ") === wanted.map((row) => row.shown).join(", "), `each ask is dated the day it was sent there: ${shown.map((row) => row.shown).join(", ")}`);
      check(shown.every((row, i) => row.list === wanted[i]?.list && row.text === wanted[i]?.text), `each under that day's year: ${[...new Set(shown.map((row) => row.list))].join(", ")}`);
      const there = zoned(ZONE);
      const moved = wanted.filter((row) => on(there.iso, row.time) !== on(utc.iso, row.time)).length;
      check(moved > 0, `${moved} of them fall on a later day than in UTC`);
      const times = A.messageIds.map((id) => keyed(id).time).sort((a, b) => Date.parse(a) - Date.parse(b));
      const head = await cardHead(east);
      check(head.line === `Asked ${A.count} times, ${on(there.month, times[0]!)} to ${on(there.month, times.at(-1)!)}, in Demo Demo data`, `its line reads "${head.line}"`);
    },
    east,
  );

  await step("4. Not on a card lists the messages nothing else asks yet, word for word, newest first, a page at a time", async () => {
    await page.goto(`${app.url}/app/shelves/${demo.id}`);
    await settle(main().getByRole("list", { name: "Cards on Demo, most asked first" }));
    await main().getByRole("list", { name: "Views of Demo" }).getByRole("link", { name: /^Not on a card / }).click();
    await settle(main().getByRole("table", { name: "Your messages in Demo not on a card, newest first" }));
    check(new URL(page.url()).searchParams.get("view") === "once", `at ${new URL(page.url()).search}`);
    const views = await tabs();
    check(views.current === `Not on a card ${key.oneOffs.length}` && (await main().getByRole("heading", { name: "Not on a card", exact: true, level: 2 }).count()) === 1, `the current tab is "${views.current}", and the view is headed Not on a card`);
    check(views.all.join(", ") === `Cards ${key.skills.length}, Not on a card ${key.oneOffs.length}, Uploads 2`, `the tabs still count the cards: ${views.all.join(", ")}`);
    const rows = await onceRows();
    const want = key.oneOffs.map(keyed).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    check(rows.length === want.length, `${rows.length} not on a card, the key has ${want.length} one-offs`);
    check(rows.every((row, i) => row.text === want[i]?.text && row.shown === on(utc.date, want[i]!.time)), "each is the export's phrasing, word for word, with its date, newest first");
    check((await main().getByRole("button", { name: "Show more", exact: true }).count()) === 0, "one page holds them all");

    // A shelf with more messages not on a card than a page holds: phrasings of the learner's that the key sorts nowhere.
    const scratch = await ada.client.shelves.create({ name: "Scratch" });
    const loose = Array.from({ length: 60 }, (_, i) => ({ sourceId: `loose-${i}`, text: `how do i do thing number ${i}`, time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }));
    const made = await upload(ada.client, scratch.id, loose);
    await sortEnds(ada.client, made.id);
    await page.goto(`${app.url}/app/shelves/${scratch.id}?view=once`);
    const table = main().getByRole("table", { name: "Your messages in Scratch not on a card, newest first" });
    await settle(table);
    const first = await onceRows();
    check(first.length === 50 && first[0]?.text === loose[59]!.text, `the first page holds ${first.length}, newest first`);
    check((await tabs()).current === "Not on a card 50+", `its tab counts "${(await tabs()).current}"`);
    await main().getByRole("button", { name: "Show more", exact: true }).click();
    await table.locator("tbody tr").nth(59).waitFor();
    const all = await onceRows();
    check(all.length === 60 && all.every((row, i) => row.text === loose[59 - i]!.text), `Show more adds the rest: ${all.length}`);
    check((await main().getByRole("button", { name: "Show more", exact: true }).count()) === 0, "and goes once there's no more");
    const focusedRow = await table.locator("tbody tr").evaluateAll((rows) => rows.indexOf(document.activeElement as HTMLTableRowElement));
    check(focusedRow === 50, `focus moves to the first row the last page brought (row ${focusedRow + 1})`);
  });

  await step("5. Uploads: the date, the source, your messages, and the new ones", async () => {
    await page.goto(`${app.url}/app/shelves/${demo.id}`);
    await settle(main().getByRole("list", { name: "Cards on Demo, most asked first" }));
    await main().getByRole("list", { name: "Views of Demo" }).getByRole("link", { name: /^Uploads / }).click();
    await settle(main().getByRole("table", { name: "Uploads into Demo, newest first" }));
    check(
      (await main().getByRole("heading", { name: "Uploads", exact: true, level: 2 }).count()) === 1 && new URL(page.url()).searchParams.get("view") === "uploads",
      `headed Uploads, at ${new URL(page.url()).search}, the current tab "${(await tabs()).current}"`,
    );
    const [small, whole] = (await ada.client.uploads.list(demo.id)).uploads;
    const rows = await uploadRows();
    check(rows.length === 2, `${rows.length} uploads listed: the demo export, then step 2's small export`);
    const [newest, row] = rows;
    check(newest?.source === "Claude" && newest.messages === "1" && newest.added === "1" && newest.file === small!.fileName, `newest first, the small export reads ${JSON.stringify(newest)}`);
    check(row?.date === on(utc.date, whole!.createdAt) && row.source === "ChatGPT" && row.messages === "27" && row.added === "27" && row.file === whole!.fileName, `the demo export reads ${JSON.stringify(row)}`);
    check(newest?.href === `/app/shelves/${demo.id}/upload?upload=${small!.id}` && row?.href === `/app/shelves/${demo.id}/upload?upload=${whole!.id}`, `each date leads to its upload's own page (${row?.href})`);
  });

  // The demo export in two halves, as two uploads: the second brings the rest of every card's asks.
  const half = 13;
  const firstHalf = phrasings.slice(0, half);
  let work: Shelf;
  let second: Upload;
  await step("6. Delete the second of two uploads, after its confirmation: its asks go, and any card left under two", async () => {
    work = await ada.client.shelves.create({ name: "Work" });
    const first = await upload(ada.client, work.id, firstHalf, "march.json");
    await sortEnds(ada.client, first.id);
    second = await upload(ada.client, work.id, phrasings.slice(half), "september.json");
    await sortEnds(ada.client, second.id);
    const before = await ada.client.cards.list(work.id);
    check(before.length === key.skills.length, `with both uploads, Work has ${before.length} cards`);

    await page.goto(`${app.url}/app/shelves/${work.id}?view=uploads`);
    const table = main().getByRole("table", { name: "Uploads into Work, newest first" });
    await settle(table);
    const rows = await uploadRows();
    check(rows.map((row) => row.added).join(", ") === `${phrasings.length - half}, ${half}`, `newest first: ${rows.map((row) => `${row.messages} messages, ${row.added} new`).join("; ")}`);
    check((await tabs()).all[0] === `Cards ${key.skills.length}`, `the Cards tab counts ${(await tabs()).all[0]}`);

    const remove = main().getByRole("button", { name: /^Delete the upload of / }).first();
    await remove.click();
    const confirm = main().getByRole("group", { name: /^Delete the upload of .+\?$/ });
    await confirm.waitFor();
    const asked = squish(await confirm.textContent());
    check(asked.includes(`${phrasings.length - half} messages`) && asked.includes("fewer than two asks") && asked.includes("can't be undone"), `the confirmation names what goes: "${asked}"`);
    check((await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent}`)) === "BUTTON Keep it", "Keep it takes focus first");
    await confirm.getByRole("button", { name: "Keep it", exact: true }).click();
    await confirm.waitFor({ state: "detached" });
    check((await ada.client.uploads.list(work.id)).uploads.length === 2, "Keep it keeps the upload");
    check(await remove.evaluate((button) => button === document.activeElement), "and gives focus back to its Delete button");

    await remove.click();
    await confirm.getByRole("button", { name: "Delete the upload", exact: true }).click();
    // The page reloads the shelf after a delete; until then the deleted upload's row stays.
    await table.locator("tbody tr").nth(1).waitFor({ state: "detached" });
    const left = await uploadRows();
    check(left.length === 1 && left[0]?.added === String(half), `the uploads list only the first: ${JSON.stringify(left)}`);
    check(await main().getByRole("heading", { name: "Uploads", exact: true, level: 2 }).evaluate((heading) => heading === document.activeElement), "focus goes to the view's heading");

    // The answer key says what stays: a card keeps the asks of the first half, if it still has two.
    const inFirst = (ids: string[]) => ids.filter((id) => Number(id.slice(1)) <= half);
    const kept = key.skills.filter((skill) => inFirst(skill.messageIds).length >= 2);
    const lone = key.skills.flatMap((skill) => (inFirst(skill.messageIds).length === 1 ? inFirst(skill.messageIds) : []));
    check((await tabs()).all[0] === `Cards ${kept.length}`, `the Cards tab now counts ${(await tabs()).all[0]}`);
    await main().getByRole("list", { name: "Views of Work" }).getByRole("link", { name: /^Cards / }).click();
    await settle(main().getByRole("list", { name: "Cards on Work, most asked first" }));
    const cardsLeft = await cardRows();
    check(
      cardsLeft.map((row) => `${row.skill} ${row.count}`).join(" | ") === kept.map((skill) => `${skill.name} ${inFirst(skill.messageIds).length}`).join(" | "),
      `the cards left: ${cardsLeft.map((row) => `${row.skill} ${row.count}`).join(" | ")}`,
    );

    const gone = await failure(ada.client.uploads.get(second.id));
    check(gone?.status === 404, `the API has no second upload: ${sayError(gone)}`);
    const cards = await Promise.all((await ada.client.cards.list(work.id)).map((card) => ada.client.cards.get(card.id)));
    const got = cards.map((card) => `${card.skill}: ${idList(card.borrows.map((b) => named(b.sourceId)))}`);
    const want = kept.map((skill) => `${skill.name}: ${idList(inFirst(skill.messageIds))}`);
    check(got.join(" | ") === want.join(" | "), `the API's cards keep only the first half's asks: ${got.join(" | ")}`);
    const unsorted = (await allUnsorted(ada.client, work.id)).map((p) => named(p.sourceId));
    const wantUnsorted = [...inFirst(key.oneOffs), ...lone];
    check(idList(unsorted) === idList(wantUnsorted), `a card left with one ask is gone, its phrasing not on a card: [${idList(unsorted)}], the key says [${idList(wantUnsorted)}]`);
    const secondIds = new Set(phrasings.slice(half).map((p) => p.sourceId));
    const strays = [...cards.flatMap((card) => card.borrows.map((b) => b.sourceId)), ...(await allUnsorted(ada.client, work.id)).map((p) => p.sourceId)].filter((id) => secondIds.has(id));
    check(strays.length === 0, `none of the second upload's phrasings is left (${strays.length})`);
  });

  await step("7. Deleting an upload needs its owner's session: another account gets 404, an API key 403", async () => {
    const [first] = (await ada.client.uploads.list(work.id)).uploads;
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const theirs = await failure(bea.client.uploads.delete(first!.id));
    check(theirs?.status === 404, `Bea deleting Ada's upload: ${sayError(theirs)}`);
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    const script = createClient({ baseUrl: app.url, apiKey });
    const keyed = await failure(script.uploads.delete(first!.id));
    check(keyed?.status === 403, `an API key deleting it: ${sayError(keyed)}`);
    const again = await failure(ada.client.uploads.delete(second.id));
    check(again?.status === 404, `deleting the deleted one again: ${sayError(again)}`);
    check((await ada.client.uploads.list(work.id)).uploads.length === 1, "the first upload is still there");
  });

  await step("8. A shelf with no cards says why: nothing uploaded, a sort under way, or nothing asked twice yet", async () => {
    const empty = await ada.client.shelves.create({ name: "Day job" });
    const at = `${app.url}/app/shelves/${empty.id}`;
    const block = main().locator('[data-slot="empty"]');
    const said = async () => {
      await page.goto(at);
      await settle(block);
      return {
        heading: await say(main().getByRole("heading", { level: 1 })),
        subline: await say(main().locator("header p")),
        tab: (await tabs()).all[0],
        title: await say(block.locator('[data-slot="empty-title"]')),
        body: await say(block.locator('[data-slot="empty-description"]')),
        links: (await block.locator("a").allTextContents()).map(squish),
      };
    };
    let now = await said();
    check(
      now.heading === "Day job" && now.subline === "0 cards, nothing uploaded yet." && now.tab === "Cards 0" && now.title === "No cards yet" && now.links.join() === "Upload a chat export",
      `with no upload: ${JSON.stringify(now)}`,
    );

    // The sort's model request is held here, so the upload stays sorting while the page is read.
    const held = hold();
    model.queue(held.answer);
    const twice = [
      { sourceId: "twice-1", text: "how do i rename a branch in git", time: "2026-02-01T10:00:00.000Z" },
      { sourceId: "twice-2", text: "how do i make a cup of tea", time: "2026-02-02T10:00:00.000Z" },
    ];
    const sorting = await upload(ada.client, empty.id, twice);
    await held.reached;
    now = await said();
    check(now.body.includes("still being sorted") && now.links.join() === "See its sort", `while its sort runs: ${JSON.stringify(now)}`);
    check((await block.locator("a").getAttribute("href")) === `/app/shelves/${empty.id}/upload?upload=${sorting.id}`, "and leads to the upload's own page, where the sort shows");
    held.release(reply({ joins: [], newSkills: [] }));
    await sortEnds(ada.client, sorting.id);
    now = await said();
    check(now.body.includes("asked more than once yet") && now.links.join() === "See the messages not on a card,Upload a chat export", `once nothing was asked twice: ${JSON.stringify(now)}`);
  });

  await step("9. The page reached the server only through /api/v1, within its security policy", async () => {
    // The demo action reads the demo export, a static file, as any export is read on the page before it's sent.
    const outside = apiCalls.filter((call) => !call.split(" ")[1]!.startsWith("/api/v1/") && call !== "GET /demo/export.json");
    check(apiCalls.length > 0 && outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1${outside.length ? `: ${outside.join(", ")}` : ""}`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
