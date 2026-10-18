// The sort's side of the store (server/sort.ts, ADR 0002): which upload a
// shelf sorts next and where its sort stands, the next batch of phrasings,
// the shelf's cards as the sort request shows them, and applying a
// checked answer. A sort works for the server, not for a caller, so these
// take a shelf or upload id rather than an account; the account comes
// from the shelf. Counts and stamps are never written: card_status
// derives them from the phrasings. On D1, applying an answer is one batch
// whose every statement holds only while the upload it sorts (or the
// capture it places) is still there, with its lists of phrasings and cards
// read through json_each.

import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { newId, slices, type Db } from "./db";

/** An upload to sort, with the account its model requests count against. */
export type SortUpload = { id: string; shelfId: string; userId: string };

/** A phrasing as a sort sees it: its id and its words, never its time. */
export type SortPhrasing = { id: string; text: string };

/** A card as a sort sees it: its skill and its first three borrows' words. */
export type SortCard = { id: string; skill: string; samples: string[] };

/** Where a checked answer puts a batch's phrasings: onto existing cards, or onto new ones, each with two or more. */
export type Placement = {
  joins: { cardId: string; phrasingIds: string[] }[];
  newCards: { skill: string; phrasingIds: string[] }[];
};

/** The row a placement holds to: the upload being sorted, or the capture just stored. While it's gone, nothing is placed. */
export type Holder = { upload: string } | { capture: string };

/** Whether any upload of shelf ?1 is still to sort: cut off mid-sort, or waiting its turn. */
const UNSORTED_UPLOAD = "SELECT EXISTS (SELECT 1 FROM uploads WHERE shelf_id = ?1 AND status IN ('sorting', 'waiting')) AS more";

/**
 * Marks the shelf's next upload sorting and returns it: one a restart cut
 * off, then the earliest finished of those waiting. Null when none waits,
 * as when the shelf, or its account, is gone.
 */
export async function startNext(db: Db, shelfId: string): Promise<SortUpload | null> {
  return db
    .prepare(
      `UPDATE uploads SET status = 'sorting', error = NULL
       WHERE id = (
         SELECT id FROM uploads WHERE shelf_id = ?1 AND status IN ('sorting', 'waiting')
         ORDER BY status = 'sorting' DESC, finished_at, id LIMIT 1
       )
       RETURNING id, shelf_id AS shelfId, (SELECT user_id FROM shelves WHERE shelves.id = uploads.shelf_id) AS userId`,
    )
    .bind(shelfId)
    .first<SortUpload>();
}

/**
 * The shelves with an upload waiting or sorting that has made no progress
 * since `before`: its latest progress is the last batch of it offered, or
 * else its finish.
 */
