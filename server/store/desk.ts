// The Desk, as the store reads it (m1kuorg/basics#47): one account's
// cards across all its shelves. Every count, stamp, and status comes from
// the card_status view, as the shelves' own counts do, so the totals add
// up to theirs. Every query is scoped by the owner, and all of them are
// read in one batch, so the lists and the totals agree.

import type { Desk, DeskBorrow, DeskCard, DeskShelf } from "@asked-before/sdk";
import { CARD_COLUMNS, CARD_TABLES, toCard, type CardRow } from "./cards";
import { iso, type Db } from "./db";
import { STATUS_COUNTS } from "./shelves";

/** How many items each of the Desk's lists holds at most. */
const LIST = 10;

type ShelfColumns = { shelf_name: string; shelf_demo: 0 | 1 };

const shelfOf = (row: { shelf_id: string } & ShelfColumns): DeskShelf => ({ id: row.shelf_id, name: row.shelf_name, demo: row.shelf_demo === 1 });

const CARDS = `SELECT ${CARD_COLUMNS}, sh.name AS shelf_name, sh.demo AS shelf_demo ${CARD_TABLES} WHERE sh.user_id = ?1`;

const toDeskCard = (row: CardRow & ShelfColumns): DeskCard => ({ ...toCard(row), shelf: shelfOf(row) });

type BorrowRow = {
  id: string;
  source_id: string;
  text: string;
  time: number;
  card_id: string;
  skill: string;
  status: DeskBorrow["card"]["status"];
  shelf_id: string;
} & ShelfColumns;

export async function getDesk(db: Db, userId: string): Promise<Desk> {
  const [count, sums, most, returns, borrows] = await db.batch([
    db.prepare("SELECT count(*) AS shelves FROM shelves WHERE user_id = ?1").bind(userId),
    db
      .prepare(
        `SELECT ${STATUS_COUNTS}
         FROM card_status s JOIN shelves sh ON sh.id = s.shelf_id
         WHERE sh.user_id = ?1`,
      )
      .bind(userId),
    db.prepare(`${CARDS} AND s.status <> 'returned' ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id LIMIT ${LIST}`).bind(userId),
    db.prepare(`${CARDS} AND s.returned_at IS NOT NULL ORDER BY s.returned_at DESC, c.id DESC LIMIT ${LIST}`).bind(userId),
    db
      .prepare(
        `SELECT f.id, f.source_id, f.text, f.time, c.id AS card_id, c.skill, s.status,
           sh.id AS shelf_id, sh.name AS shelf_name, sh.demo AS shelf_demo
         FROM phrasings f
         JOIN cards c ON c.id = f.card_id
         JOIN card_status s ON s.card_id = c.id
         JOIN shelves sh ON sh.id = c.shelf_id
         WHERE sh.user_id = ?1
         ORDER BY f.time DESC, f.id DESC LIMIT ${LIST}`,
      )
      .bind(userId),
  ]);
  const { shelves } = count!.results[0] as { shelves: number };
  const totals = sums!.results[0] as Desk["totals"];
  const mostBorrowed = most!.results as (CardRow & ShelfColumns)[];
  const latestReturns = returns!.results as (CardRow & ShelfColumns)[];
  const latestBorrows = borrows!.results as BorrowRow[];

  return {
    shelves,
    totals,
    mostBorrowed: mostBorrowed.map(toDeskCard),
    latestBorrows: latestBorrows.map(
      (row): DeskBorrow => ({
        id: row.id,
        sourceId: row.source_id,
        text: row.text,
        time: iso(row.time),
        card: { id: row.card_id, skill: row.skill, status: row.status },
        shelf: shelfOf(row),
      }),
    ),
    latestReturns: latestReturns.map(toDeskCard),
  };
}
