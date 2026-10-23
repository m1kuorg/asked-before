// Each listed card's every ask, fetched after the list draws (cards.get, its
// borrows), so a row can trade its ask span for one dot per ask once its card
// arrives: every card carries its own history (brief section 3). Requests go
// in the list's order, at most 4 at a time, and all are aborted when `signal`
// is (the learner leaves the screen) or the list unmounts. A card already
// fetched isn't asked for again unless its count or last ask has changed; a
// card whose request fails keeps its span. Pass only the rows worth the
// requests (Home's Prove next, the first 25 of a shelf's filter).
//
//   const timesOf = useAskTimes(rows, signal);
//   const times = timesOf(card); // undefined until it arrives

import type { Card } from "@asked-before/sdk";
import { useEffect, useRef, useState } from "react";
import { clientFor } from "@/lib/client";

const AT_ONCE = 4;

/** A card as it was listed: a new ask changes its count and its last ask, and so its key. */
const keyOf = (card: Card) => `${card.id} ${card.count} ${card.lastBorrowAt}`;

type Queue = { client: ReturnType<typeof clientFor>; signal: AbortSignal; waiting: Card[]; running: number; started: Set<string> };

export function useAskTimes(cards: Card[], signal: AbortSignal): (card: Card) => string[] | undefined {
  const [times, setTimes] = useState<ReadonlyMap<string, string[]>>(() => new Map());
  const queue = useRef<Queue | null>(null);
  const wanted = cards.map(keyOf).join("\n");
  const latest = useRef(cards);
  latest.current = cards;

  // One queue per mount, aborted with the screen or when the list goes.
  useEffect(() => {
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal.addEventListener("abort", stop);
    if (signal.aborted) stop();
    queue.current = { client: clientFor(controller.signal), signal: controller.signal, waiting: [], running: 0, started: new Set() };
    return () => {
      signal.removeEventListener("abort", stop);
      stop();
      queue.current = null;
    };
  }, [signal]);

  // The rows wanted now replace any not yet started; requests already running finish.
  useEffect(() => {
    const q = queue.current;
    if (!q) return;
    q.waiting = latest.current.filter((card) => !q.started.has(keyOf(card)));
    const pump = () => {
      while (q.running < AT_ONCE && q.waiting.length && !q.signal.aborted) {
        const card = q.waiting.shift()!;
        const key = keyOf(card);
        q.started.add(key);
        q.running++;
        q.client.cards
          .get(card.id)
          .then(
            (detail) => {
              if (!q.signal.aborted) setTimes((before) => new Map(before).set(key, detail.borrows.map((ask) => ask.time)));
            },
            () => {},
          )
          .finally(() => {
            q.running--;
            pump();
          });
      }
    };
    pump();
  }, [wanted, signal]);

  return (card) => times.get(keyOf(card));
}
