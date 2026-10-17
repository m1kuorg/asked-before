// Checks a project's page (m1kuorg/basics#45) in a real browser at
// 1920×1080, on a fresh copy of the app, each step checked again through the
// SDK. The app's model is a stand-in in this script, answering as the demo
// export's answer key does, so every sort ends as the key says. The demo
// action makes the demo project, labeled as demo data, whose stack shows
// cards A to E in the key's order, with card A's phrasings word for word,
// its count, its months, and a stamp per borrow, in the learner's own time
// zone. Each card's status shows, after real cold reps through the API,
// whose model answers are queued in this script: card A passes one, and
// card B passes one, then a small export with a newer phrasing of its
// skill makes it borrowed again. Unsorted lists the key's one-offs a page at a time, and the upload
// history each upload's date, source, messages, and new ones. Deleting the
// second of two uploads through the page, after its confirmation, removes
// its borrows and any card left under two, as the key says, checked in the
// API; deleting needs the owner's session. A project with no cards says
// why, and the page reaches the server only through /api/v1.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:project [screenshot dir]

import { ApiError, createClient, type Project, type Upload } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { allUnsorted, idList, key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, reply, startModelStub } from "./lib/model-stub";
import { repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

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
// Sorts as the key does, with any phrasing `also` names placed on its skill's card; a rep or check takes the answer a step queues.
const also = new Map<string, string>();
const model = await startModelStub(sortsByKey(refuse(), also));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
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

/** The unsorted view's rows: each phrasing's words and its stamp's date. */
const unsortedRows = (on: Page = page) =>
  on.locator(".block table.rows tbody tr").evaluateAll((rows) =>
    rows.map((row) => ({ text: row.querySelector(".phrasing")?.textContent ?? "", shown: row.querySelector("time")?.textContent ?? "" })),
  );

/** The upload history's rows: the date and where it leads, the source, your messages, and the new ones. */
const uploadRows = (on: Page = page) =>
  on.locator(".block table.rows tbody tr:not(.row-detail)").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = [...row.querySelectorAll("td")].map((td) => td.textContent ?? "");
      return { date: cells[0] ?? "", href: row.querySelector("td a")?.getAttribute("href") ?? "", source: cells[1] ?? "", messages: cells[2] ?? "", added: cells[3] ?? "" };
    }),
  );

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
    // Card A passes a cold rep; card B passes one, then a small export brings a newer phrasing of its skill.
    const [cardA, cardB] = await ada.client.cards.list(demo.id);
    let stamped = "";
    for (const card of [cardA!, cardB!]) {
      model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
      const { rep } = await ada.client.reps.start(card.id);
      stamped = (await ada.client.reps.check(rep.id, { answer: "My own answer." })).card.returnedAt!;
    }
    // Asked a second after card B's return stamp: a borrow at the same moment would leave it returned.
    const newer = "how do i put a div in the middle of the page with css";
    also.set(newer, key.skills[1]!.name);
    const read = await smallExport([{ text: newer, time: new Date(Date.parse(stamped) + 1000) }]);
    const made = await ada.client.uploads.create(demo.id, { source: read.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, read.phrasings);
    await ada.client.uploads.finish(made.id);
    await sortEnds(ada.client, made.id);
    const [A, B] = await ada.client.cards.list(demo.id);
    check(A?.status === "returned" && B?.status === "borrowed_again" && B.count === key.skills[1]!.count + 1, `the API has card A ${A?.status}, card B ${B?.status} with ${B?.count} borrows (its last borrow ${B?.lastBorrowAt}, after its return stamp ${B?.returnedAt})`);
    const RETURNED = A!.returnedAt!;
    const AGAIN = B!.returnedAt!;
    await page.goto(`${app.url}/app/projects/${demo.id}`);
    await page.locator(".block .end-rule").waitFor();

    const keys = await marginKeys();
    check(keys[0]?.struck === true && keys.slice(1).every((k) => !k.struck), `only key A, returned, is struck through (${keys.map((k) => `${k.letter} ${k.struck ? "struck" : "plain"}`).join(", ")})`);
    const said = await page.locator(".margin .margin-key").evaluateAll((all) => all.map((k) => k.textContent ?? ""));
    check(said[0]?.includes("returned") === true && said[1]?.includes("Borrowed again") === true && !/returned|again/i.test(said[2] ?? ""), `each key says its status: ${said.map((t, i) => `${String.fromCharCode(65 + i)} "${t}"`).join(", ")}`);
    check((await text(".block .plate span")) === "times borrowed, returned", `card A's plate says "${await text(".block .plate span")}"`);
    check((await text(".block .end-rule")) === `Returned ${utcDate(RETURNED)}`, `its rail closes with "${await text(".block .end-rule")}"`);
    check((await page.evaluate(() => document.getAnimations().length)) === 0, "its keys are already seated, with no drop");

    await page.locator(".margin .margin-key").nth(1).click();
    await page.locator(".block h1.skill", { hasText: key.skills[1]!.name }).waitFor();
    check((await text(".block .plate span")) === "times borrowed, borrowed again", `card B's plate says "${await text(".block .plate span")}"`);
    check((await page.locator(".block .end-rule").count()) === 0, "its rail has no end rule");
    const again = await text(".block .rail:last-of-type + p");
    check(again === `Returned ${utcDate(AGAIN)}, then borrowed again.`, `under its rail: "${again}"`);
    check((await page.evaluate(() => document.getAnimations().length)) === key.skills[1]!.count + 1, "its keys drop again, since it needs a fresh cold rep");
    check(new URL(page.url()).searchParams.get("card") === cardB!.id, `the address keeps the chosen card (${new URL(page.url()).search})`);

    await page.locator(".margin .margin-key").nth(2).click();
    await page.locator(".block h1.skill", { hasText: key.skills[2]!.name }).waitFor();
    check((await text(".block .plate span")) === "times borrowed, not returned", `card C, borrowed, has a plate that says "${await text(".block .plate span")}"`);
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

  await step("4. Unsorted lists the phrasings nothing else asks yet, word for word, newest first, a page at a time", async () => {
    await page.goto(`${app.url}/app/projects/${demo.id}`);
    await page.locator(".margin").getByRole("link", { name: "Unsorted phrasings" }).click();
    await page.locator(".block table.rows").waitFor();
    check((await text(".block h1")) === "Unsorted phrasings", `headed "${await text(".block h1")}"`);
    check(new URL(page.url()).searchParams.get("view") === "unsorted", `at ${new URL(page.url()).search}`);
    const rows = await unsortedRows();
    const want = key.oneOffs.map(keyed).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    check(rows.length === want.length, `${rows.length} unsorted, the key has ${want.length} one-offs`);
    check(rows.every((r, i) => r.text === want[i]?.text && r.shown === utcDate(want[i]!.time)), "each is the export's phrasing, word for word, with its stamp, newest first");
    check((await page.locator(".margin .margin-key").count()) === key.skills.length, "the margin still keys the cards");
    check((await page.locator(".block").getByRole("button", { name: "Show more" }).count()) === 0, "one page holds them all");

    // A project with more unsorted phrasings than a page holds: phrasings of the learner's that the key sorts nowhere.
    const scratch = await ada.client.projects.create({ name: "Scratch" });
    const loose = Array.from({ length: 60 }, (_, i) => ({ sourceId: `loose-${i}`, text: `how do i do thing number ${i}`, time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }));
    const made = await upload(ada.client, scratch.id, loose);
    await sortEnds(ada.client, made.id);
    await page.goto(`${app.url}/app/projects/${scratch.id}?view=unsorted`);
    await page.locator(".block table.rows").waitFor();
    const first = await unsortedRows();
    check(first.length === 50 && first[0]?.text === loose[59]!.text, `the first page holds ${first.length}, newest first`);
    await page.locator(".block").getByRole("button", { name: "Show more" }).click();
    await page.locator(".block table.rows tbody tr").nth(59).waitFor();
    const all = await unsortedRows();
    check(all.length === 60 && all.every((r, i) => r.text === loose[59 - i]!.text), `Show more adds the rest: ${all.length}`);
    check((await page.locator(".block").getByRole("button", { name: "Show more" }).count()) === 0, "and goes once there's no more");
  });

  await step("5. The upload history: the date, the source, your messages, and the new ones", async () => {
    await page.goto(`${app.url}/app/projects/${demo.id}`);
    await page.locator(".margin").getByRole("link", { name: "Upload history" }).click();
    await page.locator(".block table.rows").waitFor();
    check((await text(".block h1")) === "Upload history" && new URL(page.url()).searchParams.get("view") === "uploads", `headed "${await text(".block h1")}", at ${new URL(page.url()).search}`);
    const [small, whole] = (await ada.client.uploads.list(demo.id)).uploads;
    const rows = await uploadRows();
    check(rows.length === 2, `${rows.length} uploads listed: the demo export, then step 2's small export`);
    const [newest, row] = rows;
    check(newest?.source === "Claude" && newest.messages === "1" && newest.added === "1", `newest first, the small export reads ${JSON.stringify(newest)}`);
    check(row?.date === utcDate(whole!.createdAt) && row.source === "ChatGPT" && row.messages === "27" && row.added === "27", `the demo export reads ${JSON.stringify(row)}`);
    check(newest?.href === `/app/projects/${demo.id}/upload?upload=${small!.id}` && row?.href === `/app/projects/${demo.id}/upload?upload=${whole!.id}`, `each date leads to its upload's own page (${row?.href})`);
  });

  // The demo export in two halves, as two uploads: the second brings the rest of every card's borrows.
  const half = 13;
  const firstHalf = phrasings.slice(0, half);
  let work: Project;
  let second: Upload;
  await step("6. Delete the second of two uploads, after its confirmation: its borrows go, and any card left under two", async () => {
    work = await ada.client.projects.create({ name: "Work" });
    const first = await upload(ada.client, work.id, firstHalf, "march.json");
    await sortEnds(ada.client, first.id);
    second = await upload(ada.client, work.id, phrasings.slice(half), "september.json");
    await sortEnds(ada.client, second.id);
    const before = await ada.client.cards.list(work.id);
    check(before.length === key.skills.length, `with both uploads, Work has ${before.length} cards`);

    await page.goto(`${app.url}/app/projects/${work.id}?view=uploads`);
    await page.locator(".block table.rows").waitFor();
    const rows = await uploadRows();
    check(rows.map((r) => r.added).join(", ") === `${phrasings.length - half}, ${half}`, `newest first: ${rows.map((r) => `${r.messages} messages, ${r.added} new`).join("; ")}`);
    check((await text(".block .plate b")) === String(key.skills.length), `the plate counts ${await text(".block .plate b")} cards`);

    const remove = page.getByRole("button", { name: /^Delete the upload of / }).first();
    await remove.click();
    const confirm = page.locator(".block .confirm");
    await confirm.waitFor();
    const asked = (await confirm.textContent()) ?? "";
    check(asked.includes(`${phrasings.length - half} phrasings`) && asked.includes("fewer than two borrows") && asked.includes("can't be undone"), `the confirmation names what goes: "${asked}"`);
    check((await page.evaluate(() => document.activeElement?.textContent)) === "Keep it", "Keep it takes focus first");
    await page.getByRole("button", { name: "Keep it" }).click();
    await confirm.waitFor({ state: "detached" });
    check((await ada.client.uploads.list(work.id)).uploads.length === 2, "Keep it keeps the upload");

    await remove.click();
    await page.locator(".block .confirm").getByRole("button", { name: "Delete the upload" }).click();
    await page.locator(".block table.rows tbody tr").nth(1).waitFor({ state: "detached" });
    const left = await uploadRows();
    check(left.length === 1 && left[0]?.added === String(half), `the history lists only the first upload: ${JSON.stringify(left)}`);

    // The answer key says what stays: a card keeps the borrows of the first half, if it still has two.
    const inFirst = (ids: string[]) => ids.filter((id) => Number(id.slice(1)) <= half);
    const kept = key.skills.filter((skill) => inFirst(skill.messageIds).length >= 2);
    const lone = key.skills.flatMap((skill) => (inFirst(skill.messageIds).length === 1 ? inFirst(skill.messageIds) : []));
    check((await text(".block .plate b")) === String(kept.length), `the plate now counts ${await text(".block .plate b")} cards`);
    const keys = await marginKeys();
    check(keys.map((k) => `${k.skill} ${k.count}`).join(" | ") === kept.map((s) => `${s.name} ${inFirst(s.messageIds).length}`).join(" | "), `the margin's keys: ${keys.map((k) => `${k.letter} ${k.skill} ${k.count}`).join(" | ")}`);

    const gone = await failure(ada.client.uploads.get(second.id));
    check(gone?.status === 404, `the API has no second upload: ${say(gone)}`);
    const cards = await Promise.all((await ada.client.cards.list(work.id)).map((card) => ada.client.cards.get(card.id)));
    const got = cards.map((card) => `${card.skill}: ${idList(card.borrows.map((b) => named(b.sourceId)))}`);
    const want = kept.map((skill) => `${skill.name}: ${idList(inFirst(skill.messageIds))}`);
    check(got.join(" | ") === want.join(" | "), `the API's cards keep only the first half's borrows: ${got.join(" | ")}`);
    const unsorted = (await allUnsorted(ada.client, work.id)).map((p) => named(p.sourceId));
    const wantUnsorted = [...inFirst(key.oneOffs), ...lone];
    check(idList(unsorted) === idList(wantUnsorted), `a card left with one borrow is gone, its phrasing unsorted: [${idList(unsorted)}], the key says [${idList(wantUnsorted)}]`);
    const secondIds = new Set(phrasings.slice(half).map((p) => p.sourceId));
    const strays = [...cards.flatMap((card) => card.borrows.map((b) => b.sourceId)), ...(await allUnsorted(ada.client, work.id)).map((p) => p.sourceId)].filter((id) => secondIds.has(id));
    check(strays.length === 0, `none of the second upload's phrasings is left (${strays.length})`);
  });

  await step("7. Deleting an upload needs its owner's session: another account gets 404, an API key 403", async () => {
    const [first] = (await ada.client.uploads.list(work.id)).uploads;
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const theirs = await failure(bea.client.uploads.delete(first!.id));
    check(theirs?.status === 404, `Bea deleting Ada's upload: ${say(theirs)}`);
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    const script = createClient({ baseUrl: app.url, apiKey });
    const keyed = await failure(script.uploads.delete(first!.id));
    check(keyed?.status === 403, `an API key deleting it: ${say(keyed)}`);
    const again = await failure(ada.client.uploads.delete(second.id));
    check(again?.status === 404, `deleting the deleted one again: ${say(again)}`);
    check((await ada.client.uploads.list(work.id)).uploads.length === 1, "the first upload is still there");
  });

  await step("8. A project with no cards says why: nothing uploaded, a sort under way, or nothing asked twice yet", async () => {
    const empty = await ada.client.projects.create({ name: "Day job" });
    const at = `${app.url}/app/projects/${empty.id}`;
    const said = async () => {
      await page.goto(at);
      await page.locator(".block .empty").waitFor();
      return { heading: await text(".block h1"), title: await text(".block .empty h2"), body: await text(".block .empty p"), plate: await text(".block .plate b"), links: await page.locator(".block .empty a").allTextContents() };
    };
    let now = await said();
    check(now.heading === "Day job" && now.plate === "0" && now.title === "No cards yet" && now.links.join() === "Upload a chat export", `with no upload: ${JSON.stringify(now)}`);

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
    check((await page.locator(".block .empty a").getAttribute("href")) === `/app/projects/${empty.id}/upload?upload=${sorting.id}`, "and leads to the upload's own page, where the sort shows");
    held.release(reply({ joins: [], newSkills: [] }));
    await sortEnds(ada.client, sorting.id);
    now = await said();
    check(now.body.includes("asked more than once yet") && now.links.join() === "See the unsorted phrasings,Upload a chat export", `once nothing was asked twice: ${JSON.stringify(now)}`);
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
