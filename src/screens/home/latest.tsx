// Home's two activity panels (docs/DESIGN.md, "Layout"), each a list of
// rule-separated rows on the panel, with no card of their own. "Latest asks",
// Home's right rail: your 10 newest messages on a card, word for word, each
// with its date and its card. "Latest proven", under Your shelves: the cards
// with a pass, latest first, with their status pill, the day they were
// proven, and "asked again <date>" when you asked after that.
import type { DeskBorrow, DeskCard } from "@asked-before/sdk";
import { cn } from "cn";
import { DemoChip } from "@/components/demo-chip";
import { Phrasing } from "@/components/phrasing";
import { StatusPill } from "@/components/status-pill";
import { Time } from "@/components/time";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, nameLink, ruleRow } from "./panel";

const cardPath = (id: string) => `/app/cards/${encodeURIComponent(id)}`;

export function LatestAsks({ asks, className }: { asks: DeskBorrow[]; className?: string }) {
  return (
    <Panel title="Latest asks" description="What you asked most recently, newest first, with the card each one is on." className={className}>
      {asks.length ? (
        <ol aria-label="Latest asks, newest first" className="flex flex-col">
          {asks.map((ask) => (
            // A little more air than the other lists' rows: each holds your words over a line of facts.
            <li key={ask.id} className={cn(ruleRow, "flex min-w-0 flex-col gap-0.5 py-2.75")}>
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

/** `next` is the card that tops Prove next: with nothing proven yet, the panel offers its cold rep, the way to a first pass. */
export function LatestProven({ cards, next, className }: { cards: DeskCard[]; next?: DeskCard; className?: string }) {
  return (
    <Panel title="Latest proven" description="Cards you passed a cold rep on, latest first." className={className}>
      {cards.length ? (
        <ol aria-label="Latest proven, latest first" className="flex flex-col">
          {cards.map((card) => (
            <li key={card.id} className={cn(ruleRow, "flex items-center gap-3")}>
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
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">No card is proven yet. A card is marked Proven the day you pass a cold rep on it.</p>
          {next && (
            <a href={`${cardPath(next.id)}?rep=start`} className={cn(nameLink, "underline underline-offset-4")}>
              Prove your first card: {next.skill}
            </a>
          )}
        </div>
      )}
    </Panel>
  );
}

/** A panel's rows at their real size while the desk loads. */
export function LatestLoading({ title, rows, className }: { title: string; rows: number; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <div aria-hidden="true" className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={cn(ruleRow, "flex flex-col gap-2")}>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
