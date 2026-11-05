// The roadmap: your cards across every shelf, placed on a fixed path of
// developer areas, from the terminal to deploying, by the words in each
// card's skill name. Code places them, never the model: the name is
// lowercased and split into words on anything but letters, digits, # and
// +; each area scores how many distinct words of its own list are among
// them; the highest score wins, a tie goes to the earlier area on the path,
// and a card no area's words match is elsewhere, off the path. Counts and
// statuses are the cards' own, so they add up to the Desk's totals. Each
// area, and elsewhere, sends only its ROADMAP_CARDS most borrowed cards, so
// the answer stays small however many cards you have (m1kuorg/basics#81);
// its counts count every card.

import type { DeskCard, DeskShelf } from "./desk.ts";
import type { Requester } from "./http.ts";
import type { Shelf } from "./shelves.ts";

/** The most cards an area, or elsewhere, sends: its most borrowed. The rest are in its counts, and each on its shelf. */
export const ROADMAP_CARDS = 5;

/** The areas' ids, in path order. */
export type RoadmapAreaId = "terminal" | "git" | "html" | "css" | "javascript" | "typescript" | "frameworks" | "node" | "python" | "sql" | "http" | "testing" | "deploy";

/** A card on the roadmap: a Desk card with the words of its skill name that placed it. */
export type RoadmapCard = DeskCard & {
  /** The distinct words of its skill name, lowercased, that are on its area's list, in the name's order, such as ["git", "commit"]. Empty for a card elsewhere. */
  matched: string[];
};

/** One area on the path. */
export type RoadmapArea = {
  id: RoadmapAreaId;
  /** Its name, such as "Terminal and the OS". */
  name: string;
  /** One sentence saying what it covers. */
  about: string;
  /** Its ROADMAP_CARDS most borrowed cards, ties to the later last borrow, as cards.list orders a shelf's. Empty when no card's name places it here. */
  cards: RoadmapCard[];
  /** All its cards, sent or not, and how many are borrowed, returned, and borrowed again, in a shelf's counts' shape. */
  counts: Shelf["counts"];
};

export type Roadmap = {
  /** Every area on the path, in path order, empty ones too. */
  areas: RoadmapArea[];
  /** The cards whose skill name holds none of any area's words: the ROADMAP_CARDS most borrowed, and all of them counted. */
  elsewhere: { cards: RoadmapCard[]; counts: Shelf["counts"] };
  /** The first area on the path holding a card borrowed or borrowed again, by its id, and its most borrowed such card, which may be past the area's `cards`; null when no card on the path is. */
  next: { area: RoadmapAreaId; card: RoadmapCard } | null;
  /** The shelves holding a card, each once, in shelves.list's order. */
  shelves: DeskShelf[];
};

export const roadmap = (request: Requester) => ({
  /** Your cards across every shelf, placed on the path's areas. */
  get: () => request<Roadmap>("GET", "/roadmap"),
});
