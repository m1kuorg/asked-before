// Shelves, each with its card counts by status (from the card_status view)
// and its last upload time. Every query is scoped by the owner, so another
// account's shelf reads as missing.

import type { Shelf } from "@asked-before/sdk";
import { iso, newId, type Db } from "./db";

export type ShelfRow = {
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

/** One shelf of the account's, as ?1 (the account) and ?2 (the shelf). */
const ONE_SHELF = `${SELECT} WHERE sh.user_id = ?1 AND sh.id = ?2 GROUP BY sh.id`;

export const toShelf = (row: ShelfRow): Shelf => ({
  id: row.id,
  name: row.name,
  demo: row.demo === 1,
  createdAt: iso(row.created_at),
  counts: { cards: row.cards, borrowed: row.borrowed, returned: row.returned, borrowedAgain: row.borrowedAgain },
  lastUploadAt: row.last_upload_at === null ? null : iso(row.last_upload_at),
});

/** The account's (?1) shelves, oldest first, as the API lists them and the download (store/account-data.ts) reads them. */
export const ACCOUNT_SHELVES = `${SELECT} WHERE sh.user_id = ?1 GROUP BY sh.id ORDER BY sh.created_at, sh.id`;

/** The account's shelves, oldest first. */
export async function listShelves(db: Db, userId: string): Promise<Shelf[]> {
  const { results } = await db.prepare(ACCOUNT_SHELVES).bind(userId).all<ShelfRow>();
  return results.map(toShelf);
}

export async function getShelf(db: Db, userId: string, shelfId: string): Promise<Shelf | null> {
  const row = await db.prepare(ONE_SHELF).bind(userId, shelfId).first<ShelfRow>();
  return row && toShelf(row);
}

/** The new shelf, made and read back in one batch; null when the account is gone. */
export async function createShelf(db: Db, userId: string, name: string, demo: boolean): Promise<Shelf | null> {
  const id = newId();
  const [, read] = await db.batch<ShelfRow>([
    db.prepare("INSERT INTO shelves (id, user_id, name, demo, created_at) SELECT ?2, id, ?3, ?4, ?5 FROM users WHERE id = ?1").bind(userId, id, name, demo ? 1 : 0, Date.now()),
    db.prepare(ONE_SHELF).bind(userId, id),
  ]);
  const row = read?.results[0];
  return row ? toShelf(row) : null;
}

/** The renamed shelf, renamed and read back in one batch, or null when the account has no such shelf. */
export async function renameShelf(db: Db, userId: string, shelfId: string, name: string): Promise<Shelf | null> {
  const [, read] = await db.batch<ShelfRow>([
    db.prepare("UPDATE shelves SET name = ?3 WHERE id = ?2 AND user_id = ?1").bind(userId, shelfId, name),
    db.prepare(ONE_SHELF).bind(userId, shelfId),
  ]);
  const row = read?.results[0];
  return row ? toShelf(row) : null;
}

/** Deletes the shelf and, by cascade, everything in it. False when the account has no such shelf. */
export async function deleteShelf(db: Db, userId: string, shelfId: string): Promise<boolean> {
  const { meta } = await db.prepare("DELETE FROM shelves WHERE id = ?2 AND user_id = ?1").bind(userId, shelfId).run();
  return meta.changes > 0;
}
