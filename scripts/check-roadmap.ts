// Checks the roadmap (app-notes/depth/plan.md, "2. Roadmap") on a fresh copy
// of the app: first the endpoint through the SDK, then the screen in a real
// browser at 1440×900 and 390×844, as a learner and as the guest. The app's
// model is a stand-in in this script: a sort ends as the demo export's
// answer key says, with a few more skills this script names, and a cold rep
// takes the answers a step queues. Through the SDK: a new account's roadmap
// has all 13 areas, in path order, empty; after the demo export, each of the
// key's five cards is on its area, with `matched` listing the words of its
// name that scored, and so are this script's own skills: a tie on the
// earlier area, the most words winning, and a name with none of them
// elsewhere; each area's cards are most asked first, its counts are its
// cards' statuses, and the areas' counts and the cards elsewhere add up to
// the Desk's totals, with every card once; a pass and a newer ask move a
// card to Proven and to Asked since proven; the guest's five cards, named as
// demo/sorted.json names them, land on the same areas; an API key reads the
// same roadmap, another account sees none of it, and no one logged out does.
// In the browser: the h1, the map as an ordered list of the 13 areas in path
// order, each card with its link, status, count, and why it's there, the
// sentence where each area ends, "Next on your path" with its one "Start a
// cold rep", the cards off the path, the index's links on a desktop and the
// tree on a phone, demo data labeled, one request for the roadmap, no model
// request, and no console errors; and a new account's empty path.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:roadmap [screenshot dir]

import { ApiError, createClient, type Client, type Desk, type Roadmap, type RoadmapCard } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser as Chromium, type Page } from "playwright";
import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { refuse, reply, sortRequest, startModelStub, type ModelRequest } from "./lib/model-stub";
import { kindOf, repReply, smallExport, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-roadmap");
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** The path, as the plan's table orders it. */
const PATH = ["terminal", "git", "html", "css", "javascript", "typescript", "frameworks", "node", "python", "sql", "http", "testing", "deploy"];
const NAMES = [
  "Terminal and the OS",
  "Git",
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React and frameworks",
  "Node and packages",
  "Python",
  "Databases and SQL",
  "HTTP and APIs",
  "Testing and debugging",
  "Deploy and DevOps",
];

/** Where each card lands, by its skill name, and the words that place it: the answer key's, the guest's, and this script's own. */
type Place = [area: string | null, matched: string[]];
const KEY_PLACES: Record<string, Place> = {
  "Undo a git commit": ["git", ["git", "commit"]],
  "Center an element with CSS": ["css", ["center", "css"]],
  "Free a port that's already in use": ["terminal", ["port"]],
  "Parse a date string in JavaScript": ["javascript", ["javascript"]],
  "Sort a list of dictionaries in Python": ["python", ["list", "dictionaries", "python"]],
};
const GUEST_PLACES: Record<string, Place> = {
  "Undo a git commit": ["git", ["git", "commit"]],
  "Center an element in CSS": ["css", ["center", "css"]],
  "Free a network port held by a process": ["terminal", ["port", "process"]],
  "Parse a date string in JavaScript": ["javascript", ["javascript"]],
  "Sort a list of dictionaries by a key in Python": ["python", ["list", "dictionaries", "python"]],
};
/** This script's skills, each asked twice: ties go to the earlier area, the most words win, and a name with none is elsewhere. */
const OWN: { skill: string; place: Place; asks: string[] }[] = [
  { skill: "Merge two arrays", place: ["git", ["merge"]], asks: ["how do i merge two arrays into one", "combine two arrays without duplicates"] },
  { skill: "Write a Dockerfile for Bun", place: ["node", ["bun"]], asks: ["dockerfile for a bun app", "how do i containerize my bun server"] },
  { skill: "Index a JSON column in Postgres", place: ["sql", ["index", "postgres"]], asks: ["index a jsonb field in postgres", "make postgres queries on a json column fast"] },
  { skill: "Read a CSV file in Rust", place: [null, []], asks: ["read a csv file in rust", "parse csv rows with serde in rust"] },
];

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
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

// The stand-in sorts by skill name: the key's phrasings onto the key's skills, and this script's onto its own.
const skillOf = new Map<string, string>([
  ...key.skills.flatMap((skill) => skill.messageIds.map((id) => [phrasings[Number(id.slice(1)) - 1]!.text, skill.name] as [string, string])),
  ...OWN.flatMap(({ skill, asks }) => asks.map((text) => [text, skill] as [string, string])),
]);
function sortsByName(request: ModelRequest) {
  const sent = sortRequest(request);
  const joins: { cardId: string; phrasingIds: string[] }[] = [];
  const newSkills: { name: string; phrasingIds: string[] }[] = [];
  const asked = Map.groupBy(
    sent.phrasings.filter((phrasing) => skillOf.has(phrasing.text)),
    (phrasing) => skillOf.get(phrasing.text)!,
  );
  for (const [name, list] of asked) {
    const ids = list.map((phrasing) => phrasing.id);
    const card = sent.cards.find((each) => each.skill === name);
    if (card) joins.push({ cardId: card.id, phrasingIds: ids });
    else if (ids.length >= 2) newSkills.push({ name, phrasingIds: ids });
  }
  return { joins, newSkills };
}

await mkdir(OUT, { recursive: true });
const model = await startModelStub((request, raw, body) => (kindOf(request) === "sort" ? reply(sortsByName) : refuse())(request, raw, body));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });

