// Cards: list a shelf's cards with their status, get one card with its
// borrows and reps, and list a shelf's unsorted phrasings
// (m1kuorg/basics#44). A card is one skill you asked about more than once;
// the sort makes it from your phrasings, and its count, stamps, and status
// all come from those phrasings' own times and its reps, never from the model.

import { paged, path, type PageOptions, type Requester } from "./http.ts";
import type { Rep } from "./reps.ts";

/** Borrowed while no cold rep on it has passed; returned once one passed after its latest borrow; borrowed again when a borrow came after that pass. */
export type CardStatus = "borrowed" | "returned" | "borrowed_again";

export type Card = {
  id: string;
  shelfId: string;
  /** What its phrasings ask how to do, such as "Undo a git commit". */
  skill: string;
  status: CardStatus;
  /** How many times you asked: its borrows. */
  count: number;
  firstBorrowAt: string;
  lastBorrowAt: string;
  /** When its latest cold rep passed, or null before one has. */
  returnedAt: string | null;
};

/** One of your phrasings as Asked Before keeps it: on a card, unsorted, or waiting for its sort. */
export type StoredPhrasing = {
  id: string;
  /** The export's own message id, or a generated one for a capture. */
  sourceId: string;
  /** Your words, word for word. */
  text: string;
  /** When you sent it. */
  time: string;
};

/** One borrow: a phrasing on a card. */
export type Borrow = StoredPhrasing;

/** A card with its lesson (null until its first cold rep), every borrow, oldest first, and its reps, oldest first. */
export type CardDetail = Card & { lesson: string | null; borrows: Borrow[]; reps: Rep[] };

/** One page of a shelf's unsorted phrasings, newest first: those a sort has seen that aren't on a card, because nothing else so far asks the same thing. Pass `next` as the cursor for the page after; it's null on the last. */
export type UnsortedPage = { phrasings: StoredPhrasing[]; next: string | null };

export const cards = (request: Requester) => ({
  /** The shelf's cards, most borrowed first, ties to the later last borrow. */
  list: (shelfId: string) => request<{ cards: Card[] }>("GET", path`/shelves/${shelfId}/cards`).then((body) => body.cards),
  get: (cardId: string) => request<CardDetail>("GET", path`/cards/${cardId}`),
  unsorted: (shelfId: string, page: PageOptions = {}) => request<UnsortedPage>("GET", paged(path`/shelves/${shelfId}/unsorted`, page)),
});
