// Search: "Have you asked this before?" Finds your own phrasings by their
// words, across your shelves or on one, and the cards they're on. Matching
// is code, never the model: a phrasing matches when every word of the
// search is somewhere in its text, ignoring the case of A to Z, and a card
// matches when one of its phrasings does, or when its skill's name holds
// every word. `searchWords` is the rule that picks the words, which the
// server and the page share, so the page never sends a search with none.

import type { StoredPhrasing } from "./cards.ts";
import type { DeskBorrow, DeskCard, DeskShelf } from "./desk.ts";
import type { Requester } from "./http.ts";

/** How many words one search looks for at most; the rest are left out. */
export const MAX_SEARCH_WORDS = 8;

/** Sentence punctuation, quotes, and brackets, trimmed from a word's ends: "commit?" is commit, while --soft, c++, and c# keep theirs. */
const TRIM = /^[.,;:!?"'`“”‘’()[\]{}<>]+|[.,;:!?"'`“”‘’()[\]{}<>]+$/g;

/**
 * The words a search looks for: `q` split on spaces, each trimmed of
 * sentence punctuation and lowercased from A to Z only (as the database's
 * lower() does), those of 2 or more characters, once each, the first 8. A
 * search with none is a 400.
 */
export function searchWords(q: string): string[] {
  const words = new Set<string>();
  for (const part of q.split(/\s+/)) {
    const word = part.replace(TRIM, "").replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    if ([...word].length >= 2) words.add(word);
    if (words.size === MAX_SEARCH_WORDS) break;
  }
  return [...words];
}

export type SearchOptions = {
  /** Your words, such as "git commit". At least one of 2 or more characters, after punctuation is trimmed. */
  q: string;
  /** Search one shelf only. Leave it out to search all of yours. */
  shelfId?: string;
};

/** A card with a phrasing that has every word, or whose skill's name has them all. */
export type SearchCard = {
  card: DeskCard;
  /** How many of its phrasings have every word: 0 when only its skill's name matched. */
  matches: number;
};

/** One of your phrasings with every word, word for word, with the card it's on (null while it isn't on one) and its shelf. */
export type SearchPhrasing = StoredPhrasing & { card: DeskBorrow["card"] | null; shelf: DeskShelf };

export type SearchAnswer = {
  /** The search as you sent it. */
  q: string;
  /** The words it looked for (searchWords of q). */
  words: string[];
  /** How many phrasings it searched: all of yours, or the shelf's. */
  searched: number;
  /** How many of them have every word. */
  total: number;
  /** The cards with a matching phrasing, most matches first, ties to the most borrowed; then those only whose skill's name matched. */
  cards: SearchCard[];
  /** Up to 50 matching phrasings, newest first, by when you sent them. `total` counts them all. */
  phrasings: SearchPhrasing[];
};

export const search = (request: Requester) => ({
  /** A shelfId that isn't yours is a 404; a q with no word of 2 or more characters is a 400. */
  get: ({ q, shelfId }: SearchOptions) => {
    const query = new URLSearchParams({ q });
    if (shelfId !== undefined) query.set("shelfId", shelfId);
    return request<SearchAnswer>("GET", `/search?${query}`);
  },
});