const everyCard = (map: Roadmap) => [...map.areas.flatMap((area) => area.cards), ...map.elsewhere];
const where = (map: Roadmap, skill: string): Place | undefined => {
  for (const area of map.areas) {
    const card = area.cards.find((each) => each.skill === skill);
    if (card) return [area.id, card.matched];
  }
  const off = map.elsewhere.find((each) => each.skill === skill);
  return off ? [null, off.matched] : undefined;
};
const same = (a: Place | undefined, b: Place) => a !== undefined && a[0] === b[0] && a[1].join() === b[1].join();
const show = (place: Place | undefined) => (place ? `${place[0] ?? "elsewhere"} [${place[1].join(", ")}]` : "missing");

/** The checks every roadmap answers: every area in path order, its cards most asked first and counted by status, and the sums the Desk's. */
function wellFormed(map: Roadmap, desk: Desk) {
  check(map.areas.map((area) => area.id).join() === PATH.join(), `every area, in path order, empty ones too: ${map.areas.map((area) => `${area.id} ${area.cards.length}`).join(", ")}`);
  check(map.areas.map((area) => area.name).join() === NAMES.join() && map.areas.every((area) => area.about.length > 0), "each named as the plan names it, with what it covers");
  const ordered = (cards: RoadmapCard[]) =>
    cards.every((card, i) => i === 0 || cards[i - 1]!.count > card.count || (cards[i - 1]!.count === card.count && cards[i - 1]!.lastBorrowAt >= card.lastBorrowAt));
  check(map.areas.every((area) => ordered(area.cards)) && ordered(map.elsewhere), "each area's cards, and those elsewhere, most asked first, ties to the later last ask");
  const counted = map.areas.every(
    (area) =>
      area.counts.cards === area.cards.length &&
      area.counts.borrowed === area.cards.filter((card) => card.status === "borrowed").length &&
      area.counts.returned === area.cards.filter((card) => card.status === "returned").length &&
      area.counts.borrowedAgain === area.cards.filter((card) => card.status === "borrowed_again").length,
  );
  check(counted, "each area's counts are its own cards' statuses");
  const all = everyCard(map);
  const sums = {
    cards: all.length,
    borrowed: all.filter((card) => card.status === "borrowed").length,
    returned: all.filter((card) => card.status === "returned").length,
    borrowedAgain: all.filter((card) => card.status === "borrowed_again").length,
  };
  const areaSums = map.areas.reduce((sum, area) => sum + area.counts.cards, 0) + map.elsewhere.length;
  check(JSON.stringify(sums) === JSON.stringify(desk.totals) && areaSums === desk.totals.cards, `the areas' counts and the cards elsewhere add up to the Desk's totals ${JSON.stringify(desk.totals)}`);
  check(new Set(all.map((card) => card.id)).size === all.length, "every card once");
  check(map.elsewhere.every((card) => card.matched.length === 0) && map.areas.every((area) => area.cards.every((card) => card.matched.length > 0)), "a card on an area has the words that placed it, and one elsewhere none");
}