export async function stalledShelves(db: Db, before: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT shelf_id AS shelfId FROM uploads u
       WHERE status IN ('waiting', 'sorting')
         AND coalesce((SELECT max(offered_at) FROM phrasings WHERE upload_id = u.id), finished_at) < ?1`,
    )
    .bind(before)
    .all<{ shelfId: string }>();
  return results.map((row) => row.shelfId);
}

/** The window: up to `size` of the shelf's most recent unsorted phrasings, which a sort has seen but nothing yet matched. */
const windowOf = (db: Db, shelfId: string, size: number) =>
  db
    .prepare("SELECT id, text FROM phrasings WHERE shelf_id = ?1 AND card_id IS NULL AND offered_at IS NOT NULL ORDER BY time DESC, id DESC LIMIT ?2")
    .bind(shelfId, size);

/** The shelf's cards, oldest first, and each one's first three borrows' words. */
const cardsOf = (db: Db, shelfId: string) => [
  db.prepare("SELECT id, skill FROM cards WHERE shelf_id = ?1 ORDER BY created_at, id").bind(shelfId),
  db
    .prepare(
      `SELECT card_id, text FROM (
         SELECT card_id, text, row_number() OVER (PARTITION BY card_id ORDER BY time, id) AS n
         FROM phrasings WHERE shelf_id = ?1 AND card_id IS NOT NULL
       ) WHERE n <= 3 ORDER BY card_id, n`,
    )
    .bind(shelfId),
];

const toCards = (cards: unknown[], samples: unknown[]): SortCard[] =>
  (cards as { id: string; skill: string }[]).map((card) => ({
    ...card,
    samples: (samples as { card_id: string; text: string }[]).filter((s) => s.card_id === card.id).map((s) => s.text),
  }));

/**
 * The next batch, read at once: up to `size` of the upload's phrasings
 * that no sort has seen, oldest first; the window; and the shelf's cards.
 */
export async function nextBatch(db: Db, upload: SortUpload, size: number): Promise<{ fresh: SortPhrasing[]; window: SortPhrasing[]; cards: SortCard[] }> {
  const [fresh, window, cards, samples] = await db.batch([
    db.prepare("SELECT id, text FROM phrasings WHERE upload_id = ?1 AND offered_at IS NULL ORDER BY time, id LIMIT ?2").bind(upload.id, size),
    windowOf(db, upload.shelfId, size),
    ...cardsOf(db, upload.shelfId),
  ]);
  return { fresh: fresh!.results as SortPhrasing[], window: window!.results as SortPhrasing[], cards: toCards(cards!.results, samples!.results) };
}

/** What a capture's sort is asked against, read at once: the shelf's cards, and its window of `size`. */
export async function captureView(db: Db, shelfId: string, size: number): Promise<{ cards: SortCard[]; window: SortPhrasing[] }> {
  const [window, cards, samples] = await db.batch([windowOf(db, shelfId, size), ...cardsOf(db, shelfId)]);
  return { window: window!.results as SortPhrasing[], cards: toCards(cards!.results, samples!.results) };
}

/**
 * Applies a checked answer to a batch in one batch, and marks every
 * phrasing in it offered (placeBatch); then the upload is sorted once none
 * of its phrasings is left unoffered. Whether any upload of the shelf is
 * still to sort, this one or another; none is when the upload is gone,
 * its shelf deleted, which stops its sort.
 */
export async function applyPlacement(db: Db, upload: SortUpload, placement: Placement, batch: string[]): Promise<boolean> {
  const results = await db.batch([
    ...placeBatch(db, upload.shelfId, placement, batch, { upload: upload.id }),
    db
      .prepare(
        `UPDATE uploads SET status = 'sorted', error = NULL
         WHERE id = ?1 AND status = 'sorting' AND NOT EXISTS (SELECT 1 FROM phrasings WHERE upload_id = ?1 AND offered_at IS NULL)`,
      )
      .bind(upload.id),
    db.prepare(UNSORTED_UPLOAD).bind(upload.shelfId),
  ]);
  return (results.at(-1)!.results[0] as { more: number }).more === 1;
}

/** Records why the upload's sort failed. Whether another upload of the shelf waits to be sorted. */
export async function markFailed(db: Db, upload: SortUpload, error: string): Promise<boolean> {
  const [, more] = await db.batch([
    db.prepare("UPDATE uploads SET status = 'failed', error = ?2 WHERE id = ?1 AND status = 'sorting'").bind(upload.id, error),
    db.prepare(UNSORTED_UPLOAD).bind(upload.shelfId),
  ]);
  return (more!.results[0] as { more: number }).more === 1;
}

/**
 * The statements that apply a checked answer to a batch, for the caller's
 * batch, and mark every phrasing in it offered. Each holds only while
 * `holder` is there. Only a phrasing still unsorted moves, and only onto a
 * card of its own shelf. A new card named like one the shelf has (ignoring
 * case) joins it, and a new card whose phrasings went elsewhere meanwhile,
 * by a capture, is dropped when it's left with fewer than two. A capture
 * (store/captures.ts) is placed through here too.
 */
export function placeBatch(db: Db, shelfId: string, placement: Placement, batch: string[], holder: Holder): D1PreparedStatement[] {
  const now = Date.now();
  const [table, holderId] = "upload" in holder ? ["uploads", holder.upload] : ["phrasings", holder.capture];
  const holds = `EXISTS (SELECT 1 FROM ${table} WHERE id = ?3)`;
  const each = (rows: unknown[], sql: string, ...more: unknown[]) => slices(rows).map((list) => db.prepare(sql).bind(list, shelfId, holderId, ...more));

  const newCards = placement.newCards.map((card) => ({ ...card, id: newId() }));
  return [
    // Each row is [phrasing, card].
    ...each(
      placement.joins.flatMap(({ cardId, phrasingIds }) => phrasingIds.map((id) => [id, cardId])),
      `UPDATE phrasings SET card_id = j.value ->> 1
       FROM json_each(?1) j
       WHERE phrasings.id = j.value ->> 0 AND phrasings.shelf_id = ?2 AND phrasings.card_id IS NULL
         AND EXISTS (SELECT 1 FROM cards c WHERE c.id = j.value ->> 1 AND c.shelf_id = ?2) AND ${holds}`,
    ),
    // Each row is [new card, skill]; the skill's NOCASE collation makes a name like a card's that card.
    ...each(
      newCards.map(({ id, skill }) => [id, skill]),
      `INSERT INTO cards (id, shelf_id, skill, created_at)
       SELECT j.value ->> 0, ?2, j.value ->> 1, ?4 FROM json_each(?1) j WHERE ${holds}
       ON CONFLICT (shelf_id, skill) DO NOTHING`,
      now,
    ),
    // Each row is [phrasing, skill], onto the card of that name.
    ...each(
      newCards.flatMap(({ skill, phrasingIds }) => phrasingIds.map((id) => [id, skill])),
      `UPDATE phrasings SET card_id = c.id
       FROM json_each(?1) j JOIN cards c ON c.shelf_id = ?2 AND c.skill = j.value ->> 1
       WHERE phrasings.id = j.value ->> 0 AND phrasings.shelf_id = ?2 AND phrasings.card_id IS NULL AND ${holds}`,
    ),
    // Only the cards made here: a new card's id is one no earlier card has.
    ...each(
      newCards.map(({ id }) => id),
      `DELETE FROM cards WHERE id IN (SELECT value FROM json_each(?1)) AND shelf_id = ?2 AND ${holds}
         AND (SELECT count(*) FROM phrasings WHERE card_id = cards.id) < 2`,
    ),
    ...each(batch, `UPDATE phrasings SET offered_at = ?4 WHERE id IN (SELECT value FROM json_each(?1)) AND shelf_id = ?2 AND ${holds}`, now),
  ];
}
