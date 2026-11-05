// The roadmap, as the store reads it: one account's cards across all its
// shelves, read in one query scoped by the owner, most borrowed first, then
// placed on the path's areas by server/roadmap-areas.ts. Each card's
// status comes from the card_status view, as the Desk's do, so the areas'
// counts and the cards elsewhere add up to the Desk's totals. Every card is
// placed and counted, but an area, and elsewhere, keeps only its first
// ROADMAP_CARDS (m1kuorg/basics#81), and a card is built into the answer
// only when it's kept or is the first on its area that needs a cold rep, so
// the answer stays small however many cards there are. Per card the work is
// one split of its skill name and a lookup per word.

import { ROADMAP_CARDS, type Roadmap, type RoadmapArea, type RoadmapCard } from "@asked-before/sdk";
import { AREAS, place } from "../roadmap-areas";
import type { CardRow } from "./cards";
import type { Db } from "./db";
import { CARDS, shelfOf, toDeskCard, type ShelfColumns } from "./desk";

const COUNTED = { borrowed: "borrowed", returned: "returned", borrowed_again: "borrowedAgain" } as const;

const noCounts = () => ({ cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 });

export async function getRoadmap(db: Db, userId: string): Promise<Roadmap> {
  const [cards, shelves] = await db.batch([
    db.prepare(`${CARDS} ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id`).bind(userId),
    // The shelves holding a card, in shelves.list's order (store/shelves.ts).
    db
      .prepare(
        `SELECT sh.id AS shelf_id, sh.name AS shelf_name, sh.demo AS shelf_demo FROM shelves sh
         WHERE sh.user_id = ?1 AND EXISTS (SELECT 1 FROM cards c WHERE c.shelf_id = sh.id)
         ORDER BY sh.created_at, sh.id`,
      )
      .bind(userId),
  ]);
  const areas = AREAS.map(({ id, name, about }): RoadmapArea => ({ id, name, about, cards: [], counts: noCounts() }));
  const elsewhere: Roadmap["elsewhere"] = { cards: [], counts: noCounts() };
  /** Each area's most borrowed card that needs a cold rep, by the area's index. */
  const nextOn: RoadmapCard[] = [];
  for (const row of cards!.results as (CardRow & ShelfColumns)[]) {
    const { area, matched } = place(row.skill);
    const on = area === null ? elsewhere : areas[area]!;
    on.counts.cards++;
    on.counts[COUNTED[row.status]]++;
    const kept = on.cards.length < ROADMAP_CARDS;
    const first = area !== null && row.status !== "returned" && nextOn[area] === undefined;
    if (!kept && !first) continue;
    const card = { ...toDeskCard(row), matched };
    if (kept) on.cards.push(card);
    if (first) nextOn[area] = card;
  }
  const at = areas.findIndex((_, i) => nextOn[i] !== undefined);
  return {
    areas,
    elsewhere,
    next: at === -1 ? null : { area: areas[at]!.id, card: nextOn[at]! },
    shelves: (shelves!.results as ({ shelf_id: string } & ShelfColumns)[]).map(shelfOf),
  };
}
