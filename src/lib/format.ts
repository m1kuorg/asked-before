// How the app writes numbers and dates: en-US, in the learner's own time
// zone (m1kuorg/basics#74). Counts are grouped ("2,000"), a missing value is
// a dash, and a card's months read "March 2025 to September 2026". Put
// figures that line up or update in tabular-nums.

const grouping = new Intl.NumberFormat("en-US");
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const longMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/** A missing or not-applicable value; a real zero prints as 0. */
export const DASH = "—";

/** "2,000". */
export const count = (n: number) => grouping.format(n);

/** "1 card", "4 cards"; pass the plural when it isn't the noun plus s. */
export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

/** "asked 9 times". */
export const askedTimes = (n: number) => `asked ${plural(n, "time")}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-23": for date columns that are compared row against row. */
export function isoDate(iso: string): string {
  const at = new Date(iso);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** "Oct 23, 2026": for dates in sentences and lists, such as "Proven Oct 23, 2026". */
export const shortDate = (iso: string) => shortDay.format(new Date(iso));

/** "October 23, 2026": for labels read aloud, such as the ask strip's. */
export const longDate = (iso: string) => longDay.format(new Date(iso));

/** "March 2025". */
export const month = (iso: string) => longMonth.format(new Date(iso));

/** A card's months, first ask to last: "in March 2025", or "March 2025 to September 2026". */
export function months(first: string, last: string): string {
  const [from, to] = [month(first), month(last)];
  return from === to ? `in ${from}` : `${from} to ${to}`;
}

/** The same in a row's short form: "Mar 2025", or "Mar 2025 – Sep 2026". */
export function shortMonths(first: string, last: string): string {
  const [from, to] = [shortMonth.format(new Date(first)), shortMonth.format(new Date(last))];
  return from === to ? from : `${from} – ${to}`;
}
