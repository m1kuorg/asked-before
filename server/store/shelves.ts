// Shelves, each with its card counts by status (from the card_status view)
// and its last upload time. Every query is scoped by the owner, so another
// account's shelf reads as missing.

import type { Shelf } from "@asked-before/sdk";
import { db, iso, newId } from "./db";

type Row = {
  id: string;
  name: string;
  demo: 0 | 1;
  created_at: number;
  last_upload_at: number | null;
} & Shelf["counts"];

/** Cards' counts by status, from card_status as s, in a shelf's counts' shape; the Desk's totals add them up the same way. */
export const STATUS_COUNTS = `
    count(s.card_id) AS cards,
    coalesce(sum(s.status = 'borrowed'), 0) AS borrowed,
    coalesce(sum(s.status = 'returned'), 0) AS returned,
    coalesce(sum(s.status = 'borrowed_again'), 0) AS borrowedAgain`;

const SELECT = `
  SELECT
    sh.id, sh.name, sh.demo, sh.created_at, ${STATUS_COUNTS},
    (SELECT max(u.created_at) FROM uploads u WHERE u.shelf_id = sh.id) AS last_upload_at
  FROM shelves sh
  LEFT JOIN card_status s ON s.shelf_id = sh.id`;

const toShelf = (row: Row): Shelf => ({
  id: row.id,
  name: row.name,
  demo: row.demo === 1,
  createdAt: iso(row.created_at),
  counts: { cards: row.cards, borrowed: row.borrowed, returned: row.returned, borrowedAgain: row.borrowedAgain },
  lastUploadAt: row.last_upload_at === null ? null : iso(row.last_upload_at),
});

/** Whether the account has the shelf. */
export const ownsShelf = (userId: string, shelfId: string) =>
  db.query("SELECT 1 FROM shelves WHERE id = $shelfId AND user_id = $userId").get({ userId, shelfId }) !== null;

/** The account's shelves, oldest first. */
export function listShelves(userId: string): Shelf[] {
  const rows = db.query(`${SELECT} WHERE sh.user_id = $userId GROUP BY sh.id ORDER BY sh.created_at, sh.id`).all({ userId }) as Row[];
  return rows.map(toShelf);
}

export function getShelf(userId: string, shelfId: string): Shelf | null {
  const row = db
    .query(`${SELECT} WHERE sh.user_id = $userId AND sh.id = $shelfId GROUP BY sh.id`)
    .get({ userId, shelfId }) as Row | null;
  return row && toShelf(row);
}

export function createShelf(userId: string, name: string, demo: boolean): Shelf {
  const id = newId();
  db.query("INSERT INTO shelves (id, user_id, name, demo, created_at) VALUES ($id, $userId, $name, $demo, $now)").run({
    id,
    userId,
    name,
    demo: demo ? 1 : 0,
    now: Date.now(),
  });
  return getShelf(userId, id)!;
}

/** The renamed shelf, or null when the account has no such shelf. */
export function renameShelf(userId: string, shelfId: string, name: string): Shelf | null {
  db.query("UPDATE shelves SET name = $name WHERE id = $shelfId AND user_id = $userId").run({ userId, shelfId, name });
  return getShelf(userId, shelfId);
}

/** Deletes the shelf and, by cascade, everything in it. False when the account has no such shelf. */
export function deleteShelf(userId: string, shelfId: string): boolean {
  return db.query("DELETE FROM shelves WHERE id = $shelfId AND user_id = $userId").run({ userId, shelfId }).changes > 0;
}
