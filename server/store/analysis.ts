// Analysis, as the store counts it (app-notes/depth/plan.md, section 1): one
// account's phrasings, cards, and cold reps, on every shelf or one, counted
// in SQL. Each card's borrows are ordered by time (ties by id) with window
// functions: the first is its first ask, every later one a re-ask, and LAG()
// gives the gap since the one before. Medians and quartiles are read off the
// ranked gaps in SQL, so only the few rows at those ranks come back.
//
// Months are the learner's own, in the time zone asked for. The JavaScript
// works out the UTC instant each local month starts, once per month of the
// range, with Intl and the zone's offset on that day; SQL then joins each
// phrasing to the month whose start it is at or after. No row is read into
// JavaScript to be counted, so the CPU a request spends doesn't grow with the
// history, only with its months: on 8,000 phrasings over 20 months, about
// 0.14 ms of JavaScript a request (server/api/analysis.ts says how it was measured).
//
// Two reads: the range first (the first and last phrasing and checked rep),
// for the months; then everything in one batch, the range again among it. A
// sort or a rep landing between the two moves the range, and the batch is
// read again, so the months always add up to the totals beside them.

import type { Analysis, AnalysisRepMonth, AnalysisShelf, AnalysisSkill } from "@asked-before/sdk";
import type { CardRow } from "./cards";
import { iso, type Db } from "./db";
import { CARDS, shelfOf, toDeskCard, type ShelfColumns } from "./desk";
import { ownsShelf } from "./shelves";

const DAY = 86_400_000;
/** The gap buckets' lower ends after the first, in days: a week, four weeks, 90 days. */
const WEEK = 7 * DAY;
const FOUR_WEEKS = 28 * DAY;
const QUARTER = 90 * DAY;

/** The cards listed under skills. */
const SKILLS = 10;
/** How many times the batch is read again when the range moved under it. */
const TRIES = 3;

/** The account's (?1) phrasings, on the shelf ?2 or on all of them, each with its rank on its card (nth, from 1) and the gap since the card's one before. */
const ASKS = `
  asks AS MATERIALIZED (
    SELECT p.time, p.card_id,
      CASE WHEN p.card_id IS NOT NULL THEN ROW_NUMBER() OVER w END AS nth,
      CASE WHEN p.card_id IS NOT NULL THEN p.time - LAG(p.time) OVER w END AS gap
    FROM phrasings p JOIN shelves sh ON sh.id = p.shelf_id
    WHERE sh.user_id = ?1 AND (?2 IS NULL OR p.shelf_id = ?2)
    WINDOW w AS (PARTITION BY p.card_id ORDER BY p.time, p.id)
  )`;

/** The account's checked cold reps, on the shelf ?2 or every shelf: add a SELECT list before it. */
const REPS = `
  FROM reps r JOIN cards c ON c.id = r.card_id JOIN shelves sh ON sh.id = c.shelf_id
  WHERE sh.user_id = ?1 AND (?2 IS NULL OR c.shelf_id = ?2) AND r.verdict IS NOT NULL`;

/** The local months bound as ?3, a JSON array of their UTC starts in ms, each with the start of the next. */
const MONTHS = `
  b AS MATERIALIZED (
    SELECT CAST(key AS INTEGER) AS i, value AS start, coalesce(LEAD(value) OVER (ORDER BY key), 8640000000000000) AS stop
    FROM json_each(?3)
  )`;

/** The median of the ranked rows in `ranked` (columns v, i from 0, and n), as SQL. */
const MEDIAN = "(SELECT avg(v) FROM ranked WHERE i IN ((n - 1) / 2, n / 2))";

const RANGE = {
  asks: `SELECT min(p.time) AS first, max(p.time) AS last FROM phrasings p JOIN shelves sh ON sh.id = p.shelf_id WHERE sh.user_id = ?1 AND (?2 IS NULL OR p.shelf_id = ?2)`,
  reps: `SELECT min(r.checked_at) AS first, max(r.checked_at) AS last ${REPS}`,
};

type Range = { first: number | null; last: number | null };
type Totals = {
  messages: number;
  onCards: number;
  cards: number;
  reasks: number;
  gaps: number;
  underADay: number;
  underAWeek: number;
  oneToFourWeeks: number;
  oneToThreeMonths: number;
  threeMonthsOrMore: number;
};
type Ranked = { i: number; n: number; v: number };

