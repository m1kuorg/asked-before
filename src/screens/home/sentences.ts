// Home's greeting and the grey line under it, built from desk.get() (brief
// sections 4 and 7): "4 cards need a cold rep, 1 is proven." over "Across 2
// shelves. You last asked one of them on Sep 2, 2026." The queue is To prove
// plus Asked since proven, the same sum the sidebar's Home count shows.
import type { Desk } from "@asked-before/sdk";
import { needRep } from "@/lib/copy";
import { count, shortDate } from "@/lib/format";

/** The cards that need a cold rep: To prove plus Asked since proven. */
export const queueOf = (totals: Desk["totals"]) => totals.borrowed + totals.borrowedAgain;

export function greeting(desk: Desk): string {
  const { cards, returned: proven } = desk.totals;
  const queue = queueOf(desk.totals);
  if (cards === 0) return "No cards yet.";
  if (queue === 0) return proven === 1 ? "Nothing needs a cold rep: your one card is proven." : `Nothing needs a cold rep: all ${count(proven)} cards are proven.`;
  const proved = proven === 0 ? "none is proven yet" : proven === 1 ? "1 is proven" : `${count(proven)} are proven`;
  return `${needRep(queue)}, ${proved}.`;
}

export function subline(desk: Desk): string {
  if (desk.totals.cards === 0) {
    return desk.shelves === 0
      ? "Every question you've asked a chatbot more than once becomes a card, kept here until you pass a cold rep on it."
      : "A card appears once a shelf's uploads hold the same question twice.";
  }
  const where = desk.shelves === 1 ? "On 1 shelf." : `Across ${count(desk.shelves)} shelves.`;
  const last = desk.latestBorrows[0];
  return last ? `${where} You last asked one of them on ${shortDate(last.time)}.` : where;
}
