// The demo's cards, for the landing page. This runs as a Bun macro when the
// pages are bundled (`with { type: "macro" }`), so the bundle carries only
// what it returns: the five cards of the guest's sorted demo shelf,
// demo/sorted.json, with their phrasings and times, named as a guest then
// sees them. Never the answer key, the known answers, or the rest of the
// export.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DemoCard = { skill: string; borrows: { text: string; at: string }[] };

const DEMO = join(import.meta.dir, "..", "..", "demo");

/** The guest's sorted demo shelf's cards, most asked first, for the landing's showcase: the skill names a guest sees. */
export function demoCards(): DemoCard[] {
  const sorted: { cards: { skill: string; phrasings: string[] }[]; phrasings: { sourceId: string; text: string; time: string }[] } = JSON.parse(
    readFileSync(join(DEMO, "sorted.json"), "utf8"),
  );
  const bySource = new Map(sorted.phrasings.map((phrasing) => [phrasing.sourceId, phrasing]));
  return sorted.cards
    .map((card) => ({
      skill: card.skill,
      borrows: card.phrasings
        .map((id) => {
          const phrasing = bySource.get(id);
          if (!phrasing) throw new Error(`demo/sorted.json's card "${card.skill}" names a phrasing it doesn't hold: ${id}.`);
          return { text: phrasing.text, at: new Date(phrasing.time).toISOString() };
        })
        .sort((x, y) => x.at.localeCompare(y.at)),
    }))
    .sort((x, y) => y.borrows.length - x.borrows.length || y.borrows.at(-1)!.at.localeCompare(x.borrows.at(-1)!.at));
}
