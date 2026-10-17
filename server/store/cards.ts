// Cards and unsorted phrasings, as the API reads them. A card's count,
// stamps, and status come from the card_status view, never from a stored
// number. Every query joins up to the project's owner, so another account's
// project or card reads as missing.

import type { Borrow, Card, CardDetail, UnsortedPage } from "@asked-before/sdk";
import { db, iso } from "./db";
import { REP_COLUMNS, toRep, type RepRow } from "./reps";

export type CardRow = {
  id: string;
  project_id: string;
  skill: string;
  lesson: string | null;
  status: Card["status"];
  borrows: number;
  first_borrow_at: number;
  last_borrow_at: number;
  returned_at: number | null;
};

const SELECT = `
  SELECT c.id, c.project_id, c.skill, c.lesson, s.status, s.borrows, s.first_borrow_at, s.last_borrow_at, s.returned_at
  FROM cards c
  JOIN card_status s ON s.card_id = c.id
  JOIN projects p ON p.id = c.project_id`;

export const toCard = (row: CardRow): Card => ({
  id: row.id,
  projectId: row.project_id,
  skill: row.skill,
  status: row.status,
  count: row.borrows,
  firstBorrowAt: iso(row.first_borrow_at),
  lastBorrowAt: iso(row.last_borrow_at),
  returnedAt: row.returned_at === null ? null : iso(row.returned_at),
});

type PhrasingRow = { id: string; source_id: string; text: string; time: number };
const toBorrow = (row: PhrasingRow): Borrow => ({ id: row.id, sourceId: row.source_id, text: row.text, time: iso(row.time) });

const ownsProject = (userId: string, projectId: string) =>
  db.query("SELECT 1 FROM projects WHERE id = $projectId AND user_id = $userId").get({ userId, projectId }) !== null;

/** The project's cards, most borrowed first, ties to the later last borrow; or null when the account has no such project. */
export function listCards(userId: string, projectId: string): Card[] | null {
  if (!ownsProject(userId, projectId)) return null;
  const rows = db
    .query(`${SELECT} WHERE c.project_id = $projectId AND p.user_id = $userId ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id`)
    .all({ userId, projectId }) as CardRow[];
  return rows.map(toCard);
}

const cardRow = (userId: string, cardId: string) => db.query(`${SELECT} WHERE c.id = $cardId AND p.user_id = $userId`).get({ userId, cardId }) as CardRow | null;

/** One card with its status, as a list shows it; or null when the account has no such card. */
export function findCard(userId: string, cardId: string): Card | null {
  const row = cardRow(userId, cardId);
  return row && toCard(row);
}

/** One card with its lesson, its borrows oldest first, and its reps oldest first; or null when the account has no such card. */
export function getCard(userId: string, cardId: string): CardDetail | null {
  const row = cardRow(userId, cardId);
  if (!row) return null;
  const borrows = db.query("SELECT id, source_id, text, time FROM phrasings WHERE card_id = $cardId ORDER BY time, id").all({ cardId }) as PhrasingRow[];
  const reps = db.query(`SELECT ${REP_COLUMNS} FROM reps WHERE card_id = $cardId ORDER BY created_at, id`).all({ cardId }) as RepRow[];
  return { ...toCard(row), lesson: row.lesson, borrows: borrows.map(toBorrow), reps: reps.map(toRep) };
}

/**
 * A page of the project's unsorted phrasings, newest first: those a sort
 * has seen that aren't on a card. One still waiting for its sort isn't
 * unsorted yet. Null when the account has no such project.
 */
export function listUnsorted(userId: string, projectId: string, limit: number, cursor: string | undefined): UnsortedPage | null {
  if (!ownsProject(userId, projectId)) return null;
  const rows = db
    .query(
      `SELECT f.id, f.source_id, f.text, f.time FROM phrasings f
       WHERE f.project_id = $projectId AND f.card_id IS NULL AND f.offered_at IS NOT NULL
         AND ($cursor IS NULL OR (f.time, f.id) < (SELECT time, id FROM phrasings WHERE id = $cursor AND project_id = $projectId))
       ORDER BY f.time DESC, f.id DESC LIMIT $take`,
    )
    .all({ projectId, cursor: cursor ?? null, take: limit + 1 }) as PhrasingRow[];
  const phrasings = rows.slice(0, limit).map(toBorrow);
  return { phrasings, next: rows.length > limit ? phrasings.at(-1)!.id : null };
}
