// Checks Search (app-notes/depth/plan.md, section 3) on a fresh copy of the
// app: first GET /api/v1/search through the SDK, then the screen at
// /app/search in a real browser, as a learner and as the guest, at
// 1440×900 and 390×844. The model is a stand-in that sorts as the demo
// export's answer key does; a search itself asks it nothing.
// Through the SDK: a search finds the demo export's phrasings that have
// every word, word for word and newest first, with the key's cards they're
// on, most matches first; words are lowercased from A to Z, trimmed of
// sentence punctuation, and cut at 8; a card whose name alone has the words
// is listed with 0 matches; ?shelfId= scopes it, and one that isn't yours is
// a 404; a q with no word of 2 or more characters is a 400 that doesn't
// repeat it; it lists 50 matches at most while total counts them all, with
// a message not on a card carrying no card; an API key reads the same,
// another account finds none of it, and no one logged out does.
// In the browser: before a search the screen offers searches from the
// learner's own cards and sends no search; typing searches 250 ms after
// the last key and Enter at once, both in place (the address holds ?q=,
// with no new history entry and no remount); the answer is a sentence from
// the data over the cards and the messages, word for word, the words
// marked; a newer search aborts the older one; the wait and a failure with
// its retry show; an example opens its search and back returns; "/"
// focuses the field unless the learner is typing; the guest sees the demo
// workspace's answer labeled as demo data. No console error, no answer of
// 400 or more the check didn't cause, and no model request.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:search [screenshot dir]

