// Checks a project's page (m1kuorg/basics#45) in a real browser at
// 1920×1080, on a fresh copy of the app, each step checked again through the
// SDK. The app's model is a stand-in in this script, answering as the demo
// export's answer key does, so every sort ends as the key says. The demo
// action makes the demo project, labeled as demo data, whose stack shows
// cards A to E in the key's order, with card A's phrasings word for word,
// its count, its months, and a stamp per borrow.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:project [screenshot dir]

import type { Card, CardDetail, Project } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { key, keySorter, phrasings } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-project");
const FRAME = { width: 1920, height: 1080 };

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });

/** A page logged in as Ada, in its own context; the answer key's months and dates are in UTC, so pages read in UTC unless told otherwise. */
async function adaPage(timezoneId = "UTC") {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId });
  const cookies = ada.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
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
  await on.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined)).catch(() => undefined);
  await on.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

const text = async (selector: string, on: Page = page) => ((await on.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
/** The phrasing the key names, such as "m1": the demo export's own words and time. */
const keyed = (id: string) => phrasings[Number(id.slice(1)) - 1]!;
const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** The margin's keys, as the page shows them: letter, skill, count, and whether each is current or struck. */
const marginKeys = (on: Page = page) =>
  on.locator(".margin .margin-key").evaluateAll((keys) =>
    keys.map((k) => ({
      letter: k.children[0]?.textContent ?? "",
      skill: (k.children[1]?.firstChild?.textContent ?? "").trim(),
      count: k.children[2]?.textContent ?? "",
      current: k.getAttribute("aria-current") === "true",
      struck: getComputedStyle(k).textDecorationLine.includes("line-through"),
    })),
  );

/** The rail rows in the block: each phrasing's words, its stamp's date and datetime, and the year its rail is labeled with. */
const railRows = (on: Page = page) =>
  on.locator(".block .rail > li").evaluateAll((rows) =>
    rows.map((row) => ({
      text: row.querySelector(".phrasing")?.textContent ?? "",
      shown: row.querySelector(".stamp time")?.textContent ?? "",
      datetime: row.querySelector(".stamp time")?.getAttribute("datetime") ?? "",
      rail: row.parentElement?.getAttribute("aria-label") ?? "",
      key: row.querySelector(".rail-key") !== null,
    })),
  );

let demo: Project;

try {
  await step("1. The demo project's stack: cards A to E in the key's order, card A in the block, labeled as demo data", async () => {
    await page.goto(`${app.url}/app/projects`);
    await page.getByRole("button", { name: "Try the demo project" }).click();
    await page.locator(".block .upload-done p", { hasText: /sorted into Demo's cards\.$/ }).waitFor({ timeout: 60_000 });
    await page.getByRole("link", { name: "Go to Demo" }).click();
    await page.locator(".margin .margin-key").first().waitFor();
    [demo] = (await ada.client.projects.list()) as [Project];
    check(demo.demo && new URL(page.url()).pathname === `/app/projects/${demo.id}`, `on the demo project's page (${new URL(page.url()).pathname})`);

    const keys = await marginKeys();
    const want = key.skills.map((skill, i) => `${String.fromCharCode(65 + i)} ${skill.name} ${skill.count}`);
    const got = keys.map((k) => `${k.letter} ${k.skill} ${k.count}`);
    check(got.join(" | ") === want.join(" | "), `the margin's keys are the key's, in order: ${got.join(" | ")}`);
    check(keys[0]?.current === true && keys.slice(1).every((k) => !k.current), "key A is current");
    check((await text(".margin h2")) === "Keys, most borrowed first", `the keys are headed "${await text(".margin h2")}"`);
    check(await page.locator(".margin .demo-label").isVisible(), `the margin names the project with the demo-data label: "${await text(".margin .project-name")}"`);

    const A = key.skills[0]!;
    check((await text(".block h1.skill")) === A.name, `the block is headed by card A, "${await text(".block h1.skill")}"`);
    const line = await text(".block h1.skill + p");
    check(line === `Key A: borrowed ${A.count} times, ${A.firstMonth} to ${A.lastMonth}`, `its line reads "${line}"`);
    check((await text(".block .plate b")) === String(A.count) && (await text(".block .plate span")) === "times borrowed, not returned", `its plate says ${await text(".block .plate b")} ${await text(".block .plate span")}`);

    const rows = await railRows();
    const borrows = A.messageIds.map(keyed).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    check(rows.length === A.count && rows.every((r) => r.key), `${rows.length} rows on the rail, each with its key`);
    check(rows.every((r, i) => r.text === borrows[i]?.text), "each phrasing is the export's, word for word, oldest first");
    check(rows.every((r, i) => r.shown === utcDate(borrows[i]!.time) && Date.parse(r.datetime) === Date.parse(borrows[i]!.time)), `each stamp is the date it was sent (${rows.map((r) => r.shown).join(", ")})`);
    const years = [...new Set(borrows.map((b) => b.time.slice(0, 4)))];
    const rails = [...new Set(rows.map((r) => r.rail))];
    check(rails.join(", ") === years.map((y) => `Borrowed in ${y}`).join(", "), `one rail per year: ${rails.join(", ")}`);
    check((await text(".margin")).includes("A cut in the rail marks a new year of asking."), "the margin explains the year cut");

    const [cardA] = await ada.client.cards.list(demo.id);
    const open = page.locator(".block").getByRole("link", { name: "Open key A" });
    check((await open.getAttribute("href")) === `/app/cards/${cardA!.id}`, `Open key A leads to ${await open.getAttribute("href")}`);
  });

  await step("2. Each card's status shows on the stack: borrowed, returned, and borrowed again told apart", async () => {
    // Nothing can pass a cold rep until m1kuorg/basics#46, so the API's own answers are read here with card A
    // returned and card B borrowed again, rewritten in this script, never in the app.
    const RETURNED = "2026-10-16T12:00:00.000Z";
    const AGAIN = "2026-01-02T12:00:00.000Z";
    const [cardA, cardB] = await ada.client.cards.list(demo.id);
    const status = (card: Card): Partial<Card> =>
      card.id === cardA!.id ? { status: "returned", returnedAt: RETURNED } : card.id === cardB!.id ? { status: "borrowed_again", returnedAt: AGAIN } : {};
    await page.route(`**/api/v1/projects/${demo.id}/cards`, async (route) => {
      const { cards } = (await (await route.fetch()).json()) as { cards: Card[] };
      await route.fulfill({ json: { cards: cards.map((card) => ({ ...card, ...status(card) })) } });
    });
    await page.route("**/api/v1/cards/*", async (route) => {
      const card = (await (await route.fetch()).json()) as CardDetail;
      await route.fulfill({ json: { ...card, ...status(card) } });
    });
    await page.goto(`${app.url}/app/projects/${demo.id}`);
    await page.locator(".block .end-rule").waitFor();

    const keys = await marginKeys();
    check(keys[0]?.struck === true && keys.slice(1).every((k) => !k.struck), `only key A, returned, is struck through (${keys.map((k) => `${k.letter} ${k.struck ? "struck" : "plain"}`).join(", ")})`);
    const said = await page.locator(".margin .margin-key").evaluateAll((all) => all.map((k) => k.textContent ?? ""));
    check(said[0]?.includes("returned") === true && said[1]?.includes("Borrowed again") === true && !/returned|again/i.test(said[2] ?? ""), `each key says its status: ${said.map((t, i) => `${String.fromCharCode(65 + i)} "${t}"`).join(", ")}`);
    check((await text(".block .plate span")) === "times borrowed, returned", `card A's plate says "${await text(".block .plate span")}"`);
    check((await text(".block .end-rule")) === "Returned 2026-10-16", `its rail closes with "${await text(".block .end-rule")}"`);
    check((await page.evaluate(() => document.getAnimations().length)) === 0, "its keys are already seated, with no drop");

    await page.locator(".margin .margin-key").nth(1).click();
    await page.locator(".block h1.skill", { hasText: key.skills[1]!.name }).waitFor();
    check((await text(".block .plate span")) === "times borrowed, borrowed again", `card B's plate says "${await text(".block .plate span")}"`);
    check((await page.locator(".block .end-rule").count()) === 0, "its rail has no end rule");
    const again = await text(".block .rail:last-of-type + p");
    check(again === "Returned 2026-01-02, then borrowed again.", `under its rail: "${again}"`);
    check((await page.evaluate(() => document.getAnimations().length)) === key.skills[1]!.count, "its keys drop again, since it needs a fresh cold rep");
    check(new URL(page.url()).searchParams.get("card") === cardB!.id, `the address keeps the chosen card (${new URL(page.url()).search})`);

    await page.locator(".margin .margin-key").nth(2).click();
    await page.locator(".block h1.skill", { hasText: key.skills[2]!.name }).waitFor();
    check((await text(".block .plate span")) === "times borrowed, not returned", `card C, borrowed, has a plate that says "${await text(".block .plate span")}"`);
    await page.unrouteAll();
  });

  const ZONE = "Pacific/Kiritimati";
  const east = await adaPage(ZONE);
  await step(`3. Stamps and months are in the learner's own time zone (${ZONE}, 14 hours ahead)`, async () => {
    await east.goto(`${app.url}/app/projects/${demo.id}`);
    await east.locator(".block .rail").first().waitFor();
    const A = key.skills[0]!;
    const borrows = A.messageIds.map(keyed).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
    const want = borrows.map((b) => local.format(new Date(b.time)));
    const shown = (await railRows(east)).map((r) => r.shown);
    check(shown.join(", ") === want.join(", "), `each stamp is the day it was sent there: ${shown.join(", ")}`);
    const moved = want.filter((date, i) => date !== utcDate(borrows[i]!.time)).length;
    check(moved > 0, `${moved} of them fall on a later day than in UTC`);
    const monthIn = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, month: "long", year: "numeric" });
    const line = await text(".block h1.skill + p", east);
    check(line === `Key A: borrowed ${A.count} times, ${monthIn.format(new Date(borrows[0]!.time))} to ${monthIn.format(new Date(borrows.at(-1)!.time))}`, `its line reads "${line}"`);
  }, east);
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
