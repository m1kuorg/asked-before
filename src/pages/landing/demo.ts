// The demo history's five cards, inlined when the page is bundled by the
// demoCards() macro: each skill's name and its phrasings' words and times,
// never the answer key or the known answers. Card A, "Undo a git commit", is
// the most asked, first.
import { askAxis } from "@/components/ask-strip";
import { demoCards } from "../demo-card" with { type: "macro" };

export const CARDS = demoCards();
export const CARD_A = CARDS[0]!;

/** One axis for every strip on the page, from the month of the demo's first ask to today. */
export const AXIS = askAxis(CARDS.map((card) => card.borrows[0]!.at));

/** The demo export's own messages, the one-offs included: what its upload preview counts. */
export const DEMO_MESSAGES = 27;
