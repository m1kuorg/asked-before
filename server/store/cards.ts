// Cards and unsorted phrasings, as the API reads them. A card's count,
// stamps, and status come from the card_status view, never from a stored
// number. Every query joins up to the shelf's owner, so another account's
// shelf or card reads as missing. What one answer shows is read in one
// batch, so a sort landing meanwhile can't half appear in it.

import type { Card, CardDetail, StoredPhrasing, UnsortedPage } from "@asked-before/sdk";
import { iso, type Db } from "./db";
import { REP_COLUMNS, toRep, type RepRow } from "./reps";
import { ownsShelf } from "./shelves";

export type CardRow = {
  id: string;
  shelf_id: string;
  skill: string;
  lesson: string | null;
  status: Card["status"];
  borrows: number;
  first_borrow_at: number;
  last_borrow_at: number;
  returned_at: number | null;
};

/** A card's columns as a CardRow, from cards as c and card_status as s. */
export const CARD_COLUMNS = "c.id, c.shelf_id, c.skill, c.lesson, s.status, s.borrows, s.first_borrow_at, s.last_borrow_at, s.returned_at";

/** Cards with their status, joined up to their shelf as sh, for its owner. */
export const CARD_TABLES = `
  FROM cards c
  JOIN card_status s ON s.card_id = c.id
  JOIN shelves sh ON sh.id = c.shelf_id`;

const SELECT = `SELECT ${CARD_COLUMNS} ${CARD_TABLES}`;

export const toCard = (row: CardRow): Card => ({
  id: row.id,
  shelfId: row.shelf_id,
  skill: row.skill,
  status: row.status,
  count: row.borrows,
  firstBorrowAt: iso(row.first_borrow_at),
  lastBorrowAt: iso(row.last_borrow_at),
  returnedAt: row.returned_at === null ? null : iso(row.returned_at),
});

export type PhrasingRow = { id: string; source_id: string; text: string; time: number };
export const toPhrasing = (row: PhrasingRow): StoredPhrasing => ({ id: row.id, sourceId: row.source_id, text: row.text, time: iso(row.time) });

/** The shelf's cards, most borrowed first, ties to the later last borrow; or null when the account has no such shelf. */
export async function listCards(db: Db, userId: string, shelfId: string): Promise<Card[] | null> {
  const [owned, cards] = await db.batch([
    ownsShelf(db, userId, shelfId),
    db.prepare(`${SELECT} WHERE c.shelf_id = ?2 AND sh.user_id = ?1 ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id`).bind(userId, shelfId),
  ]);
  return owned!.results.length ? (cards!.results as CardRow[]).map(toCard) : null;
}

const cardRow = (db: Db, userId: string, cardId: string) => db.prepare(`${SELECT} WHERE c.id = ?2 AND sh.user_id = ?1`).bind(userId, cardId);

/** One card with its status, as a list shows it; or null when the account has no such card. */
export async function findCard(db: Db, userId: string, cardId: string): Promise<Card | null> {
  const row = await cardRow(db, userId, cardId).first<CardRow>();
  return row && toCard(row);
}

/** One card with its lesson, its borrows oldest first, and its reps oldest first; or null when the account has no such card. */
export async function getCard(db: Db, userId: string, cardId: string): Promise<CardDetail | null> {
  const [card, borrows, reps] = await db.batch([
    cardRow(db, userId, cardId),
    db.prepare("SELECT id, source_id, text, time FROM phrasings WHERE card_id = ?1 ORDER BY time, id").bind(cardId),
    db.prepare(`SELECT ${REP_COLUMNS} FROM reps WHERE card_id = ?1 ORDER BY created_at, id`).bind(cardId),
  ]);
  const row = card!.results[0] as CardRow | undefined;
  if (!row) return null;
  return { ...toCard(row), lesson: row.lesson, borrows: (borrows!.results as PhrasingRow[]).map(toPhrasing), reps: (reps!.results as RepRow[]).map(toRep) };
}

/**
 * A page of the shelf's unsorted phrasings, newest first: those a sort
 * has seen that aren't on a card. One still waiting for its sort isn't
 * unsorted yet. Null when the account has no such shelf.
 */
export async function listUnsorted(db: Db, userId: string, shelfId: string, limit: number, cursor: string | undefined): Promise<UnsortedPage | null> {
  const [owned, page] = await db.batch([
    ownsShelf(db, userId, shelfId),
    db
      .prepare(
        `SELECT f.id, f.source_id, f.text, f.time FROM phrasings f
         WHERE f.shelf_id = ?2 AND f.card_id IS NULL AND f.offered_at IS NOT NULL
           AND (?3 IS NULL OR (f.time, f.id) < (SELECT time, id FROM phrasings WHERE id = ?3 AND shelf_id = ?2))
         ORDER BY f.time DESC, f.id DESC LIMIT ?4`,
      )
      .bind(userId, shelfId, cursor ?? null, limit + 1),
  ]);
  if (!owned!.results.length) return null;
  const rows = page!.results as PhrasingRow[];
  const phrasings = rows.slice(0, limit).map(toPhrasing);
  return { phrasings, next: rows.length > limit ? phrasings.at(-1)!.id : null };
}