/** A time zone's local calendar, read through one Intl formatter: a month's number and the UTC instant each month starts. */
export class Zone {
  readonly name: string;
  private readonly parts: Intl.DateTimeFormat;

  /** Throws a RangeError for a time zone the runtime doesn't know. */
  constructor(timeZone: string) {
    this.parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    // As asked: the runtime may know a zone by an older alias (Asia/Kolkata as Asia/Calcutta).
    this.name = timeZone;
  }

  /** The local wall-clock time at `ms`, written as if it were UTC, and its month counted from year 0 (year * 12 + month - 1). */
  private wall(ms: number): { at: number; month: number } {
    const p: Record<string, number> = {};
    for (const { type, value } of this.parts.formatToParts(ms)) if (type !== "literal") p[type] = Number(value);
    return { at: Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!), month: p.year! * 12 + p.month! - 1 };
  }

  /** The local month `ms` falls in, counted from year 0. */
  monthOf = (ms: number) => this.wall(ms).month;

  /** The UTC instant local midnight starts the month: the 1st's midnight, less the zone's offset then. */
  startOf(month: number): number {
    const local = Date.UTC(Math.floor(month / 12), month % 12, 1);
    const offset = (ms: number) => this.wall(ms).at - Math.floor(ms / 1000) * 1000;
    const guess = local - offset(local);
    // The offset at the guess is the one in force at midnight, unless a change of offset falls between the two.
    return local - offset(guess);
  }
}

/** "2026-09", for a month counted from year 0. */
const label = (month: number) => `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}`;

/** Milliseconds as days, to one decimal. */
const days = (ms: number | null) => (ms === null ? null : Math.round((ms / DAY) * 10) / 10);

/** The percentile `p` of n ranked values, between the two nearest ranks (as R's type 7 and numpy's default). */
function percentile(rows: Ranked[], p: number): number | null {
  const n = rows[0]?.n;
  if (!n) return null;
  const at = p * (n - 1);
  const value = (i: number) => rows.find((row) => row.i === i)!.v;
  const low = value(Math.floor(at));
  return low + (at - Math.floor(at)) * (value(Math.ceil(at)) - low);
}

/** Everything the analysis counts, for the account, on one shelf of theirs or all of them; null when the shelf isn't theirs. */
export async function getAnalysis(db: Db, userId: string, zone: Zone, shelfId: string | null): Promise<Analysis | null> {
  const scope = [userId, shelfId] as const;
  const [asksRange, repsRange, owned] = await db.batch([
    db.prepare(RANGE.asks).bind(...scope),
    db.prepare(RANGE.reps).bind(...scope),
    shelfId === null ? db.prepare("SELECT 1") : ownsShelf(db, userId, shelfId),
  ]);
  if (!owned!.results.length) return null;
  let asks = asksRange!.results[0] as Range;
  let reps = repsRange!.results[0] as Range;

  for (let tries = 1; ; tries++) {
    const read = await readAll(db, zone, scope, asks, reps);
    const moved = read.asks.first !== asks.first || read.asks.last !== asks.last || read.reps.first !== reps.first || read.reps.last !== reps.last;
    if (!moved || tries === TRIES) return read.answer;
    ({ asks, reps } = read);
  }
}

