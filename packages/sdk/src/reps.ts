// Reps: start a cold rep on a card, and check an answer once
// (m1kuorg/basics#46).
// A stub until that lands: it has no methods yet, and the server answers 501.
// A card's reps already come with the card (cards.get), as `Rep`.

import type { Requester } from "./http";

/** A cold rep on a card: its problem, and once checked, your answer, the verdict, and the reason. */
export type Rep = {
  id: string;
  problem: string;
  answer: string | null;
  verdict: "pass" | "fail" | null;
  reason: string | null;
  createdAt: string;
  checkedAt: string | null;
};

export const reps = (request: Requester) => ({});
