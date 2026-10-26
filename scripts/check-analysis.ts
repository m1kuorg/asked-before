// Checks Analysis (app-notes/depth/plan.md, section 1) on a fresh copy of the
// app: the endpoint through the SDK, then the screen in a real browser, as a
// learner and as the guest, at 1440×900 and 390×844. The model is a stand-in:
// a sort ends as the demo export's answer key says, and a cold rep takes the
// verdicts a step queues.
//
// Through the SDK: a new account's analysis is empty; after the demo export
// is sorted, every count matches what this script works out on its own from
// the export's times and the key, in four time zones (one where a message
// crosses into the next month): the months, from the first to the last with
// the empty ones kept, add up to the totals; re-asks are the cards' asks less
// one each; the gaps, their median, middle half, and buckets, and each card's
// median gap. Cold reps, passed and failed, are counted by month, with the
// days from first ask to proof, and a proven card asked again since. The
// shelf filter counts one shelf, and all shelves are the shelves' sums. An
// unknown time zone is a 400 that doesn't repeat it, another account's shelf
// a 404, an API key reads the same answer, and no one logged out reads any.
//
// In the browser: the h1 is the answer's sentence; the grey line names the
// months, the shelves, and the zone; the months chart draws one pink cell per
// re-ask and one grey cell per other message, with every month in its table;
// each figure tab opens its view; the shelf filter counts one shelf without
// remounting the screen (the open tab stays open); the skills link to their
// cards, with one "Start a cold rep"; the page asks only for the analysis, in
// the browser's own zone, and its cards' asks, and never the model. Then the
// guest, with Demo data; a new account and a shelf with no messages; and a
// shelf that isn't yours. It prints counts and skill names, never phrasing
// text, and exits 1 if any check fails, naming the step.
// Run: bun run check:analysis [screenshot dir]

