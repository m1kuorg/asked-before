// Analysis's sentences, each built from analysis.get() alone: the h1 ("15 of
// your 27 messages asked something you'd asked before."), the grey line under
// it, and one plain finding for each view. Months come as "2026-09", counted
// in the answer's own time zone, so they're written here without one.

import type { Analysis, AnalysisShelf } from "@asked-before/sdk";
import { count, plural } from "@/lib/format";

const longMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** A month label, "2026-09", as the first instant of that month in UTC: for formatting only. */
const dateOf = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

/** "September 2026". */
export const monthName = (month: string) => longMonth.format(dateOf(month));
/** "Sep", or "Sep 2026" with its year. */
export const monthShort = (month: string, withYear = false) => `${shortMonth.format(dateOf(month))}${withYear ? ` ${month.slice(0, 4)}` : ""}`;

/** "March 2025 to September 2026", or "in October 2026" for one month. */
export function monthSpan(first: string, last: string): string {
  return first === last ? `in ${monthName(first)}` : `${monthName(first)} to ${monthName(last)}`;
}

/** Days as a reader says them: "under a day", "1 day", "85 days". */
export function daysText(days: number): string {
  if (days < 1) return "under a day";
  const whole = Math.round(days);
  return `${count(whole)} ${whole === 1 ? "day" : "days"}`;
}

/** A range of days: "73 to 168 days", or "under a day to 5 days" when it starts under one. */
export function daysRange(from: number, to: number): string {
  return from < 1 ? `${daysText(from)} to ${daysText(to)}` : `${count(Math.round(from))} to ${daysText(to)}`;
}

/** The shelves the answer counts: the one asked for, or every shelf with a message on it. */
export function countedShelves(analysis: Analysis): AnalysisShelf[] {
  return analysis.shelfId === null ? analysis.shelves.filter((shelf) => shelf.messages > 0) : analysis.shelves.filter((shelf) => shelf.id === analysis.shelfId);
}

/** The screen's h1. */
export function headline(analysis: Analysis, shelfName: string | undefined): string {
  const { messages, reasks } = analysis;
  if (messages === 0) return shelfName ? `No messages on ${shelfName} yet.` : "No messages yet.";
  if (reasks > 0) return `${count(reasks)} of your ${plural(messages, "message")} asked something you'd asked before.`;
  return messages === 1 ? "Your 1 message hasn't been asked again yet." : `None of your ${count(messages)} messages asked something you'd asked before.`;
}

/** Where the messages counted are from, for the grey line: each shelf's name when there are three or fewer. */
export function shelvesPhrase(shelves: AnalysisShelf[]): { named: AnalysisShelf[] } | { many: number; demo: number } {
  return shelves.length <= 3 ? { named: shelves } : { many: shelves.length, demo: shelves.filter((shelf) => shelf.demo).length };
}

/** "UTC", or "America/New York time". */
export const zoneText = (timeZone: string) => (timeZone === "UTC" ? "UTC" : `${timeZone.replaceAll("_", " ")} time`);

/** Every month's finding: how many months had a re-ask, and the busiest one. */
export function monthsFinding(analysis: Analysis): string {
  const { months } = analysis;
  const withReasks = months.filter((month) => month.reasks > 0).length;
  // The busiest month, the latest among equals.
  const busiest = months.reduce((top, month) => (month.messages >= top.messages ? month : top), months[0]!);
  const again = withReasks === 0 ? "No month has a message that asked something you'd asked before." : `You asked something you'd asked before in ${count(withReasks)} of ${plural(months.length, "month")}.`;
  if (months.length === 1) return again;
  const its = busiest.reasks ? `, ${count(busiest.reasks)} of them asked before` : "";
  return `${again} The busiest was ${monthName(busiest.month)}, with ${plural(busiest.messages, "message")}${its}.`;
}

/** Too few messages to chart: where they are, in words. */
export function fewMonths(analysis: Analysis): string {
  const { months, messages } = analysis;
  const span = monthSpan(months[0]!.month, months.at(-1)!.month);
  return `${messages === 1 ? "Your 1 message is from" : `Your ${count(messages)} messages are from`} ${span.replace(/^in /, "")}. A month-by-month chart needs at least 5 to say anything.`;
}

/** The gaps' finding: their median and middle half, in words. */
export function gapsFinding(gaps: Analysis["gaps"]): string {
  if (!gaps.count || gaps.medianDays === null || !gaps.middleHalf) return "No card has a second message yet, so there's no gap to measure.";
  const middle = gaps.count < 4 ? "" : ` The middle half of your ${count(gaps.count)} gaps runs from ${daysText(gaps.middleHalf.fromDays)} to ${daysText(gaps.middleHalf.toDays)}.`;
  return `Half the time, you asked again within ${daysText(gaps.medianDays)} of the time before.${middle}`;
}

/** The cold reps' finding. */
export function repsFinding(reps: Analysis["reps"]): string {
  const { passed, failed, months, firstAskToProof } = reps;
  if (passed + failed === 0) return "No cold rep has been checked yet. A cold rep is a fresh problem of a card's skill, answered without AI; pass one and the card is Proven.";
  const when = monthSpan(months[0]!.month, months.at(-1)!.month);
  const tally = `${plural(passed, "cold rep")} passed and ${count(failed)} not yet, ${passed + failed === 2 && months.length === 1 ? "both " : ""}${when}.`;
  if (!firstAskToProof.cards || firstAskToProof.medianDays === null) return tally;
  const proof =
    firstAskToProof.cards === 1
      ? `Your proven card took ${daysText(firstAskToProof.medianDays)} from its first message to its first pass.`
      : `From a card's first message to its first pass took ${daysText(firstAskToProof.medianDays)}, the median of ${plural(firstAskToProof.cards, "proven card")}.`;
  return `${tally} ${proof}`;
}

/** Proven, then asked again: the finding. */
export function provenFinding(after: Analysis["afterProof"]): string {
  const { proven, askedSince, medianDaysToNextAsk } = after;
  if (proven === 0) return "No card is proven yet. A card is marked Proven the day you pass a cold rep on it.";
  const cards = proven === 1 ? "Your 1 proven card" : `Of your ${count(proven)} proven cards, ${count(askedSince)}`;
  if (askedSince === 0) return proven === 1 ? "Your 1 proven card hasn't been asked again since." : `None of your ${count(proven)} proven cards has been asked again since.`;
  const after_ = medianDaysToNextAsk === null ? "" : medianDaysToNextAsk < 1 ? ", within a day of its proof" : `, ${daysText(medianDaysToNextAsk)} after ${askedSince === 1 ? "its" : "their"} proof${askedSince === 1 ? "" : " at the median"}`;
  return proven === 1 ? `${cards} was asked again since${after_}.` : `${cards} ${askedSince === 1 ? "was" : "were"} asked again since${after_}.`;
}
