// Home's 6 + 6 row (brief sections 4 and 7). "Latest asks": your 10 newest
// messages on a card, word for word, each with its date and its card.
// "Latest proven": the cards with a pass, latest first, with their status
// pill, the day they were proven, and "asked again <date>" when you asked
// after that.
import type { DeskBorrow, DeskCard } from "@asked-before/sdk";
import { cn } from "cn";
import { DemoChip } from "@/components/demo-chip";
import { Phrasing } from "@/components/phrasing";
import { StatusPill } from "@/components/status-pill";
import { Time } from "@/components/time";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, nameLink, rowCard } from "./panel";

const cardPath = (id: string) => `/app/cards/${encodeURIComponent(id)}`;

export function LatestAsks({ asks, className }: { asks: DeskBorrow[]; className?: string }) {
  return (
    <Panel title="Latest asks" description="What you asked most recently, newest first, with the card each one is on." className={className}>
      {asks.length ? (
        <ol aria-label="Latest asks, newest first" className="flex flex-col gap-2">
          {asks.map((ask) => (
            <li key={ask.id} className={cn(rowCard, "flex flex-col justify-center gap-0.5")}>
              <p className="line-clamp-2 text-sm break-words">
                <Phrasing text={ask.text} />
              </p>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Time iso={ask.time} className="shrink-0" />
                <span aria-hidden="true">·</span>
                <a href={cardPath(ask.card.id)} className="truncate underline-offset-4 hover:text-foreground hover:underline">
                  {ask.card.skill}
                </a>
                {ask.shelf.demo && <DemoChip />}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing here yet. Your messages show here, word for word, once one is on a card.</p>
      )}
    </Panel>
  );
}

export function LatestProven({ cards, className }: { cards: DeskCard[]; className?: string }) {
  return (
    <Panel title="Latest proven" description="Cards you passed a cold rep on, latest first." className={className}>
      {cards.length ? (
        <ol aria-label="Latest proven, latest first" className="flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.id} className={cn(rowCard, "flex items-center gap-3")}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <a href={cardPath(card.id)} className={cn(nameLink, "truncate")}>
                  {card.skill}
                </a>
                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span className="max-w-full truncate">{card.shelf.name}</span>
                  {card.shelf.demo && <DemoChip />}
                  {/* Each fact keeps its separator, so no line ends on a dangling dot. */}
                  {card.returnedAt && (
                    <span className="whitespace-nowrap">
                      <span aria-hidden="true">· </span>proven <Time iso={card.returnedAt} />
                    </span>
                  )}
                  {card.status === "borrowed_again" && (
                    <span className="whitespace-nowrap">
                      <span aria-hidden="true">· </span>asked again <Time iso={card.lastBorrowAt} />
                    </span>
                  )}
                </p>
              </div>
              <StatusPill status={card.status} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No card is proven yet. A card is marked Proven the day you pass a cold rep on it.</p>
      )}
    </Panel>
  );
}

/** Both panels at their real size while the desk loads. */
export function LatestLoading({ title, rows, className }: { title: string; rows: number; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={cn(rowCard, "flex flex-col justify-center gap-2")}>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