import { ApiError, createClient, type Analysis, type Client, type Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser as Chromium, type Locator, type Page } from "playwright";
import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { repReply, smallExport, sortsByKey, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-analysis");
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const DAY = 86_400_000;
const ZONE = "America/New_York";

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const also = new Map<string, string>();
const model = await startModelStub(sortsByKey(refuse(), also));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
let browser: Chromium | undefined;

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

const statusOf = (promise: Promise<unknown>) => promise.then(() => 200, (error) => (error instanceof ApiError ? error.status : 0));
const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();

// What the answer must say, worked out here from times alone, one message at a time, with Intl per message.

type Ask = { time: number; skill: string | null };

/** "2026-09", the month `ms` falls in, in `zone`. */
function monthIn(ms: number, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit" }).formatToParts(ms);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** The percentile p of sorted values, between the nearest ranks (type 7). */
function percentile(sorted: number[], p: number): number {
  const at = p * (sorted.length - 1);
  const low = sorted[Math.floor(at)]!;
  return low + (at - Math.floor(at)) * (sorted[Math.ceil(at)]! - low);
}
const days = (ms: number) => Math.round((ms / DAY) * 10) / 10;

function expected(asks: Ask[], zone: string) {
  const bySkill = Map.groupBy(asks.filter((ask) => ask.skill), (ask) => ask.skill!);
  const reask = new Set<Ask>();
  const gaps: number[] = [];
  const medianGap = new Map<string, number>();
  for (const [skill, list] of bySkill) {
    const sorted = [...list].sort((a, b) => a.time - b.time);
    sorted.slice(1).forEach((ask) => reask.add(ask));
    const own = sorted.slice(1).map((ask, i) => ask.time - sorted[i]!.time);
    gaps.push(...own);
    medianGap.set(skill, days(percentile([...own].sort((a, b) => a - b), 0.5)));
  }
  const months: Analysis["months"] = [];
  const first = monthIn(Math.min(...asks.map((a) => a.time)), zone);
  const last = monthIn(Math.max(...asks.map((a) => a.time)), zone);
  for (let month = first; ; month = nextMonth(month)) {
    const inMonth = asks.filter((ask) => monthIn(ask.time, zone) === month);
    months.push({ month, messages: inMonth.length, reasks: inMonth.filter((ask) => reask.has(ask)).length });
    if (month === last) break;
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const whole = (gap: number) => Math.floor(gap / DAY);
  return {
    messages: asks.length,
    onCards: asks.filter((ask) => ask.skill).length,
    cards: bySkill.size,
    reasks: reask.size,
    months,
    gaps: {
      count: gaps.length,
      medianDays: days(percentile(sortedGaps, 0.5)),
      middleHalf: { fromDays: days(percentile(sortedGaps, 0.25)), toDays: days(percentile(sortedGaps, 0.75)) },
      buckets: {
        underADay: gaps.filter((g) => whole(g) < 1).length,
        underAWeek: gaps.filter((g) => whole(g) >= 1 && whole(g) < 7).length,
        oneToFourWeeks: gaps.filter((g) => whole(g) >= 7 && whole(g) < 28).length,
        oneToThreeMonths: gaps.filter((g) => whole(g) >= 28 && whole(g) < 90).length,
        threeMonthsOrMore: gaps.filter((g) => whole(g) >= 90).length,
      },
    },
    medianGap,
  };
}

/** The demo export's phrasings, each with the key's skill or none. */
const skillOf = new Map(key.skills.flatMap((skill) => skill.messageIds.map((id) => [id, skill.name] as const)));
const demoAsks: Ask[] = phrasings.map((p, i) => ({ time: Date.parse(p.time), skill: skillOf.get(`m${i + 1}`) ?? null }));

/** The answer's months and reps months add up to its totals. */
function addsUp(answer: Analysis): boolean {
  const sum = (list: { [k: string]: unknown }[], field: string) => list.reduce((n, row) => n + (row[field] as number), 0);
  return (
    sum(answer.months, "messages") === answer.messages &&
    sum(answer.months, "reasks") === answer.reasks &&
    sum(answer.reps.months, "passed") === answer.reps.passed &&
    sum(answer.reps.months, "failed") === answer.reps.failed &&
    answer.onCards + answer.notOnACard === answer.messages
  );
}

const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
let bootcamp: Shelf;
let dayJob: Shelf;
/** Ada's asks, as they grow: the demo export, then a newer ask of a proven card, then two on Day job. */
const adaAsks: Ask[] = [...demoAsks];

try {
  await step("1. A new account's analysis is empty, and the time zone and shelf are checked", async () => {
    const empty = await ada.client.analysis.get({ timeZone: "UTC" });
    check(empty.messages === 0 && empty.reasks === 0 && empty.cards === 0 && !empty.months.length && !empty.skills.length && !empty.shelves.length, "no messages, months, skills, or shelves");
    check(empty.firstAskAt === null && empty.gaps.count === 0 && empty.gaps.medianDays === null && empty.reps.passed === 0 && empty.afterProof.proven === 0, "no first ask, gaps, reps, or proofs");
    check(empty.timeZone === "UTC" && empty.shelfId === null, `counted in ${empty.timeZone}, on every shelf`);
    for (const zone of ["Mars/Olympus_Mons", "x".repeat(200)]) {
      const refused = await ada.client.analysis.get({ timeZone: zone }).then(
        () => null,
        (error: unknown) => error,
      );
      check(refused instanceof ApiError && refused.status === 400 && !refused.message.includes(zone.slice(0, 20)), `an unknown zone is a 400 that doesn't repeat it: "${refused instanceof Error ? refused.message : refused}"`);
    }
    check((await statusOf(ada.client.analysis.get({ shelfId: "no-such-shelf" }))) === 404, "a shelf that isn't there is a 404");
    check((await statusOf(createClient({ baseUrl: app.url }).analysis.get())) === 401, "logged out, it's a 401");
  });

  await step("2. After the demo export is sorted, every count matches the export's times and the key, in four zones", async () => {
    bootcamp = await ada.client.shelves.create({ name: "Bootcamp" });
    const sorted = await sortEnds(ada.client, (await upload(ada.client, bootcamp.id, phrasings)).id);
    check(sorted.status === "sorted", `the demo export is sorted (${sorted.status})`);
    // Kiritimati is UTC+14: the ask on November 30 at 14:02 UTC is December 1 there.
    for (const zone of ["UTC", ZONE, "Pacific/Kiritimati", "Asia/Kolkata"]) {
      const got = await ada.client.analysis.get({ timeZone: zone });
      const want = expected(demoAsks, zone);
      check(got.timeZone === zone, `${zone}: counted in ${got.timeZone}`);
      check(got.messages === 27 && got.onCards === 20 && got.notOnACard === 7 && got.cards === 5 && got.reasks === 15, `${zone}: 27 messages, 20 on 5 cards, 7 not on a card, 15 re-asks`);
      check(got.reasks === got.skills.reduce((n, skill) => n + skill.count, 0) - got.cards, `${zone}: re-asks are the cards' asks less one each`);
      check(JSON.stringify(got.months) === JSON.stringify(want.months), `${zone}: ${got.months.length} months, ${got.months[0]?.month} to ${got.months.at(-1)?.month}, empty ones kept, each as counted one by one`);
      check(addsUp(got), `${zone}: the months add up to the totals`);
      check(JSON.stringify(got.gaps) === JSON.stringify({ count: want.gaps.count, medianDays: want.gaps.medianDays, middleHalf: want.gaps.middleHalf, buckets: want.gaps.buckets }), `${zone}: ${got.gaps.count} gaps, median ${got.gaps.medianDays} days, middle half ${got.gaps.middleHalf?.fromDays} to ${got.gaps.middleHalf?.toDays}`);
    }
    const got = await ada.client.analysis.get({ timeZone: "UTC" });
    const kiritimati = await ada.client.analysis.get({ timeZone: "Pacific/Kiritimati" });
    const nov = (a: Analysis) => a.months.find((m) => m.month === "2025-11")?.messages;
    check(nov(got) === 1 && nov(kiritimati) === 0, `the ask of November 30, 14:02 UTC is November's in UTC (${nov(got)}) and December's at UTC+14 (${nov(kiritimati)})`);
    const want = expected(demoAsks, "UTC");
    const desk = await ada.client.desk.get();
    check(
      JSON.stringify(got.skills.map(({ medianGapDays: _, ...card }) => card)) === JSON.stringify(desk.mostBorrowed),
      `the skills are the Desk's cards, most asked first: ${got.skills.map((s) => `${s.skill} ${s.count}`).join(", ")}`,
    );
    check(
      got.skills.every((skill) => skill.medianGapDays === want.medianGap.get(skill.skill)),
      `each with its own median gap: ${got.skills.map((s) => s.medianGapDays).join(", ")} days`,
    );
    check(JSON.stringify(got.shelves) === JSON.stringify([{ id: bootcamp.id, name: "Bootcamp", demo: false, messages: 27, reasks: 15, cards: 5 }]), "Bootcamp's own counts");
    check(Date.parse(got.firstAskAt!) === Date.parse(phrasings[0]!.time) && Date.parse(got.lastAskAt!) === Date.parse(phrasings.at(-1)!.time), `the first and last asks are the export's (${got.firstAskAt}, ${got.lastAskAt})`);
  });

  await step("3. Cold reps by month, from first ask to proof, and a proven card asked again since", async () => {
    const cards = await ada.client.cards.list(bootcamp.id);
    const named = (name: string) => cards.find((card) => card.skill === name)!;
    const [A, B, C, D] = key.skills.map((skill) => named(skill.name));
    for (const card of [B!, C!, D!]) {
      model.queue(repReply("A problem."), verdictReply("pass", "Done."));
      const { rep } = await ada.client.reps.start(card.id);
      await ada.client.reps.check(rep.id, { answer: "My answer." });
    }
    for (let i = 0; i < 2; i++) {
      model.queue(repReply("A problem."), verdictReply("fail", "Not quite."));
      const { rep } = await ada.client.reps.start(A!.id);
      await ada.client.reps.check(rep.id, { answer: "My answer." });
    }
    // An unanswered rep isn't counted.
    model.queue(repReply("A problem."));
    await ada.client.reps.start(A!.id);
    const proven = await ada.client.cards.list(bootcamp.id);
    const passedAt = (name: string) => Date.parse(proven.find((card) => card.skill === name)!.returnedAt!);

    // Card B, asked again after its proof.
    const newer = "vertically center a div inside a flex container";
    also.set(newer, key.skills[1]!.name);
    await Bun.sleep(20);
    const read = await smallExport([{ text: newer, time: new Date() }]);
    await sortEnds(ada.client, (await upload(ada.client, bootcamp.id, read.phrasings)).id);
    adaAsks.push({ time: Date.parse(read.phrasings[0]!.time), skill: key.skills[1]!.name });

    const got = await ada.client.analysis.get({ timeZone: "UTC" });
    const thisMonth = monthIn(Date.now(), "UTC");
    check(got.reps.passed === 3 && got.reps.failed === 2, `3 passed and 2 failed, the unanswered one left out (${got.reps.passed}, ${got.reps.failed})`);
    check(JSON.stringify(got.reps.months) === JSON.stringify([{ month: thisMonth, passed: 3, failed: 2 }]), `all in ${thisMonth}, when they were checked`);
    const toProof = key.skills.slice(1, 4).map((skill) => passedAt(skill.name) - Date.parse(proven.find((card) => card.skill === skill.name)!.firstBorrowAt)).sort((a, b) => a - b);
    check(got.reps.firstAskToProof.cards === 3 && got.reps.firstAskToProof.medianDays === days(toProof[1]!), `from first ask to proof: ${got.reps.firstAskToProof.medianDays} days, the median of 3 cards`);
    const nextAsk = Date.parse(read.phrasings[0]!.time) - passedAt(key.skills[1]!.name);
    check(
      JSON.stringify(got.afterProof) === JSON.stringify({ proven: 3, askedSince: 1, medianDaysToNextAsk: days(nextAsk) }),
      `3 proven, 1 asked since, ${got.afterProof.medianDaysToNextAsk} days after its proof (${JSON.stringify(got.afterProof)})`,
    );
    const want = expected(adaAsks, "UTC");
    check(got.reasks === 16 && JSON.stringify(got.months) === JSON.stringify(want.months) && addsUp(got), `the newer ask is a re-ask in its month, and the months still add up (${got.reasks} re-asks)`);
  });

  await step("4. The shelf filter counts one shelf, and all shelves are the shelves' sums", async () => {
    dayJob = await ada.client.shelves.create({ name: "Day job" });
    const now = Date.now();
    const recent = await smallExport([
      { text: "how do i squash my last three commits", time: new Date(now - 6 * DAY) },
      { text: "what does a 409 status code mean", time: new Date(now - DAY) },
    ]);
    await sortEnds(ada.client, (await upload(ada.client, dayJob.id, recent.phrasings)).id);
    adaAsks.push(...recent.phrasings.map((p) => ({ time: Date.parse(p.time), skill: null })));

    const all = await ada.client.analysis.get({ timeZone: ZONE });
    const one = await ada.client.analysis.get({ timeZone: ZONE, shelfId: dayJob.id });
    const camp = await ada.client.analysis.get({ timeZone: ZONE, shelfId: bootcamp.id });
    check(one.shelfId === dayJob.id && one.messages === 2 && one.reasks === 0 && one.cards === 0 && one.notOnACard === 2 && !one.skills.length && one.gaps.count === 0, "Day job: 2 messages, neither on a card");
    check(one.months.length >= 1 && addsUp(one) && one.reps.passed === 0, `Day job's months add up (${one.months.map((m) => `${m.month} ${m.messages}`).join(", ")})`);
    check(camp.messages === 28 && camp.reasks === 16 && camp.reps.passed === 3 && camp.afterProof.askedSince === 1, "Bootcamp: 28 messages, 16 re-asks, its reps");
    check(all.messages === one.messages + camp.messages && all.reasks === one.reasks + camp.reasks && all.cards === one.cards + camp.cards, "all shelves are the two added up");
    check(JSON.stringify(all.shelves) === JSON.stringify(one.shelves) && all.shelves.map((s) => `${s.name} ${s.messages} ${s.reasks} ${s.cards}`).join(", ") === "Bootcamp 28 16 5, Day job 2 0 0", `each answer lists every shelf with its own counts (${all.shelves.map((s) => `${s.name} ${s.messages}`).join(", ")})`);
    const want = expected(adaAsks, ZONE);
    check(JSON.stringify(all.months) === JSON.stringify(want.months) && addsUp(all), `all shelves' ${all.months.length} months, as counted one by one in ${ZONE}`);
  });

  await step("5. It's the account's own: an API key reads the same, another account sees none of it", async () => {
    const mine = await ada.client.analysis.get({ timeZone: "UTC" });
    const { key: apiKey } = await ada.client.keys.create({ name: "Script" });
    check(JSON.stringify(await createClient({ baseUrl: app.url, apiKey }).analysis.get({ timeZone: "UTC" })) === JSON.stringify(mine), "an API key reads the same answer as the session");
    const bea = app.browser();
    await bea.client.auth.signUp({ name: "Bea Example", email: "bea@example.com", password: "difference engine" });
    const hers = await bea.client.analysis.get({ timeZone: "UTC" });
    check(hers.messages === 0 && !hers.shelves.length && !hers.skills.length, "another account's analysis is empty");
    check((await statusOf(bea.client.analysis.get({ shelfId: bootcamp.id }))) === 404, "and Ada's shelf is a 404 to her");
  });

  browser = await chromium.launch();

  /** A page logged in as `learner`, in `zone`, watching its API calls and console errors. */
  async function pageFor(learner: Learner, frame: typeof WIDE, zone = ZONE) {
    const context = await browser!.newContext({ viewport: frame, deviceScaleFactor: 1, timezoneId: zone });
    const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
    await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const calls: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin === app.url && ["fetch", "xhr"].includes(request.resourceType())) calls.push(`${request.method()} ${url.pathname}${url.search}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    return { page, calls, errors, close: () => context.close() };
  }

  const monthName = (month: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const shoot = (page: Page, name: string) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  const sentence = (a: Analysis) => `${a.reasks} of your ${a.messages} messages asked something you'd asked before.`;

  await step("6. The learner's screen: the sentence, the months as cells, each view, the skills, and only the analysis asked for", async () => {
    const answer = await ada.client.analysis.get({ timeZone: ZONE });
    const { page, calls, errors, close } = await pageFor(ada, WIDE);
    const main = page.getByRole("main");
    const before = model.requests.length;
    await page.goto(`${app.url}/app/analysis`);
    const h1 = main.getByRole("heading", { level: 1 });
    await main.getByRole("heading", { level: 1, name: sentence(answer), exact: true }).waitFor();
    check(true, `headed "${await say(h1)}"`);
    const line = await say(h1.locator("xpath=following-sibling::p[1]"));
    const span = `${monthName(answer.months[0]!.month)} to ${monthName(answer.months.at(-1)!.month)}`;
    check(line === `${span}, on Bootcamp and Day job. Months are in America/New York time.`, `the grey line: "${line}"`);

    const chart = main.getByRole("img", { name: /^Your messages by month/ });
    await chart.waitFor();
    const pink = await chart.locator("rect.fill-ask").count();
    const grey = await chart.locator("rect.fill-edge").count();
    check(pink === answer.reasks && grey === answer.messages - answer.reasks, `one pink cell per re-ask (${pink}) and one grey per other message (${grey})`);
    const side = Number(await chart.locator("rect.fill-ask").first().getAttribute("width"));
    check(side >= 20, `with at most ${Math.max(...answer.months.map((m) => m.messages))} a month, the squares take the room they have (${side}px)`);
    await main.locator("summary", { hasText: "Every month in numbers" }).click();
    const rows = await main.getByRole("table", { name: "Every month in numbers" }).locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent).join(" ")));
    check(JSON.stringify(rows) === JSON.stringify(answer.months.map((m) => `${monthName(m.month)} ${m.messages} ${m.reasks}`)), `its table holds every month, ${rows.length} rows`);
    await shoot(page, "learner-1440-months");

    const tab = (name: string) => main.getByRole("tab", { name: new RegExp(`^${name}`) });
    await tab("Until you asked again").click();
    await main.getByRole("heading", { level: 2, name: "How long until you asked again", exact: true }).waitFor();
    const buckets = await main.getByRole("list", { name: "Gaps by how long they ran" }).getByRole("listitem").allTextContents();
    const b = answer.gaps.buckets;
    check(
      buckets.map((t) => t.replace(/\s+gaps?$/, "")).join("|") === `Within a day${b.underADay}|Under a week${b.underAWeek}|1 to 4 weeks${b.oneToFourWeeks}|1 to 3 months${b.oneToThreeMonths}|3 months or more${b.threeMonthsOrMore}`,
      `the gaps view lists the buckets: ${buckets.join(", ")}`,
    );
    await shoot(page, "learner-1440-gaps");
    await tab("Cold reps passed").click();
    await main.getByRole("heading", { level: 2, name: "Cold reps, passed and not yet", exact: true }).waitFor();
    const tally = await main.getByRole("list", { name: "Cold reps checked" }).getByRole("listitem").allTextContents();
    check(tally.join(", ") === "Passed3, Not yet2", `the reps view says what too few to chart says, in its pills: ${tally.join(", ")}`);
    await shoot(page, "learner-1440-reps");
    await tab("Asked since proven").click();
    await main.getByRole("heading", { level: 2, name: "Proven, then asked again", exact: true }).waitFor();
    check(await main.getByRole("img", { name: "3 proven cards: 2 not asked since, 1 asked since proven" }).isVisible(), "the proven view splits 3 proven cards, 2 and 1");
    await shoot(page, "learner-1440-proven");

    // The filter counts one shelf in place: the open tab stays open, so the screen wasn't remounted.
    await tab("Until you asked again").click();
    const filter = main.getByRole("group", { name: "Shelves counted" });
    const offered = (await filter.getByRole("button").allTextContents()).map((text) => text.replace(/\s+/g, " ").replace(/([^\d\s])(\d)/, "$1 $2").trim());
    check(offered.join(", ") === "All shelves 30, Bootcamp 28, Day job 2", `the filter offers every shelf with its messages: ${offered.join(", ")}`);
    await filter.getByRole("button", { name: /^Day job/ }).click();
    await main.getByRole("heading", { level: 1, name: "None of your 2 messages asked something you'd asked before.", exact: true }).waitFor();
    check(new URL(page.url()).search === `?shelf=${dayJob.id}` && new URL(page.url()).hash === "#gaps", `choosing Day job puts it in the address, the open view kept in the hash (${new URL(page.url()).search}${new URL(page.url()).hash})`);
    const told = await main.getByRole("status").filter({ hasText: /asked/ }).first().textContent();
    check(told === "None of your 2 messages asked something you'd asked before.", `and a screen reader hears the new sentence: "${told}"`);
    check((await tab("Until you asked again").getAttribute("aria-selected")) === "true", "and the open tab stays open: the screen redrew in place");
    await filter.getByRole("button", { name: /^All shelves/ }).click();
    await main.getByRole("heading", { level: 1, name: sentence(answer), exact: true }).waitFor();
    check(new URL(page.url()).search === "", "All shelves takes it out again");
    // A view can be linked to: its hash opens it.
    await page.goto(`${app.url}/app/analysis#reps`);
    await main.getByRole("heading", { level: 2, name: "Cold reps, passed and not yet", exact: true }).waitFor();
    check((await tab("Cold reps passed").getAttribute("aria-selected")) === "true", "/app/analysis#reps opens the cold reps view");
    await tab("Asked before").click();
    check(new URL(page.url()).hash === "", "and the first view takes the hash away");

    const skills = main.getByRole("list", { name: "Your most asked cards, most asked first" });
    const links = await skills.getByRole("link").evaluateAll((all) => all.map((a) => `${a.textContent} ${a.getAttribute("href")}`));
    check(JSON.stringify(links) === JSON.stringify(answer.skills.map((s) => `${s.skill} /app/cards/${s.id}`)), `the skills link to their cards, most asked first: ${answer.skills.map((s) => s.skill).join(", ")}`);
    const next = answer.skills.find((s) => s.status !== "returned")!;
    const start = main.getByRole("link", { name: `Start a cold rep on ${next.skill}`, exact: true });
    check((await start.count()) === 1 && (await start.getAttribute("href")) === `/app/cards/${next.id}?rep=start`, `one "Start a cold rep", on ${next.skill}`);

    await page.waitForLoadState("networkidle");
    const analysisCalls = calls.filter((call) => call.startsWith("GET /api/v1/analysis"));
    check(analysisCalls.every((call) => call.includes(`timeZone=${encodeURIComponent(ZONE)}`)), `every analysis request is in the browser's zone (${analysisCalls.length})`);
    const others = calls.filter((call) => !call.startsWith("GET /api/v1/analysis") && !/^GET \/api\/v1\/(auth\/me|desk|shelves|cards\/[^/?]+)$/.test(call));
    check(others.length === 0, `it asks for nothing but the analysis, the sidebar's shelves and count, and its cards' asks${others.length ? `: ${others.join(", ")}` : ""}`);
    check(model.requests.length === before, `and no model request (${model.requests.length - before})`);
    check(errors.length === 0, `no console errors or policy violations${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await close();

    const phone = await pageFor(ada, PHONE);
    await phone.page.goto(`${app.url}/app/analysis`);
    await phone.page.getByRole("main").getByRole("heading", { level: 1, name: sentence(answer), exact: true }).waitFor();
    await phone.page.getByRole("main").getByRole("img", { name: /^Your messages by month/ }).waitFor();
    const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `at 390 wide, nothing pushes the page sideways (${overflow}px)`);
    await shoot(phone.page, "learner-390");
    await phone.close();
  });

  await step("7. A time zone the server doesn't know falls back to UTC, and the grey line says so", async () => {
    const answer = await ada.client.analysis.get({ timeZone: "UTC" });
    const { page, calls, errors, close } = await pageFor(ada, WIDE);
    // The server refuses the browser's zone, as it would a legacy alias it doesn't know.
    await page.route(
      (url) => url.pathname === "/api/v1/analysis" && url.searchParams.get("timeZone") === ZONE,
      (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "timeZone isn't a time zone the server knows. Send an IANA name, such as Europe/Berlin." }) }),
    );
    const main = page.getByRole("main");
    await page.goto(`${app.url}/app/analysis`);
    await main.getByRole("heading", { level: 1, name: sentence(answer), exact: true }).waitFor();
    const line = await say(main.getByRole("heading", { level: 1 }).locator("xpath=following-sibling::p[1]"));
    check(line.endsWith("Months are in UTC, since your browser's time zone wasn't recognized."), `the screen asks again in UTC and says so: "${line}"`);
    await main.getByRole("group", { name: "Shelves counted" }).getByRole("button", { name: /^Day job/ }).click();
    await main.getByRole("heading", { level: 1, name: "None of your 2 messages asked something you'd asked before.", exact: true }).waitFor();
    const asked = calls.filter((call) => call.startsWith("GET /api/v1/analysis")).map((call) => new URL(call.split(" ")[1]!, app.url).searchParams.get("timeZone"));
    check(asked.join(", ") === `${ZONE}, UTC, UTC`, `the zone is tried once, then UTC, also for the next shelf (${asked.join(", ")})`);
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await close();
  });

  await step("8. The guest sees the shared demo workspace, labeled Demo data", async () => {
    const guest = app.browser();
    await guest.client.auth.signInAsGuest();
    const answer = await guest.client.analysis.get({ timeZone: "UTC" });
    check(answer.messages === 27 && answer.reasks === 15 && answer.cards === 5 && answer.shelves.every((s) => s.demo), `the guest's demo shelf: ${answer.messages} messages, ${answer.reasks} re-asks, on a demo shelf`);
    for (const frame of [WIDE, PHONE]) {
      const { page, errors, close } = await pageFor(guest, frame, "UTC");
      const main = page.getByRole("main");
      await page.goto(`${app.url}/app/analysis`);
      await main.getByRole("heading", { level: 1, name: sentence(answer), exact: true }).waitFor();
      const line = main.getByRole("heading", { level: 1 }).locator("xpath=following-sibling::p[1]");
      check((await say(line)).includes("Demo data"), `${frame.width}: the grey line says Demo data: "${await say(line)}"`);
      check((await main.getByRole("group", { name: "Shelves counted" }).count()) === 0, `${frame.width}: with one shelf, there's no filter`);
      await main.getByRole("img", { name: /^Your messages by month/ }).waitFor();
      check(errors.length === 0, `${frame.width}: no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
      await shoot(page, `guest-${frame.width}`);
      await close();
    }
  });

  await step("9. With nothing to count, the screen says so and what to do; a shelf that isn't yours says that", async () => {
    const cy = app.browser();
    await cy.client.auth.signUp({ name: "Cy Example", email: "cy@example.com", password: "analytical engine" });
    const first = await pageFor(cy, WIDE);
    let main = first.page.getByRole("main");
    await first.page.goto(`${app.url}/app/analysis`);
    await main.getByRole("heading", { level: 1, name: "No messages yet.", exact: true }).waitFor();
    check(await main.getByRole("button", { name: "Try the demo shelf", exact: true }).isVisible(), 'a new account: "No messages yet.", with the demo shelf to try');
    await shoot(first.page, "empty-first-visit");

    await cy.client.shelves.create({ name: "Work" });
    await first.page.reload();
    await main.getByRole("heading", { level: 1, name: "No messages yet.", exact: true }).waitFor();
    check(await main.getByRole("link", { name: "Go to your shelves", exact: true }).isVisible(), 'a shelf with no messages: "No messages yet.", and the way to the shelves');
    await shoot(first.page, "empty-shelf");

    await first.page.goto(`${app.url}/app/analysis?shelf=${bootcamp.id}`);
    main = first.page.getByRole("main");
    await main.getByRole("alert").waitFor();
    check((await say(main.getByRole("alert"))) === "There's no such shelf." && (await main.getByRole("link", { name: "Count every shelf", exact: true }).isVisible()), `another account's shelf: "${await say(main.getByRole("alert"))}", and a way back`);
    check(first.errors.length === 0, `no console errors${first.errors.length ? `: ${first.errors.slice(0, 3).join(" | ")}` : ""}`);
    await first.close();
  });
} finally {
  await browser?.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
