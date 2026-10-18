// Checks the dashboard (m1kuorg/basics#47) on a fresh copy of the app:
// first the dashboard endpoint through the SDK, then the page in a real
// browser at 1920×1080. The app's model is a stand-in in this script: a
// sort ends as the demo export's answer key says, and a cold rep takes the
// answers a step queues. Through the SDK: a new account's dashboard is
// empty; after the demo export is sorted it holds the key's cards, most
// borrowed first, and the latest borrows as the key dates them; a passed
// cold rep lists that return, and a newer borrow makes the card borrowed
// again; its totals always equal the projects' own counts added up; an API
// key reads it, and another account sees none of it. In the browser: a new
// account sees the empty state, whose demo action leads to a sorted demo
// project, and whose first-upload field makes a project and goes to its
// upload page; then the top card's skill opens its page asking the model
// nothing, while the dashboard's own cold rep link shows the rep's problem
// in one click and leaves no start in the address, so going back and forward
// asks nothing either; that rep, passed, shows on the dashboard as a
// return, with totals that match the
// projects' counts, the rows and the rail as the API lists them, stamps in
// the learner's own time zone, and one request to /api/v1/dashboard.
// It prints ids, counts, and skill names, never phrasing text, and exits 1
// if any check fails, naming the step.
// Run: bun run check:dashboard [screenshot dir]

