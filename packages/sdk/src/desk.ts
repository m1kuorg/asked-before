// The Desk (m1kuorg/basics#47), the circulation desk: what's still
// borrowed across your shelves, most borrowed first; your latest borrows
// and returns; and the totals of your cards by status, which add up the
// shelves' own counts. Plain numbers and lists only: no charts, streaks,
// or scores.

import type { Borrow, Card, CardStatus } from "./cards.ts";
import type { Requester } from "./http.ts";
import type { Shelf } from "./shelves.ts";

/** The shelf a card or borrow is on. A demo shelf is labeled as demo data wherever it shows. */
export type DeskShelf = Pick<Shelf, "id" | "name" | "demo">;

/** A card, with the shelf it's on. */
export type DeskCard = Card & { shelf: DeskShelf };

/** A borrow, with the card it's on and that card's shelf. */
export type DeskBorrow = Borrow & { card: { id: string; skill: string; status: CardStatus }; shelf: DeskShelf };

export type Desk = {
  /** How many shelves you have. */
  shelves: number;
  /** Your cards across every shelf, and how many are borrowed, returned, and borrowed again: the sums of the shelves' own counts. */
  totals: Shelf["counts"];
  /** Up to 10 cards no cold rep has returned (borrowed, or borrowed again), across shelves, most borrowed first, ties to the later last borrow. */
  mostBorrowed: DeskCard[];
  /** Your 10 latest borrows across shelves, by when you sent them, newest first. */
  latestBorrows: DeskBorrow[];
  /** Up to 10 cards with a return stamp, latest stamp first. A card borrowed again since keeps its stamp and says so in its status. */
  latestReturns: DeskCard[];
};

export const desk = (request: Requester) => ({
  get: () => request<Desk>("GET", "/desk"),
});
