// Roadmap's sentences, built from roadmap.get(): the h1 ("5 cards need a
// cold rep, across 5 areas of the path."), the next card on the path, the
// sentence where each area ends ("Git: 0 of 1 proven."), and why a card is
// where it is ("its name says “git” and “commit”"). A card needs a cold rep
// while it's To prove or Asked since proven, as on Home. Every count comes
// from the areas' counts, since an area sends only its most asked cards.
import type { Roadmap, RoadmapArea, RoadmapCard, Shelf } from "@asked-before/sdk";
import { needRep } from "@/lib/copy";
import { count, plural } from "@/lib/format";
import { queueOf } from "@/screens/home/sentences";

const and = new Intl.ListFormat("en-US", { type: "conjunction" });

/** The cards on the path's areas, counted by status: the areas' counts summed. */
export const onPath = (map: Roadmap): Shelf["counts"] =>
  map.areas.reduce(
    (sum, { counts }) => ({ cards: sum.cards + counts.cards, borrowed: sum.borrowed + counts.borrowed, returned: sum.returned + counts.returned, borrowedAgain: sum.borrowedAgain + counts.borrowedAgain }),
    { cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 },
  );

export function headline(map: Roadmap): string {
  const placed = onPath(map);
  if (!placed.cards) return map.elsewhere.counts.cards ? "None of your cards is on the path yet." : "No cards on the path yet.";
  const queue = queueOf(placed);
  if (!queue) return placed.cards === 1 ? "Your one card on the path is proven." : "Every card on the path is proven.";
  const areas = map.areas.filter((area) => queueOf(area.counts) > 0);
  return areas.length === 1 ? `${needRep(queue)}, on ${areas[0]!.name}.` : `${needRep(queue)}, across ${count(areas.length)} areas of the path.`;
}

/** The first area on the path holding a card that needs a cold rep, and its most asked such card, as the answer's `next` names them. */
export function nextOnPath(map: Roadmap): { area: RoadmapArea; card: RoadmapCard } | null {
  const area = map.next && map.areas.find((each) => each.id === map.next!.area);
  return area ? { area, card: map.next!.card } : null;
}

/** Where an area ends: "Git: 0 of 1 proven." or "CSS: 0 of 1 proven, 1 asked since proven." */
export function areaEnd(area: RoadmapArea): string {
  const { cards, returned, borrowedAgain } = area.counts;
  const again = borrowedAgain ? `, ${count(borrowedAgain)} asked since proven` : "";
  return `${area.name}: ${count(returned)} of ${count(cards)} proven${again}.`;
}

/** An area's node line: "3 cards", or "No card on it yet". */
export const areaCount = (area: RoadmapArea) => (area.counts.cards ? plural(area.counts.cards, "card") : "No card on it yet");

/** Why a card is where it is: "its name says “git” and “commit”". */
export const because = (card: RoadmapCard) => `its name says ${and.format(card.matched.map((word) => `“${word}”`))}`;