import { ApiError, createClient, type Client, type Dashboard, type Project } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { compareWithKey, key, named, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { kindOf, repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-dashboard");
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
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
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

const text = async (page: Page, selector: string) => ((await page.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
/** A section's words without its heading. */
const body = async (page: Page, selector: string) => (await page.locator(`${selector} p`).allTextContents()).join(" ");
const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const zero = (totals: Dashboard["totals"]) => totals.cards === 0 && totals.borrowed === 0 && totals.returned === 0 && totals.borrowedAgain === 0;

/** The projects' own counts, added up through projects.list: what the dashboard's totals must equal. */
async function projectSums(client: Client): Promise<Dashboard["totals"]> {
  const sums = { cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 };
  for (const { counts } of await client.projects.list()) {
    for (const name of Object.keys(sums) as (keyof typeof sums)[]) sums[name] += counts[name];
  }
  return sums;
}

const sameTotals = (a: Dashboard["totals"], b: Dashboard["totals"]) => JSON.stringify(a) === JSON.stringify(b);

/** The key's phrasings on a card, newest first by their own time, as names such as "m27". */
const keyedByTime = () =>
  key.skills
    .flatMap((skill) => skill.messageIds.map((id) => ({ id, skill: skill.name, time: Date.parse(phrasings[Number(id.slice(1)) - 1]!.time) })))
    .sort((a, b) => b.time - a.time);

let demo: Project;
let work: Project;

try {
  await step("1. A new account's dashboard is empty", async () => {
    const dashboard = await ada.client.dashboard.get();
    check(dashboard.projects === 0, `no projects (${dashboard.projects})`);
    check(zero(dashboard.totals), `every total is 0 (${JSON.stringify(dashboard.totals)})`);
    check(dashboard.mostBorrowed.length === 0 && dashboard.latestBorrows.length === 0 && dashboard.latestReturns.length === 0, "no cards, borrows, or returns");
  });

  await step("2. After the demo export is sorted, the dashboard has the key's cards, its latest borrows, and the projects' totals", async () => {
    demo = await ada.client.projects.create({ name: "Demo", demo: true });
    work = await ada.client.projects.create({ name: "Work" });
    const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
    check(sorted.status === "sorted", `the demo export is sorted (${sorted.status})`);
    const dashboard = await ada.client.dashboard.get();
    check(dashboard.projects === 2, `two projects (${dashboard.projects})`);
    const sums = await projectSums(ada.client);
    check(sameTotals(dashboard.totals, sums), `the totals ${JSON.stringify(dashboard.totals)} are the projects' counts added up ${JSON.stringify(sums)}`);
    check(dashboard.totals.cards === key.skills.length && dashboard.totals.borrowed === key.skills.length, `${key.skills.length} cards, all borrowed`);
    const most = dashboard.mostBorrowed.map((card) => `${card.skill} ${card.count}`);
    const want = key.skills.map((skill) => `${skill.name} ${skill.count}`);
    check(most.join() === want.join(), `most borrowed first, ties to the later last borrow, as the key orders them: ${most.join(", ")}`);
    check(dashboard.mostBorrowed.every((card) => card.project.id === demo.id && card.project.name === "Demo" && card.project.demo && card.status === "borrowed"), "each names its project, a demo project, and is borrowed");
    const latest = dashboard.latestBorrows.map((borrow) => named(borrow.sourceId));
    const wantLatest = keyedByTime().slice(0, 10);
    check(latest.join() === wantLatest.map((b) => b.id).join(), `the 10 latest borrows, newest first, as the key dates them: ${latest.join(" ")}`);
    check(
      dashboard.latestBorrows.every((borrow, i) => borrow.card.skill === wantLatest[i]?.skill && borrow.text === phrasings[Number(wantLatest[i]!.id.slice(1)) - 1]!.text && borrow.project.id === demo.id),
      "each is the export's phrasing word for word, on the key's card, in the demo project",
    );
    check(dashboard.latestReturns.length === 0, "nothing is returned yet");
  });

  await step("3. After one returned card, the dashboard lists that return, and its totals match the projects' counts", async () => {
    const [cardA] = await ada.client.cards.list(demo.id);
    model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
    const { rep } = await ada.client.reps.start(cardA!.id);
    const checked = await ada.client.reps.check(rep.id, { answer: "My own answer." });
    check(checked.card.status === "returned", `card A passed its cold rep and is ${checked.card.status}`);
    const dashboard = await ada.client.dashboard.get();
    const [returned, ...others] = dashboard.latestReturns;
    check(others.length === 0 && returned?.id === cardA!.id && returned.status === "returned", `the latest returns hold card A alone (${dashboard.latestReturns.map((c) => c.skill).join(", ")})`);
    check(returned?.returnedAt === checked.rep.checkedAt, `stamped when its rep passed (${returned?.returnedAt})`);
    check(!dashboard.mostBorrowed.some((card) => card.id === cardA!.id) && dashboard.mostBorrowed[0]?.skill === key.skills[1]!.name, `card A leaves the most borrowed, which card B now heads (${dashboard.mostBorrowed[0]?.skill})`);
    const sums = await projectSums(ada.client);
    check(sameTotals(dashboard.totals, sums) && dashboard.totals.returned === 1 && dashboard.totals.borrowed === key.skills.length - 1, `the totals ${JSON.stringify(dashboard.totals)} are the projects' counts added up ${JSON.stringify(sums)}`);
  });

  await step("4. A card borrowed again stays on the most borrowed, its newer borrow leads the latest, and its stamp stays with the returns", async () => {
    const [cardA] = await ada.client.cards.list(demo.id);
    const newer = "how do i take back my last commit before pushing";
    also.set(newer, key.skills[0]!.name);
    const read = await smallExport([{ text: newer, time: new Date(Date.parse(cardA!.returnedAt!) + 1000) }]);
    const made = await ada.client.uploads.create(demo.id, { source: read.source, fileName: "conversations.json" });
    await ada.client.uploads.append(made.id, read.phrasings);
    await sortEnds(ada.client, (await ada.client.uploads.finish(made.id)).id);
    const dashboard = await ada.client.dashboard.get();
    const again = dashboard.mostBorrowed.find((card) => card.id === cardA!.id);
    check(again?.status === "borrowed_again" && again.count === key.skills[0]!.count + 1 && dashboard.mostBorrowed[0]?.id === cardA!.id, `card A is borrowed again, with ${again?.count} borrows, at the head of the most borrowed`);
    check(dashboard.latestBorrows[0]?.text === newer && dashboard.latestBorrows[0]?.card.id === cardA!.id && dashboard.latestBorrows[0]?.card.status === "borrowed_again", "its newer borrow leads the latest borrows");
    check(dashboard.latestReturns[0]?.id === cardA!.id && dashboard.latestReturns[0]?.status === "borrowed_again" && dashboard.latestReturns[0]?.returnedAt === cardA!.returnedAt, "its return stamp stays on the latest returns, saying it's borrowed again");
    const sums = await projectSums(ada.client);
    check(sameTotals(dashboard.totals, sums) && dashboard.totals.borrowedAgain === 1 && dashboard.totals.returned === 0, `the totals ${JSON.stringify(dashboard.totals)} are the projects' counts added up ${JSON.stringify(sums)}`);
  });

  await step("5. The dashboard is the account's own: an API key reads it, another account sees none of it, and no one logged out does", async () => {
    const mine = await ada.client.dashboard.get();
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    const viaKey = await createClient({ baseUrl: app.url, apiKey }).dashboard.get();
    check(JSON.stringify(viaKey) === JSON.stringify(mine), "an API key reads the same dashboard as the session");
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const hers = await bea.client.dashboard.get();
    check(hers.projects === 0 && zero(hers.totals) && !hers.mostBorrowed.length && !hers.latestBorrows.length && !hers.latestReturns.length, "another account's dashboard is empty");
    const status = await createClient({ baseUrl: app.url }).dashboard.get().then(() => 200, (error) => (error instanceof ApiError ? error.status : 0));
    check(status === 401, `logged out, it's a 401 (${status})`);
  });

  let cy: Watched | undefined;
  await step(
    "6. A new account sees the empty state, and its demo action leads to a sorted demo project",
    async () => {
      cy = await learnerPage("Cy Example", "cy@example.com");
      const { page, learner } = cy;
      await page.goto(`${app.url}/app`);
      const empty = page.locator(".block .empty");
      await empty.waitFor();
      check((await text(page, ".block h1")) === "Still borrowed" && (await text(page, ".block .plate b")) === "0", `headed "${await text(page, ".block h1")}", over a plate of ${await text(page, ".block .plate b")}`);
      check((await text(page, ".block .empty h2")) === "No cards yet", `the empty state says "${await text(page, ".block .empty h2")}"`);
      check(await empty.getByRole("button", { name: "Try the demo project" }).isVisible(), "it offers the demo project");
      check(await page.locator(".block").getByLabel("Or name your first project").isVisible(), "and a first project to upload into");
      await page.screenshot({ path: join(OUT, `${++shot}-empty-state.png`) });

      await empty.getByRole("button", { name: "Try the demo project" }).click();
      await page.waitForURL(/\/app\/projects\/[^/]+\/upload\?/);
      const [made] = await learner.client.projects.list();
      check(made?.demo === true, `it made "${made?.name}", flagged demo: ${made?.demo}`);
      await page.getByText("They're sorted into Demo's cards.").waitFor({ timeout: 30_000 });
      const compared = await compareWithKey(learner.client, made!.id);
      console.log(compared.lines.join("\n"));
      check(compared.problems.length === 0, `the demo project is sorted as the key says${compared.problems.length ? `: ${compared.problems.join("; ")}` : ""}`);
      await page.getByRole("link", { name: "Go to Demo" }).click();
      await page.locator(".block .rail").first().waitFor();
      check((await text(page, ".block h1.skill")) === key.skills[0]!.name, `and its stack opens on card A, "${await text(page, ".block h1.skill")}"`);
    },
    () => cy?.page,
  );

  let dee: Watched | undefined;
  await step(
    "7. The empty state's first upload names a project and goes to its upload page",
    async () => {
      dee = await learnerPage("Dee Example", "dee@example.com");
      const { page, learner } = dee;
      await page.goto(`${app.url}/app`);
      const first = page.locator(".block").getByLabel("Or name your first project");
      await first.waitFor();
      await page.locator(".block").getByRole("button", { name: "Upload a chat export" }).click();
      await page.locator(".block .first-project .error").waitFor();
      check((await text(page, ".block .first-project .error")) === "A project needs a name.", `with no name, it says "${await text(page, ".block .first-project .error")}"`);
      await first.fill("Bootcamp");
      await page.locator(".block").getByRole("button", { name: "Upload a chat export" }).click();
      await page.locator(".drop-zone").waitFor();
      const [made] = await learner.client.projects.list();
      check(made?.name === "Bootcamp" && !made.demo, `it made "${made?.name}"`);
      check(new URL(page.url()).pathname === `/app/projects/${made!.id}/upload`, `and went to its upload page (${new URL(page.url()).pathname})`);
    },
    () => dee?.page,
  );

  await step(
    "8. After one returned card, the dashboard page lists that return, and its totals match the projects' counts",
    async () => {
      const { page, learner, apiCalls, errors } = cy!;
      const [cardA] = await learner.client.cards.list((await learner.client.projects.list())[0]!.id);
      const cardAt = `${app.url}/app/cards/${cardA!.id}`;
      const takeOffered = page.locator(".block").getByRole("button", { name: "Take a cold rep" });
      await page.goto(`${app.url}/app`);
      const take = page.locator(".block").getByRole("link", { name: `Take a cold rep on ${key.skills[0]!.name}` });
      await take.waitFor();

      // A plain visit, by the card's skill in the rows, opens the card and asks the model nothing.
      let before = model.requests.length;
      await page.locator(".block table.rows").first().getByRole("link", { name: key.skills[0]!.name, exact: true }).click();
      await takeOffered.waitFor();
      check(page.url() === cardAt && model.requests.length === before && (await learner.client.cards.get(cardA!.id)).reps.length === 0, `the skill's link opens the card, offering a cold rep, with ${model.requests.length - before} model requests and no rep`);

      // The dashboard's action starts the rep in one click: the card page, with its problem showing.
      await page.goBack();
      await take.waitFor();
      model.queue(repReply("A problem of the card's skill.", "The card's lesson."), verdictReply("pass", "You did it."));
      before = model.requests.length;
      await take.click();
      await page.locator(".block .problem").waitFor();
      const started = model.requests.slice(before).map(kindOf);
      check(started.join() === "rep" && (await learner.client.cards.get(cardA!.id)).reps.length === 1, `one click on "Take a cold rep on ${key.skills[0]!.name}" shows the rep's problem, after one model request (${started.join(", ")})`);
      check((await body(page, ".block .problem")) === "A problem of the card's skill." && (await takeOffered.count()) === 0, "the problem is the rep's, with no second Take a cold rep to click");
      check(page.url() === cardAt, `the address keeps no start, so going back or reloading starts nothing (${new URL(page.url()).pathname}${new URL(page.url()).search})`);
      await page.locator(".answer-box textarea").fill("My own answer.");
      await page.getByRole("button", { name: "Check my answer" }).click();
      await page.getByRole("button", { name: "Back to the stack" }).waitFor();

      // Back to the dashboard and forward again opens the returned card, and asks the model nothing.
      before = model.requests.length;
      await page.goBack();
      await page.locator(".block .latest-returns table.rows").waitFor();
      await page.goForward();
      await takeOffered.waitFor();
      check(page.url() === cardAt && model.requests.length === before && (await learner.client.cards.get(cardA!.id)).reps.length === 1, `back, then forward, opens the card with ${model.requests.length - before} model requests, still one rep`);

      apiCalls.length = 0;
      await page.goto(`${app.url}/app`);
      await page.locator(".block .latest-returns table.rows").waitFor();
      const dashboard = await learner.client.dashboard.get();
      const sums = await projectSums(learner.client);
      check(dashboard.latestReturns.length === 1 && dashboard.latestReturns[0]!.skill === key.skills[0]!.name, `the API lists card A's return (${dashboard.latestReturns.map((c) => c.skill).join(", ")})`);

      const returned = await page.locator(".block .latest-returns tbody tr").evaluateAll((all) => all.map((row) => [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim())));
      const stampedOn = utcDate(dashboard.latestReturns[0]!.returnedAt!);
      check(returned.length === 1 && returned[0]![0] === key.skills[0]!.name && returned[0]![1] === "DemoDemo data" && returned[0]![2] === stampedOn, `the page lists that return: ${JSON.stringify(returned)}, stamped ${stampedOn}`);
      const strike = await page.locator(".block .latest-returns tbody .is-struck").evaluateAll((all) => all.map((skill) => getComputedStyle(skill).textDecoration));
      check(strike.length === 1 && strike[0]!.includes("line-through") && strike[0]!.includes("2px"), `its skill is struck with the 2px line, as its margin key is (${strike.join(", ")})`);

      const ledger = await page.locator(".margin .ledger > div").evaluateAll((all) => all.map((line) => `${line.querySelector("dt")?.textContent} ${line.querySelector("dd")?.textContent}`));
      const want = [`Borrowed ${sums.borrowed}`, `Borrowed again ${sums.borrowedAgain}`, `Returned ${sums.returned}`, `All cards ${sums.cards}`];
      check(ledger.join() === want.join(), `the margin's totals (${ledger.join(", ")}) match the projects' counts added up (${want.join(", ")})`);
      const plateCount = await text(page, ".block .plate b");
      check(plateCount === String(sums.borrowed + sums.borrowedAgain), `the plate counts ${plateCount} cards borrowed, not returned`);

      const most = await page.locator(".block table.rows").first().locator("tbody tr").evaluateAll((all) => all.map((row) => [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim())));
      const wantMost = dashboard.mostBorrowed.map((card) => [card.skill, "DemoDemo data", String(card.count), utcDate(card.lastBorrowAt)]);
      check(JSON.stringify(most) === JSON.stringify(wantMost), `the rows are the API's most borrowed, in order: ${most.map((r) => `${r[0]} ${r[2]}`).join(", ")}`);
      const skills = await page.locator(".block table.rows").first().locator("tbody tr a").first().getAttribute("href");
      check(skills === `/app/cards/${dashboard.mostBorrowed[0]!.id}`, `a card's skill leads to its page (${skills})`);
      check((await text(page, ".block .take-rep")) === `Take a cold rep on ${dashboard.mostBorrowed[0]!.skill}`, `the block's action is "${await text(page, ".block .take-rep")}"`);

      const rail = await page.locator(".block .latest-borrows .rail > li").evaluateAll((all) =>
        all.map((li) => ({ text: li.querySelector(".phrasing")?.textContent ?? "", date: li.querySelector(".stamp time")?.textContent ?? "", skill: li.querySelector(".stamp a")?.textContent ?? "", key: li.querySelector(".rail-key") !== null })),
      );
      const wantRail = dashboard.latestBorrows.map((borrow) => ({ text: borrow.text, date: utcDate(borrow.time), skill: borrow.card.skill, key: true }));
      check(JSON.stringify(rail) === JSON.stringify(wantRail), `the rail holds the ${rail.length} latest borrows, newest first, each with its key, stamp, and card`);
      const years = await page.locator(".block .latest-borrows .rail").evaluateAll((all) => all.map((r) => r.getAttribute("aria-label")));
      check(years.join() === "Borrowed in 2026, newest first,Borrowed in 2025, newest first", `cut where the year turns: ${years.join(" | ")}`);
      check((await page.evaluate(() => document.getAnimations().length)) === 0, "its keys are already seated, with no drop");

      const calls = apiCalls.filter((call) => call !== "GET /api/v1/auth/me");
      check(calls.join() === "GET /api/v1/dashboard", `the page asks only the dashboard endpoint (${calls.join(", ")})`);
      check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    },
    () => cy?.page,
  );

  await step(
    "9. The dashboard in another time zone stamps dates in the learner's own",
    async () => {
      const { learner } = cy!;
      const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "Pacific/Kiritimati" });
      const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
      await context.addCookies(cookies.map(([cookie, value]) => ({ name: cookie!, value: value!, url: app.url })));
      const page = await context.newPage();
      await page.goto(`${app.url}/app`);
      await page.locator(".block .latest-borrows .rail").first().waitFor();
      const dashboard = await learner.client.dashboard.get();
      const local = (iso: string) => new Date(Date.parse(iso) + 14 * 3_600_000).toISOString().slice(0, 10);
      const dates = await page.locator(".block .latest-borrows .stamp time").evaluateAll((all) => all.map((t) => t.textContent));
      check(dates.join() === dashboard.latestBorrows.map((b) => local(b.time)).join(), `the rail's stamps are dates at UTC+14 (${dates.slice(0, 3).join(", ")}, …)`);
      await context.close();
    },
  );
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
