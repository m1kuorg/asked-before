// The roadmap, as the store reads it: one account's cards across all its
// shelves, read in one query scoped by the owner, most borrowed first, then
// placed on the path's areas by server/roadmap-areas.ts. Each card's
// status comes from the card_status view, as the Desk's do, so the areas'
// counts and the cards elsewhere add up to the Desk's totals. Per card the
// work is one split of its skill name and a lookup per word.

import type { Roadmap, RoadmapArea, RoadmapCard } from "@asked-before/sdk";
import { AREAS, place } from "../roadmap-areas";
import type { CardRow } from "./cards";
import type { Db } from "./db";
import { CARDS, toDeskCard, type ShelfColumns } from "./desk";

const COUNTED = { borrowed: "borrowed", returned: "returned", borrowed_again: "borrowedAgain" } as const;

export async function getRoadmap(db: Db, userId: string): Promise<Roadmap> {
  const { results } = await db.prepare(`${CARDS} ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id`).bind(userId).all<CardRow & ShelfColumns>();
  const areas = AREAS.map(({ id, name, about }): RoadmapArea => ({ id, name, about, cards: [], counts: { cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 } }));
  const elsewhere: RoadmapCard[] = [];
  for (const row of results) {
    const { area, matched } = place(row.skill);
    const card = { ...toDeskCard(row), matched };
    if (area === null) {
      elsewhere.push(card);
      continue;
    }
    const on = areas[area]!;
    on.cards.push(card);
    on.counts.cards++;
    on.counts[COUNTED[card.status]]++;
  }
  return { areas, elsewhere };
}
