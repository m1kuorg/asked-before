// Cards: list a project's cards with their status, get one card with its
// borrows and reps, and list a project's unsorted phrasings
// (m1kuorg/basics#44). A card is one skill you asked about more than once;
// the sort makes it from your phrasings, and its count, stamps, and status
// all come from those phrasings' own times and its reps, never from the model.

import { path, type Requester } from "./http";
import type { Rep } from "./reps";

/** Borrowed while no cold rep on it has passed; returned once one passed after its latest borrow; borrowed again when a borrow came after that pass. */
export type CardStatus = "borrowed" | "returned" | "borrowed_again";

export type Card = {
  id: string;
  projectId: string;
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

/** One borrow: a phrasing on a card, word for word, with when you sent it. */
export type Borrow = {
  id: string;
  /** The export's own message id, or a generated one for a capture. */
  sourceId: string;
  text: string;
  time: string;
};

/** A card with its lesson (null until its first cold rep), every borrow, oldest first, and its reps, oldest first. */
export type CardDetail = Card & { lesson: string | null; borrows: Borrow[]; reps: Rep[] };

/** A phrasing a sort has seen that isn't on a card, because nothing else so far asks the same thing. */
export type UnsortedPhrasing = Borrow;

/** One page of a project's unsorted phrasings, newest first. Pass `next` as the cursor for the page after; it's null on the last. */
export type UnsortedPage = { phrasings: UnsortedPhrasing[]; next: string | null };

export type UnsortedListOptions = { limit?: number; cursor?: string };

export const cards = (request: Requester) => ({
  /** The project's cards, most borrowed first, ties to the later last borrow. */
  list: (projectId: string) => request<{ cards: Card[] }>("GET", path`/projects/${projectId}/cards`).then((body) => body.cards),
  get: (cardId: string) => request<CardDetail>("GET", path`/cards/${cardId}`),
  unsorted: (projectId: string, { limit, cursor }: UnsortedListOptions = {}) => {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    if (cursor !== undefined) query.set("cursor", cursor);
    const search = query.size ? `?${query}` : "";
    return request<UnsortedPage>("GET", `${path`/projects/${projectId}/unsorted`}${search}`);
  },
});
