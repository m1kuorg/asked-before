// A card's API status as the app shows it: the new word (copy.ts) and the
// pill it wears (Badge variant). To prove is neutral, Proven positive, Asked
// since proven a notice. To prove and Asked since proven both need a cold rep.

import type { CardStatus } from "@asked-before/sdk";
import { STATUS_WORDS } from "@/lib/copy";

export type StatusPillVariant = "neutral" | "positive" | "notice";

export const STATUS: Record<CardStatus, { word: string; pill: StatusPillVariant }> = {
  borrowed: { word: STATUS_WORDS.borrowed, pill: "neutral" },
  returned: { word: STATUS_WORDS.returned, pill: "positive" },
  borrowed_again: { word: STATUS_WORDS.borrowed_again, pill: "notice" },
};

/** Whether a card is in the queue that needs a cold rep. */
export const needsRep = (status: CardStatus) => status !== "returned";
