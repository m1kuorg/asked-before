// Under the map: the cards no area's words match, as rule rows on the white
// ground, each with its facts and its status pill; or, with none, the
// sentence saying every card is on the path.
import type { RoadmapCard } from "@asked-before/sdk";
import { StatusPill } from "@/components/status-pill";
import { nameLink } from "@/screens/home/panel";
import { CardFacts } from "./path-map";

export function OffPath({ cards }: { cards: RoadmapCard[] }) {
  return (
    <section aria-labelledby="off-path" className="flex flex-col gap-1">
      <h2 id="off-path" className="text-base font-medium">
        Off the path
      </h2>
      {cards.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            {cards.length === 1 ? "This card's name holds" : "These cards' names hold"} none of the areas' words, so code leaves {cards.length === 1 ? "it" : "them"} here, most asked first.
          </p>
          <ul aria-label="Cards off the path, most asked first" className="mt-2 flex flex-col">
            {cards.map((card) => (
              <li key={card.id} className="flex items-start gap-3 border-b border-rule py-2.5 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <a href={`/app/cards/${encodeURIComponent(card.id)}`} className={`${nameLink} line-clamp-2 break-words`}>
                    {card.skill}
                  </a>
                  <CardFacts card={card} why={false} />
                </div>
                <StatusPill status={card.status} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Every card's name places it on the path, so none is off it.</p>
      )}
    </section>
  );
}
