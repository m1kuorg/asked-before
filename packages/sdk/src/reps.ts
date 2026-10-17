// Reps: start a cold rep on a card, and check an answer once
// (m1kuorg/basics#46). A cold rep is a fresh problem of the card's skill,
// answered without AI. Starting one returns its problem, and the card's
// lesson on its first rep or after a failed one. Checking it returns the
// verdict and the reason, and the card as the check left it: a pass stamps
// it returned. A rep is checked once; checking it again is a 409, and so is
// checking one after a newer rep on its card has started. A card's reps
// also come with the card (cards.get).

import type { Card } from "./cards";
import { path, type Requester } from "./http";

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

/** A rep just started, unchecked, and the card's lesson on its first rep or after a failed one, or else null. */
export type StartedRep = { rep: Rep; lesson: string | null };

/** Your own answer to a rep's problem, written without AI. */
export type RepAnswer = { answer: string };

/** The checked rep, with its verdict and reason, and its card as the check left it: returned after a pass. */
export type CheckedRep = { rep: Rep; card: Card };

export const reps = (request: Requester) => ({
  start: (cardId: string) => request<StartedRep>("POST", path`/cards/${cardId}/reps`),
  check: (repId: string, body: RepAnswer) => request<CheckedRep>("POST", path`/reps/${repId}/check`, body),
});