import { ApiError, createClient, searchWords, type SearchAnswer, type Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { smallExport, sortsByKey } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-search");
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const NO_WORD = "q needs a word of 2 or more characters.";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(sortsByKey(refuse()));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

/** A's to z's lowercased, as the server's lower() does. */
const fold = (text: string) => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
const hasAll = (text: string, words: string[]) => words.every((word) => fold(text).includes(word));
const statusOf = (promise: Promise<unknown>) => promise.then(() => 200, (error) => (error instanceof ApiError ? error.status : 0));
const messageOf = (promise: Promise<unknown>) => promise.then(() => "", (error) => (error instanceof Error ? error.message : String(error)));
const skillOf = (sourceId: string) => key.skills.find((skill) => skill.messageIds.includes(named(sourceId)))?.name ?? null;
const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
const bea = app.browser();
await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
const guest = app.browser();
await guest.client.auth.signInAsGuest();
let demo: Shelf;
let work: Shelf;

type Watched = { page: Page; searches: string[]; failed: string[]; bad: string[]; errors: string[] };

/** A page logged in as `who`, in UTC, watching its searches, its aborted requests, its answers of 400 or more, and its console errors. */
async function pageAs(who: Learner, viewport: { width: number; height: number }, clock = false): Promise<Watched> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, timezoneId: "UTC" });
  const cookies = who.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([cookie, value]) => ({ name: cookie!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  if (clock) await page.clock.install();
  const watched: Watched = { page, searches: [], failed: [], bad: [], errors: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/search") watched.searches.push(url.searchParams.get("q") ?? "");
  });
  page.on("requestfailed", (request) => watched.failed.push(`${new URL(request.url()).searchParams.get("q")} ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    if (response.status() >= 400) watched.bad.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) watched.errors.push(message.text());
  });
  page.on("pageerror", (error) => watched.errors.push(error.message));
  return watched;
}

const shoot = (page: Page, name: string) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
const field = (page: Page) => page.getByRole("search").getByRole("searchbox", { name: "Search your messages and your cards' names" });
const sentence = (page: Page) => page.locator("main [aria-live] > p").first();
/** Marks the h1, so a remount, which draws a new one, shows. */
const markH1 = (page: Page) => page.evaluate(() => ((document.querySelector("main h1") as HTMLElement & { kept?: boolean }).kept = true));
const sameH1 = (page: Page) => page.evaluate(() => (document.querySelector("main h1") as HTMLElement & { kept?: boolean }).kept === true);
const where = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};

try {
  await step("1. A search finds the demo export's phrasings with every word, newest first, and the key's cards they're on", async () => {
    demo = await ada.client.shelves.create({ name: "Demo", demo: true });
    work = await ada.client.shelves.create({ name: "Work" });
    const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
    check(sorted.status === "sorted", `the demo export is sorted (${sorted.status})`);

    const words = ["git", "commit"];
    const found = await ada.client.search.get({ q: "git commit" });
    const want = phrasings.filter((phrasing) => hasAll(phrasing.text, words)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    check(found.q === "git commit" && found.words.join() === words.join(), `it looked for ${JSON.stringify(found.words)}`);
    check(found.searched === phrasings.length, `it searched all ${found.searched} phrasings`);
    check(found.total === want.length && found.phrasings.length === want.length, `${found.total} have both words, as the export's own texts say (${want.length})`);
    check(found.phrasings.map((p) => named(p.sourceId)).join() === want.map((p) => named(p.sourceId)).join(), `newest first: ${found.phrasings.map((p) => named(p.sourceId)).join(" ")}`);
    check(
      found.phrasings.every((p) => p.text === phrasings.find((q) => q.sourceId === p.sourceId)?.text && p.shelf.id === demo.id && p.shelf.demo && (p.card?.skill ?? null) === skillOf(p.sourceId)),
      "each word for word, on the demo shelf, on the key's card for it",
    );

    const wantCards = key.skills
      .map((skill) => ({ name: skill.name, matches: skill.messageIds.filter((id) => hasAll(phrasings[Number(id.slice(1)) - 1]!.text, words)).length, byName: hasAll(skill.name, words) }))
      .filter((skill) => skill.matches > 0 || skill.byName);
    const cards = found.cards.map(({ card, matches }) => `${card.skill} ${matches}`);
    check(cards.sort().join() === wantCards.map((skill) => `${skill.name} ${skill.matches}`).sort().join(), `the cards and their matches are the key's: ${found.cards.map(({ card, matches }) => `${card.skill} (${matches})`).join(", ")}`);
    check(found.cards.every((found, i, all) => i === 0 || all[i - 1]!.matches >= found.matches), "most matches first");
    check(found.cards.every(({ card }) => card.shelf.id === demo.id && card.status === "borrowed" && card.count === key.skills.find((skill) => skill.name === card.skill)?.count), "each card with its shelf, status, and asks");
  });

  await step("2. Words are lowercased from A to Z, trimmed of punctuation, and cut at 8, and a card whose name alone has them is listed", async () => {
    const plain = await ada.client.search.get({ q: "git commit" });
    const loud = await ada.client.search.get({ q: "  GIT, Commit?  " });
    check(loud.words.join() === "git,commit" && loud.total === plain.total, `"GIT, Commit?" looks for ${JSON.stringify(loud.words)} and finds ${loud.total}`);
    check(searchWords("--soft c++ c# x").join() === "--soft,c++,c#", `flags and c++ keep their marks, one letter is left out: ${JSON.stringify(searchWords("--soft c++ c# x"))}`);
    const many = await ada.client.search.get({ q: "how do i undo my last git commit please now" });
    check(many.words.length === 8 && many.words.join(" ") === "how do undo my last git commit please", `ten words look for the first 8 of 2 or more characters: ${JSON.stringify(many.words)}`);

    const byName = key.skills.find((skill) => !phrasings.some((phrasing) => hasAll(phrasing.text, searchWords(skill.name))));
    check(byName !== undefined, `a card's whole name is in no message: ${byName?.name}`);
    const found = await ada.client.search.get({ q: byName!.name });
    const listed = found.cards.find(({ card }) => card.skill === byName!.name);
    check(found.total === 0 && listed?.matches === 0, `searching "${byName!.name}" finds no message, and lists its card with 0 matches (${found.cards.map(({ card, matches }) => `${card.skill} ${matches}`).join(", ")})`);
  });

  await step("3. ?shelfId= scopes it, and a shelf that isn't yours is a 404", async () => {
    const all = await ada.client.search.get({ q: "git commit" });
    const onDemo = await ada.client.search.get({ q: "git commit", shelfId: demo.id });
    check(JSON.stringify(onDemo) === JSON.stringify(all), "on the demo shelf, the same answer as across all");
    const onWork = await ada.client.search.get({ q: "git commit", shelfId: work.id });
    check(onWork.searched === 0 && onWork.total === 0 && !onWork.cards.length && !onWork.phrasings.length, "on the empty Work shelf, nothing searched and nothing found");
    check((await statusOf(ada.client.search.get({ q: "git", shelfId: "no-such-shelf" }))) === 404, "an unknown shelf is a 404");
    const hers = await bea.client.shelves.create({ name: "Hers" });
    check((await statusOf(ada.client.search.get({ q: "git", shelfId: hers.id }))) === 404, "another account's shelf is a 404");
  });

  await step("4. A q with no word of 2 or more characters is a 400 that doesn't repeat it", async () => {
    for (const q of ["", "a", " ?! x ", "“”"]) {
      const said = await messageOf(ada.client.search.get({ q }));
      check(said === NO_WORD, `${JSON.stringify(q)} is refused: "${said}"`);
    }
    const raw = await fetch(`${app.url}/api/v1/search`, { headers: { cookie: ada.cookie() } });
    check(raw.status === 400 && ((await raw.json()) as { error: string }).error === NO_WORD, `with no q at all, a ${raw.status}`);
  });

  await step("5. It lists the newest 50 matches while total counts them all; a message not on a card has no card", async () => {
    const start = Date.parse("2026-01-01T09:00:00Z");
    const read = await smallExport(Array.from({ length: 60 }, (_, i) => ({ text: `zebra crossing question ${i + 1}`, time: new Date(start + i * 3_600_000) })));
    const made = await ada.client.uploads.create(work.id, { source: read.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, read.phrasings);
    await sortEnds(ada.client, (await ada.client.uploads.finish(made.id)).id);
    const found = await ada.client.search.get({ q: "Zebra" });
    check(found.total === 60 && found.phrasings.length === 50, `total ${found.total}, listing ${found.phrasings.length}`);
    const times = found.phrasings.map((p) => Date.parse(p.time));
    check(times.every((time, i) => i === 0 || times[i - 1]! >= time) && times[0] === start + 59 * 3_600_000, "the newest 50, newest first");
    check(found.phrasings.every((p) => p.card === null && p.shelf.id === work.id && !p.shelf.demo) && !found.cards.length, "none on a card, each on Work, and no cards");
  });

  await step("6. It's the account's own: an API key reads the same, another account finds none of it, no one logged out does", async () => {
    const mine = await ada.client.search.get({ q: "git commit" });
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    const viaKey = await createClient({ baseUrl: app.url, apiKey }).search.get({ q: "git commit" });
    check(JSON.stringify(viaKey) === JSON.stringify(mine), "an API key reads the same answer");
    const hers = await bea.client.search.get({ q: "git commit" });
    check(hers.searched === 0 && hers.total === 0 && !hers.cards.length, "another account searches nothing of Ada's");
    check((await statusOf(createClient({ baseUrl: app.url }).search.get({ q: "git" }))) === 401, "logged out, a 401");
  });

  const models = model.requests.length;
  let ada1440: Watched | undefined;

  await step("7. Before a search, the screen offers searches from the learner's own cards, and sends none", async () => {
    ada1440 = await pageAs(ada, WIDE);
    const { page, searches } = ada1440;
    const main = page.getByRole("main");
    await page.goto(`${app.url}/app/search`);
    check((await say(main.getByRole("heading", { level: 1 }))) === "Have you asked this before?", `headed "${await say(main.getByRole("heading", { level: 1 }))}"`);
    check((await page.getByRole("search").count()) === 1 && (await field(page).getAttribute("type")) === "search", "one labeled search field in a search form");
    const examples = main.getByRole("list", { name: "Searches to try" }).getByRole("listitem");
    await examples.first().waitFor();
    const rows = await examples.evaluateAll((items) => items.map((item) => ({ q: new URL(item.querySelector("a")!.href).searchParams.get("q") ?? "", from: item.querySelector("p span")?.textContent ?? "" })));
    check(rows.length >= 1 && rows.length <= 5, `${rows.length} examples`);
    for (const row of rows) {
      const found = await ada.client.search.get({ q: row.q });
      const skill = row.from.replace(/^from /, "").replace(/, asked \d+ times?$/, "");
      check(found.cards.some(({ card }) => card.skill === skill) && row.q.split(" ").length <= 2, `"${row.q}" (two words at most) finds ${skill}`);
    }
    check(searches.length === 0, `no search was sent (${searches.length})`);
    await shoot(page, "1-learner-1440-before-a-search");
  });

  await step("8. Typing searches 250 ms after the last key and Enter at once, in place", async () => {
    const watched = await pageAs(ada, WIDE, true);
    const { page, searches } = watched;
    await page.goto(`${app.url}/app/search`);
    await field(page).waitFor();
    await markH1(page);
    const before = await page.evaluate(() => history.length);
    await field(page).click();
    await page.keyboard.type("git commit");
    await page.clock.runFor(249);
    check(where(page) === "/app/search" && searches.length === 0, `249 ms after the last key, nothing yet (${where(page)}, ${searches.length} searches)`);
    await page.clock.runFor(1);
    await page.waitForURL(/\?q=git\+commit$/);
    await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
    check(searches.join("|") === "git commit", `at 250 ms, one search, for the whole words (${JSON.stringify(searches)})`);
    await field(page).fill("squash");
    await field(page).press("Enter");
    await page.waitForURL(/\?q=squash$/, { timeout: 2_000 });
    check(where(page) === "/app/search?q=squash", `Enter writes ?q= at once, without the 250 ms (${where(page)})`);
    check((await page.evaluate(() => history.length)) === before, "each replaced the history entry rather than adding one");
    check((await sameH1(page)) && (await field(page).evaluate((input) => input === document.activeElement)), "the screen wasn't remounted, and the field kept focus");
    await page.context().close();
  });

  await step("9. The answer: a sentence from the data, the cards, then the messages word for word with the words marked", async () => {
    const { page } = ada1440!;
    const main = page.getByRole("main");
    await page.goto(`${app.url}/app/search?q=git+commit`);
    await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
    const answer = await ada.client.search.get({ q: "git commit" });
    const [only] = answer.cards.filter((found) => found.matches > 0);
    const want = answer.cards.filter((found) => found.matches > 0).length === 1 && answer.total === only!.matches ? `Yes: ${answer.total} of your messages ask that, all on ${only!.card.skill}, To prove.` : "(more than one card)";
    check((await say(sentence(page))) === want, `the answer: "${await say(sentence(page))}"`);
    const said = await say(main.getByText(/^Looked for /));
    check(said === `Looked for “git” and “commit” in all ${answer.searched} of your messages, and in your cards' names.`, `then "${said}"`);

    const cards = await main.getByRole("list", { name: "Cards with the words, most matches first" }).getByRole("listitem").evaluateAll((items) =>
      items.map((item) => ({ skill: item.querySelector("a")?.textContent ?? "", href: item.querySelector("a")?.getAttribute("href") ?? "", strip: item.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "" })),
    );
    check(
      JSON.stringify(cards.map((c) => [c.skill, c.href])) === JSON.stringify(answer.cards.map(({ card }) => [card.skill, `/app/cards/${card.id}`])) && cards.every((c) => c.strip.startsWith("Asked ")),
      `the cards in the API's order, each linking to its page with its ask strip: ${cards.map((c) => c.skill).join(", ")}`,
    );
    const rows = main.getByRole("list", { name: "Messages with the words, newest first" }).getByRole("listitem");
    const messages = await rows.evaluateAll((items) =>
      items.map((item) => ({
        text: item.querySelector("p")?.textContent ?? "",
        marks: [...item.querySelectorAll("p:first-child mark")].map((mark) => mark.textContent ?? ""),
        date: item.querySelector("time")?.getAttribute("datetime") ?? "",
        href: item.querySelector("a")?.getAttribute("href") ?? "",
      })),
    );
    check(
      JSON.stringify(messages.map((m) => [m.text, m.date, m.href])) === JSON.stringify(answer.phrasings.map((p) => [p.text, p.time, `/app/cards/${p.card!.id}`])),
      `the ${messages.length} messages, newest first, word for word, each dated and linking to its card`,
    );
    check(
      messages.every((m) => m.marks.length > 0 && m.marks.every((mark) => answer.words.some((word) => fold(mark).includes(word))) && answer.words.every((word) => m.marks.some((mark) => fold(mark).includes(word)))),
      "every word is marked in every message, and nothing else is",
    );
    const mark = await main.locator("mark").first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    check(mark.join() === "rgb(249, 207, 224),rgb(16, 20, 33)", `marks are the selection pink with ink (${mark.join(" / ")})`);
  });

  await step("10. A newer search aborts the one on its way, the wait shows, a stale answer is dimmed under its own words, and a failure shows with its retry", async () => {
    const { page, failed, searches } = ada1440!;
    const main = page.getByRole("main");
    await page.goto(`${app.url}/app/search`);
    await field(page).waitFor();
    let held = 0;
    await page.route("**/api/v1/search?**", async (route) => {
      if (held++ === 0) await Bun.sleep(1_500);
      await route.continue().catch(() => {});
    });
    searches.length = 0;
    failed.length = 0;
    await field(page).fill("port");
    await field(page).press("Enter");
    await main.getByRole("status").filter({ hasText: "Looking for “port”…" }).waitFor();
    check(true, "while it waits, it says which words it's looking for");
    await field(page).fill("free port");
    await field(page).press("Enter");
    await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
    await page.waitForTimeout(1_700);
    check(searches.join("|") === "port|free port" && failed.some((line) => line === "port net::ERR_ABORTED"), `the first search was aborted by the second (${failed.join(", ")})`);
    const answer = await ada.client.search.get({ q: "free port" });
    check((await say(main.getByText(/^Looked for /))).startsWith("Looked for “free” and “port”") && (await main.locator("mark").count()) > 0, `and the answer shown is the newer one's (${answer.total} messages)`);
    await page.unroute("**/api/v1/search?**");

    // A held search: the answer before stays, dimmed and busy, still naming its own words, with the wait for the new ones under it.
    let release = () => {};
    await page.route("**/api/v1/search?**", async (route) => {
      await new Promise<void>((done) => (release = done));
      await route.continue().catch(() => {});
    });
    await field(page).fill("squash");
    await field(page).press("Enter");
    const waiting = main.getByRole("status").filter({ hasText: "Looking for “squash”…" });
    await waiting.waitFor();
    const region = main.locator("[aria-live]").first();
    const shown = {
      busy: await region.getAttribute("aria-busy"),
      opacity: await region.evaluate((el) => getComputedStyle(el).opacity),
      words: await say(region.getByText(/^Looked for /)),
      panels: await main.locator('[aria-busy="true"]').count(),
    };
    check(
      shown.busy === "true" && shown.opacity === "0.6" && shown.words.startsWith("Looked for “free” and “port”") && shown.panels === 2,
      `while "squash" is held, the "free port" answer stays dimmed and busy, still saying ${shown.words.split(" in ")[0]}, its panels busy too (${JSON.stringify(shown)})`,
    );
    release();
    await region.getByText(/^Looked for “squash”/).waitFor();
    check((await region.getAttribute("aria-busy")) === null && (await waiting.count()) === 0 && (await main.locator('[aria-busy="true"]').count()) === 0, "once it answers, the new answer is at full strength and nothing is busy");
    await page.unroute("**/api/v1/search?**");

    let failOnce = true;
    await page.route("**/api/v1/search?**", async (route) => {
      if (failOnce) {
        failOnce = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The server failed." }) });
      } else await route.continue();
    });
    await field(page).fill("undo");
    await field(page).press("Enter");
    const alert = main.getByRole("alert");
    await alert.waitFor();
    check((await say(alert)).startsWith("The search didn't run.") && (await alert.getByRole("button", { name: "Try again" }).isVisible()), `a failure says "${await say(alert)}" with Try again`);
    await alert.getByRole("button", { name: "Try again" }).click();
    await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
    check((await alert.count()) === 0, "and Try again shows the answer");
    await page.unroute("**/api/v1/search?**");
  });

  await step("11. An example opens its search, back returns to the examples, and / focuses the field unless you're typing", async () => {
    const { page } = ada1440!;
    const main = page.getByRole("main");
    await page.goto(`${app.url}/app/search`);
    const example = main.getByRole("list", { name: "Searches to try" }).getByRole("link").first();
    const q = new URL((await example.getAttribute("href"))!, app.url).searchParams.get("q")!;
    await markH1(page);
    await example.click();
    await sentence(page).waitFor();
    check(where(page) === `/app/search?${new URLSearchParams({ q })}` && (await field(page).inputValue()) === q && (await sameH1(page)), `the example opens ?q=${q}, in the field, in place`);
    await page.goBack();
    await main.getByRole("list", { name: "Searches to try" }).waitFor();
    check(where(page) === "/app/search" && (await field(page).inputValue()) === "", "back returns to the examples, with the field empty");
    await page.locator("main h1").click();
    await page.keyboard.press("/");
    check(await field(page).evaluate((input) => input === document.activeElement), "/ focuses the field");
    await page.keyboard.type("git/");
    check((await field(page).inputValue()) === "git/", `typed in the field, / is a character (${await field(page).inputValue()})`);
  });

  await step("12. The learner's screens: an answer at both widths", async () => {
    const { page } = ada1440!;
    await page.goto(`${app.url}/app/search?q=commit`);
    await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
    await shoot(page, "2-learner-1440-commit");
    const phone = await pageAs(ada, PHONE);
    await phone.page.goto(`${app.url}/app/search?q=commit`);
    await sentence(phone.page).filter({ hasText: /^Yes: / }).waitFor();
    const wide = await phone.page.evaluate(() => document.documentElement.scrollWidth);
    check(wide <= PHONE.width, `no sideways scroll on a phone (${wide}px)`);
    await shoot(phone.page, "3-learner-390-commit");
    check(phone.errors.length === 0 && phone.bad.length === 0, `no console errors or failed answers${[...phone.errors, ...phone.bad].length ? `: ${[...phone.errors, ...phone.bad].join(" | ")}` : ""}`);
    await phone.page.context().close();
  });

  await step("13. The guest sees the demo workspace's answer, labeled as demo data, and a No with examples", async () => {
    const answer = await guest.client.search.get({ q: "git commit" });
    for (const [name, viewport] of [["1440", WIDE], ["390", PHONE]] as const) {
      const watched = await pageAs(guest, viewport);
      const { page } = watched;
      const main = page.getByRole("main");
      await page.goto(`${app.url}/app/search?q=git+commit`);
      await sentence(page).filter({ hasText: /^Yes: / }).waitFor();
      const [only] = answer.cards;
      check(
        (await say(sentence(page))) === `Yes: ${answer.total} of your messages ask that, all on ${only!.card.skill}, To prove.`,
        `at ${name}, the answer: "${await say(sentence(page))}"`,
      );
      const rows = main.getByRole("list", { name: "Messages with the words, newest first" }).getByRole("listitem");
      check((await rows.count()) === answer.phrasings.length && (await rows.filter({ hasText: "Demo data" }).count()) === answer.phrasings.length, `each of the ${answer.phrasings.length} messages is labeled as demo data`);
      await shoot(page, `${name === "1440" ? 4 : 5}-guest-${name}-git-commit`);
      if (name === "1440") {
        await page.goto(`${app.url}/app/search?q=kubernetes`);
        await sentence(page).filter({ hasText: /^No: / }).waitFor();
        check((await say(sentence(page))) === `No: none of your ${answer.searched} messages has that word.`, `a No: "${await say(sentence(page))}"`);
        check((await main.getByRole("list", { name: "Searches to try" }).getByRole("listitem").count()) > 0, "with searches to try from the guest's cards");
        await shoot(page, "6-guest-1440-no");
      }
      check(watched.errors.length === 0 && watched.bad.length === 0, `no console errors or failed answers${[...watched.errors, ...watched.bad].length ? `: ${[...watched.errors, ...watched.bad].join(" | ")}` : ""}`);
      await page.context().close();
    }
  });

  await step("14. The learner's page met no error it didn't cause, and no search asked the model", async () => {
    const { errors, bad } = ada1440!;
    check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    check(bad.every((line) => line === "503 /api/v1/search"), `no answer of 400 or more but the failure the check made (${bad.join(", ")})`);
    check(model.requests.length === models, `no model request (${model.requests.length - models})`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots: ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