let bootcamp: string;
let side: string;

try {
  await step("1. A new account's roadmap has every area, in path order, and nothing on it", async () => {
    const map = await ada.client.roadmap.get();
    wellFormed(map, await ada.client.desk.get());
    check(map.areas.every((area) => area.cards.length === 0 && area.counts.cards === 0) && map.elsewhere.length === 0, "no cards on any area, and none elsewhere");
  });

  await step("2. After the demo export and this script's skills, each card is on its area, by the words in its name", async () => {
    bootcamp = (await ada.client.shelves.create({ name: "Bootcamp" })).id;
    side = (await ada.client.shelves.create({ name: "Side projects" })).id;
    check((await sortEnds(ada.client, (await upload(ada.client, bootcamp, phrasings)).id)).status === "sorted", "the demo export is sorted onto Bootcamp");
    const own = await smallExport(OWN.flatMap(({ asks }, i) => asks.map((text, j) => ({ text, time: new Date(Date.UTC(2026, 5, 1 + i * 3 + j)) }))));
    const made = await ada.client.uploads.create(side, { source: own.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, own.phrasings);
    check((await sortEnds(ada.client, (await ada.client.uploads.finish(made.id)).id)).status === "sorted", "this script's skills are sorted onto Side projects");

    const map = await ada.client.roadmap.get();
    wellFormed(map, await ada.client.desk.get());
    for (const name of key.skills.map((skill) => skill.name)) {
      const want = KEY_PLACES[name];
      check(want !== undefined && same(where(map, name), want), `"${name}" is on ${show(where(map, name))}, as the plan places it (${show(want)})`);
    }
    for (const { skill, place } of OWN) check(same(where(map, skill), place), `"${skill}" is on ${show(where(map, skill))} (${show(place)})`);

    const listed = [...(await ada.client.cards.list(bootcamp)), ...(await ada.client.cards.list(side))];
    const shelves = new Map([
      [bootcamp, "Bootcamp"],
      [side, "Side projects"],
    ]);
    const asListed = everyCard(map).every((card) => {
      const { matched, shelf, ...rest } = card;
      const twin = listed.find((each) => each.id === card.id);
      return twin !== undefined && JSON.stringify(rest) === JSON.stringify(twin) && shelf.id === card.shelfId && shelf.name === shelves.get(shelf.id) && shelf.demo === false && Array.isArray(matched);
    });
    check(asListed && everyCard(map).length === listed.length, `each of the ${listed.length} cards is cards.list's card, with its shelf`);
  });

  await step("3. A pass makes a card Proven on its area, and a newer ask makes another Asked since proven", async () => {
    const before = await ada.client.roadmap.get();
    const css = before.areas.find((area) => area.id === "css")!.cards[0]!;
    const merge = before.areas.find((area) => area.id === "git")!.cards.find((card) => card.skill === "Merge two arrays")!;
    for (const card of [css, merge]) {
      model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
      const { rep } = await ada.client.reps.start(card.id);
      await ada.client.reps.check(rep.id, { answer: "My own answer." });
    }
    const again = "merge two arrays and keep the order";
    skillOf.set(again, "Merge two arrays");
    const newer = await smallExport([{ text: again, time: new Date(Date.now() + 1_000) }]);
    const made = await ada.client.uploads.create(side, { source: newer.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, newer.phrasings);
    await sortEnds(ada.client, (await ada.client.uploads.finish(made.id)).id);

    const map = await ada.client.roadmap.get();
    wellFormed(map, await ada.client.desk.get());
    const cssArea = map.areas.find((area) => area.id === "css")!;
    const git = map.areas.find((area) => area.id === "git")!;
    check(cssArea.cards[0]?.status === "returned" && cssArea.counts.returned === 1, `the CSS card is Proven, and CSS counts it (${JSON.stringify(cssArea.counts)})`);
    const merged = git.cards.find((card) => card.id === merge.id);
    check(merged?.status === "borrowed_again" && merged.count === 3 && git.counts.borrowedAgain === 1 && git.counts.borrowed === 1, `"Merge two arrays" is asked since proven, asked 3 times, and Git counts it (${JSON.stringify(git.counts)})`);
  });

  await step("4. The guest's cards, named as the demo workspace names them, land on the same areas", async () => {
    const guest = app.browser();
    await guest.client.auth.signInAsGuest();
    const sorted: { cards: { skill: string }[] } = await Bun.file(join(import.meta.dir, "..", "demo", "sorted.json")).json();
    check(sorted.cards.map((card) => card.skill).sort().join() === Object.keys(GUEST_PLACES).sort().join(), `the guest's skills are the ones this check places: ${sorted.cards.map((card) => card.skill).join(", ")}`);
    const map = await guest.client.roadmap.get();
    wellFormed(map, await guest.client.desk.get());
    for (const [name, want] of Object.entries(GUEST_PLACES)) check(same(where(map, name), want), `"${name}" is on ${show(where(map, name))} (${show(want)})`);
    check(everyCard(map).every((card) => card.shelf.demo), "every guest card says its shelf is demo data");
  });

  await step("5. The roadmap is the account's own: an API key reads it, another account sees none of it, and no one logged out does", async () => {
    const mine = await ada.client.roadmap.get();
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    check(JSON.stringify(await createClient({ baseUrl: app.url, apiKey }).roadmap.get()) === JSON.stringify(mine), "an API key reads the same roadmap as the session");
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const hers = await bea.client.roadmap.get();
    check(hers.areas.map((area) => area.id).join() === PATH.join() && everyCard(hers).length === 0, "another account's roadmap has every area and none of these cards");
    const status = await createClient({ baseUrl: app.url }).roadmap.get().then(
      () => 200,
      (error) => (error instanceof ApiError ? error.status : 0),
    );
    check(status === 401, `logged out, it's a 401 (${status})`);
  });

  await step("6. As the learner, the screen draws the path as the API places it, at 1440×900 and 390×844", async () => {
    const map = await ada.client.roadmap.get();
    const placed = map.areas.flatMap((area) => area.cards);
    const need = placed.filter((card) => card.status !== "returned");
    const needAreas = map.areas.filter((area) => area.cards.some((card) => card.status !== "returned"));
    const firstArea = needAreas[0]!;
    const next = firstArea.cards.find((card) => card.status !== "returned")!;
    for (const frame of [DESKTOP, PHONE]) {
      const { page, apiCalls, errors } = await watched(browser, ada, frame);
      const before = model.requests.length;
      await page.goto(`${app.url}/app/roadmap`);
      const main = page.getByRole("main");
      const areas = main.getByRole("list", { name: "Areas, in path order" });
      await areas.waitFor();
      const wide = frame === DESKTOP;
      const h1 = await say(main.getByRole("heading", { level: 1 }));
      check(h1 === `${need.length} cards need a cold rep, across ${needAreas.length} areas of the path.`, `@${frame.width} the h1 says "${h1}"`);
      check((await main.getByText(`${placed.length} cards on the path, ${map.elsewhere.length} off it, from Bootcamp and Side projects.`, { exact: true }).count()) === 1, "the line under it counts the cards and names their shelves");
      check((await main.getByRole("heading", { level: 2, name: "Placed by the words in its name", exact: true }).count()) === 1, "it says how a card is placed: by the words in its name");

      const drawn = await areas.locator(":scope > li").evaluateAll((items) =>
        items.map((item) => ({
          name: item.querySelector("h3")?.textContent ?? "",
          cards: [...item.querySelectorAll("ul > li")].map((row) => ({
            skill: row.querySelector("a")?.textContent ?? "",
            href: row.querySelector("a")?.getAttribute("href") ?? "",
            text: (row.textContent ?? "").replace(/\s+/g, " "),
          })),
          end: item.querySelector(":scope > p:last-child")?.textContent ?? "",
        })),
      );
      check(drawn.map((area) => area.name).join() === NAMES.join(), `the map lists the 13 areas in path order, as headings (${drawn.length})`);
      const words = { borrowed: "To prove", returned: "Proven", borrowed_again: "Asked since proven" } as const;
      const cardsRight = map.areas.every((area, i) =>
        area.cards.every((card, j) => {
          const row = drawn[i]?.cards[j];
          const why = `its name says ${new Intl.ListFormat("en-US", { type: "conjunction" }).format(card.matched.map((word) => `“${word}”`))}`;
          return row?.skill === card.skill && row.href === `/app/cards/${card.id}` && row.text.includes(words[card.status]) && row.text.includes(`asked ${card.count} times`) && row.text.includes(why);
        }),
      );
      check(cardsRight && drawn.every((area, i) => area.cards.length === map.areas[i]!.cards.length), "each area lists its cards in the API's order, each linking to its card with its status, count, and the words that placed it");
      const ends = map.areas.filter((area) => area.cards.length).map((area) => `${area.name}: ${area.counts.returned} of ${area.counts.cards} proven${area.counts.borrowedAgain ? `, ${area.counts.borrowedAgain} asked since proven` : ""}.`);
      check(ends.every((end) => drawn.some((area) => area.end === end)), `each area with cards ends on its sentence: ${ends.slice(0, 2).join(" ")} …`);
      const empties = await areas.getByText("No card on it yet", { exact: true }).count();
      check(empties === map.areas.filter((area) => !area.cards.length).length, `the ${empties} empty areas stay on the path, saying no card is on them`);

      const panel = main.getByRole("region", { name: "Next on your path" });
      const start = panel.getByRole("link", { name: `Start a cold rep on ${next.skill}`, exact: true });
      check((await start.getAttribute("href")) === `/app/cards/${next.id}?rep=start`, `Next on your path is ${firstArea.name}'s "${next.skill}", with Home's one-click Start a cold rep`);
      check((await main.locator(":is(a, button).bg-primary").count()) === 1, "it's the screen's one filled button");
      const off = await main.getByRole("list", { name: "Cards off the path, most asked first" }).getByRole("link").allTextContents();
      check(off.join() === map.elsewhere.map((card) => card.skill).join(), `off the path: ${off.join(", ")}`);

      const index = main.getByRole("navigation", { name: "Areas on the path" });
      if (wide) {
        check((await index.getByRole("link").count()) === 13, "a desktop has the index of areas down the right edge");
        await index.getByRole("link", { name: /^Python,/ }).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(/#area-python$/);
        const top = await page.locator("#area-python").evaluate((node) => node.getBoundingClientRect().top);
        check(top >= 0 && top < frame.height / 2, `its Python link, by keyboard, brings Python into view (top at ${Math.round(top)}px)`);
        await page.waitForFunction(() => document.querySelector("[aria-current=location]")?.getAttribute("href") === "#area-python");
        check(true, "and marks Python as the area in view");
      } else {
        check(!(await index.isVisible()), "a phone has no index; the map is the tree");
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(sideways <= 0, `no sideways scroll (${sideways}px)`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(OUT, `learner-${frame.width}.png`), fullPage: true });

      const asked = apiCalls.filter((call) => call !== "GET /api/v1/auth/me" && call !== "GET /api/v1/desk" && call !== "GET /api/v1/shelves");
      check(asked.join() === "GET /api/v1/roadmap", `the screen asks for the roadmap once, beside the shell's own requests (${apiCalls.join(", ")})`);
      check(model.requests.length === before, "and makes no model request");
      check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
      await page.context().close();
    }
  });

  await step("7. As the guest, the demo workspace's cards are on the path, labeled as demo data", async () => {
    const guest = app.browser();
    await guest.client.auth.signInAsGuest();
    const map = await guest.client.roadmap.get();
    for (const frame of [DESKTOP, PHONE]) {
      const { page, errors } = await watched(browser, guest, frame);
      await page.goto(`${app.url}/app/roadmap`);
      const main = page.getByRole("main");
      const areas = main.getByRole("list", { name: "Areas, in path order" });
      await areas.waitFor();
      const h1 = await say(main.getByRole("heading", { level: 1 }));
      check(h1 === "5 cards need a cold rep, across 5 areas of the path.", `@${frame.width} the h1 says "${h1}"`);
      for (const [name, [area]] of Object.entries(GUEST_PLACES)) {
        const row = main.getByRole("list", { name: `Cards on ${NAMES[PATH.indexOf(area!)]}, most asked first` }).getByRole("listitem").filter({ hasText: name });
        check((await row.count()) === 1 && (await row.getByText("Demo data", { exact: true }).count()) === 1, `"${name}" is on ${area}, labeled Demo data`);
      }
      check((await main.getByText("Demo data", { exact: true }).count()) >= map.areas.flatMap((area) => area.cards).length + 2, "the line under the h1 and Next on your path label it too");
      check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
      await page.screenshot({ path: join(OUT, `guest-${frame.width}.png`), fullPage: true });
      await page.context().close();
    }
  });

  await step("8. An account with a shelf and no cards sees the whole path, empty, and the ways to a first card", async () => {
    const cy = app.browser();
    await cy.client.auth.signUp({ name: "Cy Example", email: "cy@example.com", password: "analytical engine" });
    await cy.client.shelves.create({ name: "Day job" });
    const { page, errors } = await watched(browser, cy, DESKTOP);
    await page.goto(`${app.url}/app/roadmap`);
    const main = page.getByRole("main");
    await main.getByRole("heading", { level: 1, name: "No cards on the path yet.", exact: true }).waitFor();
    check(true, `the h1 says "No cards on the path yet."`);
    check((await main.getByText("No card on it yet", { exact: true }).count()) === 13, "all 13 areas stay on the path, each saying no card is on it");
    check(
      (await main.getByRole("button", { name: "Try the demo shelf", exact: true }).count()) === 1 && (await main.getByRole("link", { name: "Go to your shelves", exact: true }).count()) === 1,
      "Next on your path offers the demo shelf and your shelves",
    );
    check((await main.getByRole("heading", { name: "Off the path" }).count()) === 0, "and lists nothing off the path");
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await page.screenshot({ path: join(OUT, "empty-1440.png"), fullPage: true });
    await page.context().close();
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

/** A page logged in as `who`, in UTC, watching its API calls and console errors. */
async function watched(chromium: Chromium, who: Learner, viewport: { width: number; height: number }): Promise<{ page: Page; apiCalls: string[]; errors: string[] }> {
  const context = await chromium.newContext({ viewport, deviceScaleFactor: 1, timezoneId: "UTC" });
  const cookies = who.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const apiCalls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === app.url && ["fetch", "xhr"].includes(request.resourceType())) apiCalls.push(`${request.method()} ${url.pathname}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, apiCalls, errors };
}

async function say(locator: ReturnType<Page["locator"]>) {
  return ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