/** The whole answer in one batch, its months from the range given, with the range as the batch read it. */
async function readAll(db: Db, zone: Zone, scope: readonly [string, string | null], asks: Range, reps: Range) {
  // One run of local months across both ranges, so both bucket against the same starts.
  const ends = [asks.first, asks.last, reps.first, reps.last].filter((ms) => ms !== null);
  const span = ends.length ? { first: zone.monthOf(Math.min(...ends)), last: zone.monthOf(Math.max(...ends)) } : null;
  const starts = span ? Array.from({ length: span.last - span.first + 1 }, (_, i) => zone.startOf(span.first + i)) : [];
  const bounds = JSON.stringify(starts);

  const [asksRange, repsRange, totals, gapRanks, skills, repTotals, proof, after, shelves, askMonths, repMonths] = await db.batch([
    db.prepare(RANGE.asks).bind(...scope),
    db.prepare(RANGE.reps).bind(...scope),
    db
      .prepare(
        `WITH ${ASKS}
         SELECT count(*) AS messages, count(card_id) AS onCards, count(DISTINCT card_id) AS cards,
           coalesce(sum(nth > 1), 0) AS reasks, count(gap) AS gaps,
           coalesce(sum(gap < ${DAY}), 0) AS underADay,
           coalesce(sum(gap >= ${DAY} AND gap < ${WEEK}), 0) AS underAWeek,
           coalesce(sum(gap >= ${WEEK} AND gap < ${FOUR_WEEKS}), 0) AS oneToFourWeeks,
           coalesce(sum(gap >= ${FOUR_WEEKS} AND gap < ${QUARTER}), 0) AS oneToThreeMonths,
           coalesce(sum(gap >= ${QUARTER}), 0) AS threeMonthsOrMore
         FROM asks`,
      )
      .bind(...scope),
    // The rows at the ranks the quartiles and the median fall between, and no others.
    db
      .prepare(
        `WITH ${ASKS},
         ranked AS (SELECT gap AS v, ROW_NUMBER() OVER (ORDER BY gap) - 1 AS i, count(*) OVER () AS n FROM asks WHERE gap IS NOT NULL)
         SELECT i, n, v FROM ranked WHERE i IN ((n - 1) / 4, (n + 2) / 4, (n - 1) / 2, n / 2, 3 * (n - 1) / 4, 3 * n / 4)`,
      )
      .bind(...scope),
    db
      .prepare(
        `WITH top AS (${CARDS} AND (?2 IS NULL OR c.shelf_id = ?2) ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id LIMIT ${SKILLS}),
         gaps AS (SELECT p.card_id, p.time - LAG(p.time) OVER (PARTITION BY p.card_id ORDER BY p.time, p.id) AS gap FROM phrasings p WHERE p.card_id IN (SELECT id FROM top)),
         ranked AS (SELECT card_id, gap, ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY gap) - 1 AS i, count(*) OVER (PARTITION BY card_id) AS n FROM gaps WHERE gap IS NOT NULL),
         medians AS (SELECT card_id, avg(gap) AS median_gap FROM ranked WHERE i IN ((n - 1) / 2, n / 2) GROUP BY card_id)
         SELECT top.*, medians.median_gap FROM top LEFT JOIN medians ON medians.card_id = top.id
         ORDER BY top.borrows DESC, top.last_borrow_at DESC, top.id`,
      )
      .bind(...scope),
    db.prepare(`SELECT coalesce(sum(r.verdict = 'pass'), 0) AS passed, coalesce(sum(r.verdict = 'fail'), 0) AS failed ${REPS}`).bind(...scope),
    // From each proven card's first borrow to its first passed rep.
    db
      .prepare(
        `WITH proofs AS (
           SELECT min(r.checked_at) - (SELECT min(p.time) FROM phrasings p WHERE p.card_id = c.id) AS v
           ${REPS} AND r.verdict = 'pass' GROUP BY c.id
         ),
         ranked AS (SELECT v, ROW_NUMBER() OVER (ORDER BY v) - 1 AS i, count(*) OVER () AS n FROM proofs)
         SELECT (SELECT count(*) FROM proofs) AS cards, ${MEDIAN} AS median`,
      )
      .bind(...scope),
    // From each card's latest return to the first borrow after it, for the cards borrowed again.
    db
      .prepare(
        `WITH proven AS (
           SELECT s.card_id, s.returned_at, s.status FROM card_status s JOIN shelves sh ON sh.id = s.shelf_id
           WHERE sh.user_id = ?1 AND (?2 IS NULL OR s.shelf_id = ?2) AND s.returned_at IS NOT NULL
         ),
         next AS (
           SELECT (SELECT min(p.time) FROM phrasings p WHERE p.card_id = pr.card_id AND p.time > pr.returned_at) - pr.returned_at AS v
           FROM proven pr WHERE pr.status = 'borrowed_again'
         ),
         ranked AS (SELECT v, ROW_NUMBER() OVER (ORDER BY v) - 1 AS i, count(*) OVER () AS n FROM next)
         SELECT (SELECT count(*) FROM proven) AS proven, (SELECT count(*) FROM next) AS askedSince, ${MEDIAN} AS median`,
      )
      .bind(...scope),
    db
      .prepare(
        `SELECT sh.id AS shelf_id, sh.name AS shelf_name, sh.demo AS shelf_demo,
           count(p.id) AS messages, count(p.card_id) - count(DISTINCT p.card_id) AS reasks, count(DISTINCT p.card_id) AS cards
         FROM shelves sh LEFT JOIN phrasings p ON p.shelf_id = sh.id
         WHERE sh.user_id = ?1 GROUP BY sh.id ORDER BY sh.created_at, sh.id`,
      )
      .bind(scope[0]),
    db
      .prepare(
        `WITH ${MONTHS}, ${ASKS}
         SELECT b.i, count(*) AS messages, coalesce(sum(a.nth > 1), 0) AS reasks
         FROM asks a JOIN b ON a.time >= b.start AND a.time < b.stop GROUP BY b.i`,
      )
      .bind(...scope, bounds),
    db
      .prepare(
        `WITH ${MONTHS}
         SELECT b.i, coalesce(sum(r.verdict = 'pass'), 0) AS passed, coalesce(sum(r.verdict = 'fail'), 0) AS failed
         FROM reps r JOIN cards c ON c.id = r.card_id JOIN shelves sh ON sh.id = c.shelf_id
           JOIN b ON r.checked_at >= b.start AND r.checked_at < b.stop
         WHERE sh.user_id = ?1 AND (?2 IS NULL OR c.shelf_id = ?2) AND r.verdict IS NOT NULL
         GROUP BY b.i`,
      )
      .bind(...scope, bounds),
  ]);

  const t = totals!.results[0] as Totals;
  const ranks = gapRanks!.results as Ranked[];
  const proofRow = proof!.results[0] as { cards: number; median: number | null };
  const afterRow = after!.results[0] as { proven: number; askedSince: number; median: number | null };
  const { passed, failed } = repTotals!.results[0] as { passed: number; failed: number };

  // Months by their index in the run of starts, then each list cut to its own range, the empty months kept.
  const first = span?.first ?? 0;
  const byMonth = <T,>(rows: ({ i: number } & T)[]) => new Map(rows.map((row) => [row.i, row]));
  const askCounts = byMonth(askMonths!.results as { i: number; messages: number; reasks: number }[]);
  const repCounts = byMonth(repMonths!.results as { i: number; passed: number; failed: number }[]);
  const run = (range: Range) => (range.first === null || range.last === null ? [] : Array.from({ length: zone.monthOf(range.last) - zone.monthOf(range.first) + 1 }, (_, k) => zone.monthOf(range.first!) - first + k));

  const answer: Analysis = {
    timeZone: zone.name,
    shelfId: scope[1],
    messages: t.messages,
    onCards: t.onCards,
    notOnACard: t.messages - t.onCards,
    cards: t.cards,
    reasks: t.reasks,
    firstAskAt: asks.first === null ? null : iso(asks.first),
    lastAskAt: asks.last === null ? null : iso(asks.last),
    months: run(asks).map((i) => ({ month: label(first + i), messages: askCounts.get(i)?.messages ?? 0, reasks: askCounts.get(i)?.reasks ?? 0 })),
    gaps: {
      count: t.gaps,
      medianDays: days(percentile(ranks, 0.5)),
      middleHalf: t.gaps ? { fromDays: days(percentile(ranks, 0.25))!, toDays: days(percentile(ranks, 0.75))! } : null,
      buckets: { underADay: t.underADay, underAWeek: t.underAWeek, oneToFourWeeks: t.oneToFourWeeks, oneToThreeMonths: t.oneToThreeMonths, threeMonthsOrMore: t.threeMonthsOrMore },
    },
    skills: (skills!.results as (CardRow & ShelfColumns & { median_gap: number | null })[]).map((row): AnalysisSkill => ({ ...toDeskCard(row), medianGapDays: days(row.median_gap) })),
    reps: {
      passed,
      failed,
      months: run(reps).map((i): AnalysisRepMonth => ({ month: label(first + i), passed: repCounts.get(i)?.passed ?? 0, failed: repCounts.get(i)?.failed ?? 0 })),
      firstAskToProof: { cards: proofRow.cards, medianDays: days(proofRow.median) },
    },
    afterProof: { proven: afterRow.proven, askedSince: afterRow.askedSince, medianDaysToNextAsk: days(afterRow.median) },
    shelves: (shelves!.results as ({ shelf_id: string; messages: number; reasks: number; cards: number } & ShelfColumns)[]).map(
      (row): AnalysisShelf => ({ ...shelfOf(row), messages: row.messages, reasks: row.reasks, cards: row.cards }),
    ),
  };
  return { answer, asks: asksRange!.results[0] as Range, reps: repsRange!.results[0] as Range };
}
