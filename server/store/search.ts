// Search, as the store reads it: one account's phrasings with every word,
// and their cards. A word matches anywhere in a phrasing's text, as
// instr(lower(text), word) with the word lowercased from A to Z already
// (searchWords), so nothing needs escaping. Every query is scoped by the
// owner, and by the shelf when one is given, and all of them are read in
// one batch, so the counts, the cards, and the list agree.

import type { DeskBorrow, SearchAnswer, SearchPhrasing } from "@asked-before/sdk";
import { CARD_COLUMNS, CARD_TABLES, type CardRow } from "./cards";
import { iso, type Db } from "./db";
import { shelfOf, toDeskCard, type ShelfColumns } from "./desk";
import { ownsShelf } from "./shelves";

/** How many matching phrasings an answer lists at most. */
const LIST = 50;

type FoundRow = { id: string; source_id: string; text: string; time: number; card_id: string | null; skill: string | null; shelf_id: string } & ShelfColumns;

/**
 * The phrasings and cards of the account (or of its shelf `shelfId`) that
 * have every one of `words`; or null when the account has no such shelf.
 */
export async function search(db: Db, userId: string, q: string, words: string[], shelfId: string | null): Promise<SearchAnswer | null> {
  // ?1 the account, ?2 the shelf or null, ?3 on the words.
  const has = (column: string) => words.map((_, i) => `instr(lower(${column}), ?${i + 3}) > 0`).join(" AND ");
  const mine = "sh.user_id = ?1 AND (?2 IS NULL OR sh.id = ?2)";
  const bind = [userId, shelfId, ...words];

  const [counts, found, cards, owned] = await db.batch([
    db.prepare(`SELECT count(*) AS searched, coalesce(sum(${has("f.text")}), 0) AS total FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id WHERE ${mine}`).bind(...bind),
    db
      .prepare(
        `SELECT f.id, f.source_id, f.text, f.time, f.card_id, c.skill, sh.id AS shelf_id, sh.name AS shelf_name, sh.demo AS shelf_demo
         FROM phrasings f
         JOIN shelves sh ON sh.id = f.shelf_id
         LEFT JOIN cards c ON c.id = f.card_id
         WHERE ${mine} AND ${has("f.text")}
         ORDER BY f.time DESC, f.id DESC LIMIT ${LIST}`,
      )
      .bind(...bind),
    db
      .prepare(
        `SELECT ${CARD_COLUMNS}, sh.name AS shelf_name, sh.demo AS shelf_demo, coalesce(m.matches, 0) AS matches
         ${CARD_TABLES}
         LEFT JOIN (
           SELECT f.card_id, count(*) AS matches
           FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id
           WHERE ${mine} AND f.card_id IS NOT NULL AND ${has("f.text")}
           GROUP BY f.card_id
         ) m ON m.card_id = c.id
         WHERE ${mine} AND (m.matches IS NOT NULL OR (${has("c.skill")}))
         ORDER BY matches DESC, s.borrows DESC, s.last_borrow_at DESC, c.id`,
      )
      .bind(...bind),
    ...(shelfId === null ? [] : [ownsShelf(db, userId, shelfId)]),
  ]);
  if (owned && !owned.results.length) return null;

  const { searched, total } = counts!.results[0] as { searched: number; total: number };
  const matched = (cards!.results as (CardRow & ShelfColumns & { matches: number })[]).map((row) => ({ card: toDeskCard(row), matches: row.matches }));
  // Every matching phrasing on a card puts that card among the matches, so its status is there.
  const statusOf = new Map(matched.map(({ card }) => [card.id, card.status]));

  return {
    q,
    words,
    searched,
    total,
    cards: matched,
    phrasings: (found!.results as FoundRow[]).map(
      (row): SearchPhrasing => ({
        id: row.id,
        sourceId: row.source_id,
        text: row.text,
        time: iso(row.time),
        card: row.card_id === null ? null : ({ id: row.card_id, skill: row.skill!, status: statusOf.get(row.card_id)! } satisfies DeskBorrow["card"]),
        shelf: shelfOf(row),
      }),
    ),
  };
}
