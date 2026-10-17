// The sort's side of the store (server/sort.ts, ADR 0002): which upload a
// project sorts next and where its sort stands, the next batch of phrasings,
// the project's cards as the sort request shows them, and applying a
// checked answer. A sort works for the server, not for a caller, so these
// take a project or upload id rather than an account; the account comes
// from the project. Counts and stamps are never written: card_status
// derives them from the phrasings.

import { db, newId } from "./db";

/** An upload to sort, with the account its model requests count against. */
export type SortUpload = { id: string; projectId: string; userId: string };

/** A phrasing as a sort sees it: its id and its words, never its time. */
export type SortPhrasing = { id: string; text: string };

/** A card as a sort sees it: its skill and its first three borrows' words. */
export type SortCard = { id: string; skill: string; samples: string[] };

/** Where a checked answer puts a batch's phrasings: onto existing cards, or onto new ones, each with two or more. */
export type Placement = {
  joins: { cardId: string; phrasingIds: string[] }[];
  newCards: { skill: string; phrasingIds: string[] }[];
};

/** The project's next upload to sort: one a restart cut off, then the earliest finished of those waiting. */
export function nextUpload(projectId: string): SortUpload | null {
  return db
    .query(
      `SELECT u.id, u.project_id AS projectId, p.user_id AS userId
       FROM uploads u JOIN projects p ON p.id = u.project_id
       WHERE u.project_id = $projectId AND u.status IN ('sorting', 'waiting')
       ORDER BY u.status = 'sorting' DESC, u.finished_at, u.id
       LIMIT 1`,
    )
    .get({ projectId }) as SortUpload | null;
}

/** Every project with an upload sorting or waiting, as a restart left them. */
export function projectsToSort(): string[] {
  return (db.query("SELECT DISTINCT project_id FROM uploads WHERE status IN ('sorting', 'waiting')").all() as { project_id: string }[]).map((r) => r.project_id);
}

export function markSorting(uploadId: string): void {
  db.query("UPDATE uploads SET status = 'sorting', error = NULL WHERE id = $uploadId").run({ uploadId });
}

export function markSorted(uploadId: string): void {
  db.query("UPDATE uploads SET status = 'sorted', error = NULL WHERE id = $uploadId").run({ uploadId });
}

export function markFailed(uploadId: string, error: string): void {
  db.query("UPDATE uploads SET status = 'failed', error = $error WHERE id = $uploadId").run({ uploadId, error });
}

/**
 * The next batch: up to `size` of the upload's phrasings that no sort has
 * seen, oldest first, and the window (unsortedWindow).
 */
export function nextBatch(uploadId: string, projectId: string, size: number): { fresh: SortPhrasing[]; window: SortPhrasing[] } {
  const fresh = db
    .query("SELECT id, text FROM phrasings WHERE upload_id = $uploadId AND offered_at IS NULL ORDER BY time, id LIMIT $size")
    .all({ uploadId, size }) as SortPhrasing[];
  return { fresh, window: unsortedWindow(projectId, size) };
}

/** The window: up to `size` of the project's most recent unsorted phrasings, which a sort has seen but nothing yet matched. */
export function unsortedWindow(projectId: string, size: number): SortPhrasing[] {
  return db
    .query("SELECT id, text FROM phrasings WHERE project_id = $projectId AND card_id IS NULL AND offered_at IS NOT NULL ORDER BY time DESC, id DESC LIMIT $size")
    .all({ projectId, size }) as SortPhrasing[];
}

/** The project's cards, oldest first, each with up to three of its earliest borrows' words. */
export function sortCards(projectId: string): SortCard[] {
  const cards = db.query("SELECT id, skill FROM cards WHERE project_id = $projectId ORDER BY created_at, id").all({ projectId }) as { id: string; skill: string }[];
  const samples = db
    .query(
      `SELECT card_id, text FROM (
         SELECT card_id, text, row_number() OVER (PARTITION BY card_id ORDER BY time, id) AS n
         FROM phrasings WHERE project_id = $projectId AND card_id IS NOT NULL
       ) WHERE n <= 3 ORDER BY card_id, n`,
    )
    .all({ projectId }) as { card_id: string; text: string }[];
  return cards.map((card) => ({ ...card, samples: samples.filter((s) => s.card_id === card.id).map((s) => s.text) }));
}

const exists = db.query("SELECT 1 FROM uploads WHERE id = $uploadId");
const insertCard = db.query(
  "INSERT INTO cards (id, project_id, skill, created_at) VALUES ($id, $projectId, $skill, $now) ON CONFLICT (project_id, skill) DO NOTHING",
);
const cardNamed = db.query("SELECT id FROM cards WHERE project_id = $projectId AND skill = $skill");
// Only a phrasing still unsorted moves, and only onto a card of its own project that still exists.
const placeOne = db.query(`
  UPDATE phrasings SET card_id = $cardId
  WHERE id = $phrasingId AND project_id = $projectId AND card_id IS NULL
    AND EXISTS (SELECT 1 FROM cards WHERE id = $cardId AND project_id = $projectId)
`);
const offerOne = db.query("UPDATE phrasings SET offered_at = $now WHERE id = $phrasingId");
// A new card whose phrasings a capture placed elsewhere in the meantime keeps none of them under two.
const dropThin = db.query("DELETE FROM cards WHERE id = $cardId AND (SELECT count(*) FROM phrasings WHERE card_id = $cardId) < 2");

/**
 * Applies a checked answer to a batch in one transaction, and marks every
 * phrasing in the batch offered (placeBatch). False when the upload is
 * gone, its project deleted, so its sort stops.
 */
export function applyPlacement(uploadId: string, projectId: string, placement: Placement, batch: string[]): boolean {
  return db.transaction(() => {
    if (!exists.get({ uploadId })) return false;
    placeBatch(projectId, placement, batch);
    return true;
  })();
}

/**
 * Applies a checked answer to a batch, inside the caller's transaction, and
 * marks every phrasing in the batch offered. A new card named like one the
 * project has (ignoring case) joins it. A capture (store/captures.ts) is
 * placed through here too.
 */
export function placeBatch(projectId: string, placement: Placement, batch: string[]): void {
  const now = Date.now();
  const place = (cardId: string, phrasingIds: string[]) => {
    for (const phrasingId of phrasingIds) placeOne.run({ cardId, phrasingId, projectId });
  };
  for (const { cardId, phrasingIds } of placement.joins) place(cardId, phrasingIds);
  for (const { skill, phrasingIds } of placement.newCards) {
    const made = insertCard.run({ id: newId(), projectId, skill, now }).changes > 0;
    const cardId = (cardNamed.get({ projectId, skill }) as { id: string }).id;
    place(cardId, phrasingIds);
    if (made) dropThin.run({ cardId });
  }
  for (const phrasingId of batch) offerOne.run({ phrasingId, now });
}
