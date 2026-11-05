// Under each shelf's row on the Shelves list: the most asked of its cards
// that need a cold rep, at most 3, each a link to the card with its ask span
// and "asked 9 times", then "2 more on Demo" when there are more. Every span
// on the page shares one axis (the earliest first ask shown to today), so the
// strips line up from shelf to shelf; they draw once every shelf's cards are
// in, so the axis never moves under them, and until then each list holds its
// rows as flat bars at their real size. The lists come from cards.list, one
// request per shelf with a cold rep to do, all at once after the shelves
// draw, and aborted when the learner leaves. A list that fails says so in its
// own row, with Try again when that can help.
import type { Card, Shelf } from "@asked-before/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { AskStrip, askAxis, type Axis } from "@/components/ask-strip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canRetry, clientFor, messageOf } from "@/lib/client";
import { askedTimes, count } from "@/lib/format";
import { needsRep } from "@/lib/status";

/** How many of a shelf's cards that need a cold rep show under it. */
const TOP = 3;

/** A shelf's cards that need a cold rep: To prove plus Asked since proven. */
export const needOf = (shelf: Shelf) => shelf.counts.borrowed + shelf.counts.borrowedAgain;

/** A shelf as it was listed: its need changes when a card is proven or asked again, and so its key. */
const keyOf = (shelf: Shelf) => `${shelf.id} ${needOf(shelf)} ${shelf.counts.cards}`;

type Top = { cards: Card[] } | { error: unknown };
export type TopCards = { of: (shelf: Shelf) => Top | undefined; axis: Axis | null; retry: (shelf: Shelf) => void };

export function useTopCards(shelves: Shelf[] | undefined, signal: AbortSignal): TopCards {
  const [tops, setTops] = useState<ReadonlyMap<string, Top>>(() => new Map());
  const [attempt, setAttempt] = useState(0);
  const started = useRef(new Set<string>());
  const wanted = (shelves ?? []).filter((shelf) => needOf(shelf) > 0);
  const keys = wanted.map(keyOf).join("\n");
  const latest = useRef(wanted);
  latest.current = wanted;

  useEffect(() => {
    if (signal.aborted) return;
    const client = clientFor(signal);
    for (const shelf of latest.current) {
      const key = keyOf(shelf);
      if (started.current.has(key)) continue;
      started.current.add(key);
      client.cards.list(shelf.id).then(
        (cards) => !signal.aborted && setTops((before) => new Map(before).set(key, { cards: cards.filter((card) => needsRep(card.status)).slice(0, TOP) })),
        (error: unknown) => !signal.aborted && setTops((before) => new Map(before).set(key, { error })),
      );
    }
  }, [keys, attempt, signal]);

  const retry = useCallback((shelf: Shelf) => {
    started.current.delete(keyOf(shelf));
    setTops((before) => {
      const after = new Map(before);
      after.delete(keyOf(shelf));
      return after;
    });
    setAttempt((n) => n + 1);
  }, []);

  const loaded = wanted.map((shelf) => tops.get(keyOf(shelf)));
  const ready = loaded.every((top) => top !== undefined);
  const firsts = loaded.flatMap((top) => (top && "cards" in top ? top.cards.map((card) => card.firstBorrowAt) : []));
  return { of: (shelf) => tops.get(keyOf(shelf)), axis: ready && firsts.length ? askAxis(firsts) : null, retry };
}

// Skill, strip, times asked. 640px and up: one line; under it, the strip goes under the skill.
const ROW = "grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_7rem] sm:gap-x-6";

/** The list under a shelf's row: its top cards, flat bars while they load, or what went wrong. */
export function TopCardsList({ shelf, top, axis, onRetry }: { shelf: Shelf; top: Top | undefined; axis: Axis | null; onRetry: () => void }) {
  const need = needOf(shelf);
  const more = need - Math.min(need, TOP);
  const path = `/app/shelves/${encodeURIComponent(shelf.id)}`;

  if (top && "error" in top) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-x-2 py-1.5 text-xs text-muted-foreground">
        The cards on {shelf.name} that need a cold rep didn't load. {messageOf(top.error)}
        {canRetry(top.error) && (
          <Button variant="link" size="xs" onClick={onRetry}>
            Try again
          </Button>
        )}
      </p>
    );
  }

  if (!top || !axis) {
    return (
      <div aria-hidden="true">
        {Array.from({ length: Math.min(need, TOP) }, (_, i) => (
          <div key={i} className={ROW}>
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="h-3 w-20 justify-self-end" />
            <Skeleton className="col-span-2 h-1 sm:col-span-1 sm:col-start-2 sm:row-start-1" />
          </div>
        ))}
        {more > 0 && <Skeleton className="my-2 h-3 w-24" />}
      </div>
    );
  }

  return (
    <div>
      <ul aria-label={`Cards on ${shelf.name} that need a cold rep, most asked first`}>
        {top.cards.map((card) => (
          <li key={card.id} className={ROW}>
            <a href={`/app/cards/${encodeURIComponent(card.id)}`} className="truncate text-foreground underline-offset-4 hover:underline">
              {card.skill}
            </a>
            <span className="text-right text-xs whitespace-nowrap text-muted-foreground sm:col-start-3 sm:row-start-1">{askedTimes(card.count)}</span>
            <AskStrip axis={axis} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} showCount={false} className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1" />
          </li>
        ))}
      </ul>
      {more > 0 && (
        <a href={path} className="inline-block py-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {count(more)} more on {shelf.name}
          <span className="sr-only"> that {more === 1 ? "needs" : "need"} a cold rep</span>
        </a>
      )}
    </div>
  );
}
