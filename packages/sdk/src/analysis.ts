// Analysis (app-notes/depth/plan.md, section 1): how you ask, and what you
// keep re-asking, counted by code from your phrasings' own timestamps, your
// cards, and your cold reps. Nothing in it calls the model. Months are
// counted in the time zone you ask for, so a message sent late on the 31st
// lands in the month you sent it in. Counts and medians only: no streaks or
// scores.

import type { DeskCard, DeskShelf } from "./desk.ts";
import type { Requester } from "./http.ts";

/** One month, as "2026-09" in the time zone asked for: the phrasings you sent in it, and how many of them were re-asks. */
export type AnalysisMonth = { month: string; messages: number; reasks: number };

/**
 * The gaps between one borrow of a card and its next, by whole days
 * elapsed: under a day (under 24 hours), under a week (1 to 6 days), 1 to 4
 * weeks (7 to 27 days), 1 to 3 months (28 to 89 days), and 3 months or more
 * (90 days and up). They add up to the gaps' count.
 */
export type GapBuckets = { underADay: number; underAWeek: number; oneToFourWeeks: number; oneToThreeMonths: number; threeMonthsOrMore: number };

/** A card, with its shelf, and the median of the days between its borrows. */
export type AnalysisSkill = DeskCard & {
  /** The median gap between one borrow and its next, in days to one decimal; null with a single borrow. */
  medianGapDays: number | null;
};

/** One month of cold reps, by when each was checked: how many passed, and how many failed. */
export type AnalysisRepMonth = { month: string; passed: number; failed: number };

/** One of your shelves, with its own counts, for choosing which to count. A demo shelf is labeled as demo data wherever it shows. */
export type AnalysisShelf = DeskShelf & { messages: number; reasks: number; cards: number };

export type Analysis = {
  /** The time zone the months were counted in, as the server names it: "Europe/Berlin". */
  timeZone: string;
  /** The shelf counted, or null for every shelf of yours. */
  shelfId: string | null;
  /** Every phrasing counted: on a card or not. */
  messages: number;
  /** Phrasings on a card: the cards' borrows. */
  onCards: number;
  /** Phrasings on no card, those still waiting for their sort among them: messages minus onCards. */
  notOnACard: number;
  /** Cards with at least one borrow. Every card has two or more. */
  cards: number;
  /** Re-asks: borrows after their card's first, by time (ties by id), so onCards minus cards. */
  reasks: number;
  /** Your first and last phrasing counted, or null with none. */
  firstAskAt: string | null;
  lastAskAt: string | null;
  /** Every month from the first phrasing's to the last's, months with none included, oldest first. They add up to messages and reasks. */
  months: AnalysisMonth[];
  /** The gaps between one borrow of a card and its next: as many as the re-asks. */
  gaps: {
    count: number;
    /** The median gap in days, to one decimal; null with no gaps. */
    medianDays: number | null;
    /** The middle half of the gaps, from the 25th to the 75th percentile, in days to one decimal; null with no gaps. */
    middleHalf: { fromDays: number; toDays: number } | null;
    buckets: GapBuckets;
  };
  /** Up to 10 cards, most borrowed first, ties to the later last borrow. */
  skills: AnalysisSkill[];
  reps: {
    /** Cold reps checked: passed, and failed. A rep started and never answered isn't counted. */
    passed: number;
    failed: number;
    /** Every month from the first rep checked to the last, months with none included, oldest first; empty with none. */
    months: AnalysisRepMonth[];
    /** For each card with a passed rep: the days from its first borrow to its first pass, and their median. */
    firstAskToProof: { cards: number; medianDays: number | null };
  };
  /** Cards ever returned: how many are borrowed again since their latest return, and the median days from that return to the next borrow. */
  afterProof: { proven: number; askedSince: number; medianDaysToNextAsk: number | null };
  /** Every shelf of yours, oldest first, whichever is counted, each with its own counts. */
  shelves: AnalysisShelf[];
};

/** `timeZone`: an IANA time zone, the runtime's own unless given. `shelfId`: count one shelf of yours rather than every one. */
export type AnalysisOptions = { timeZone?: string; shelfId?: string };

export const analysis = (request: Requester) => ({
  /** An unknown time zone is a 400; a shelf that isn't yours is a 404. */
  get: ({ timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, shelfId }: AnalysisOptions = {}) => {
    const query = new URLSearchParams({ timeZone });
    if (shelfId !== undefined) query.set("shelfId", shelfId);
    return request<Analysis>("GET", `/analysis?${query}`);
  },
});
