// A card's pieces that the project page's stack and the card page both set
// (public/styles/stack.css): its phrasings on the rail, one rail per year
// of borrows, with a stamp per borrow in the learner's own time zone; the
// plate's caption after its status; and its months.

import type { CardDetail, CardStatus } from "@asked-before/sdk";
import { el } from "./dom";
import { stamp } from "./library";

/** What the plate's count is, after the card's status. */
export const PLATE_CAPTION: Record<CardStatus, string> = {
  borrowed: "times borrowed, not returned",
  returned: "times borrowed, returned",
  borrowed_again: "times borrowed, borrowed again",
};

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
/** An ISO time's month, in the learner's own time zone, such as "March 2025". */
export const month = (iso: string) => monthYear.format(new Date(iso));

/** The months of a card's first and last borrow: "in March 2025", or "March 2025 to September 2026". */
export function months(card: { firstBorrowAt: string; lastBorrowAt: string }): string {
  const [from, to] = [month(card.firstBorrowAt), month(card.lastBorrowAt)];
  return from === to ? `in ${from}` : `${from} to ${to}`;
}

/**
 * A phrasing's words, with each command flag (`-m`, `--soft`) in a bare
 * span, so the stylesheet keeps the flag on one line. The split's capture
 * group puts the flags at the odd indexes.
 */
export function phrasing(text: string): HTMLElement {
  return el("span", "phrasing", ...text.split(/((?<![\w-])--?\w[\w-]*)/).map((part, i) => (i % 2 ? el("span", undefined, part) : part)));
}

/** The rail, cut where the year turns: one `.rail` per year of borrows, oldest first, a key for each. */
export function rails(borrows: CardDetail["borrows"]): HTMLElement[] {
  const years = Map.groupBy(borrows, (borrow) => new Date(borrow.time).getFullYear());
  return [...years].map(([year, inYear]) => {
    const rail = el(
      "ol",
      "rail",
      ...inYear.map((borrow) => {
        const key = el("span", "rail-key");
        key.setAttribute("aria-hidden", "true");
        return el("li", undefined, phrasing(borrow.text), key, el("span", "stamp", stamp(borrow.time)));
      }),
    );
    rail.setAttribute("aria-label", `Borrowed in ${year}`);
    return rail;
  });
}
