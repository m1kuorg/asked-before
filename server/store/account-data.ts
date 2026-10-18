// All of an account's data, for its download (m1kuorg/basics#49): the
// account, and each shelf with its uploads, every phrasing in it, and its
// cards with their lessons and cold reps. Shelves, uploads, cards, and reps
// are read with the same columns and the same mappers the API answers with,
// so the download matches what the API shows; the phrasings are read here,
// all of them, whether on a card, unsorted, or still waiting for their sort.
// On D1 (m1kuorg/basics#63) it's one batch, so a sort or a rep landing
// meanwhile can't half appear, of six statements whatever the account holds:
// one per kind of row, never one per shelf or card, so it stays far inside
// D1's queries per request, and each row is one item, so no value comes near
// D1's 2 MB. The rows are grouped by shelf and card here. API keys,
// sessions, and the password hash are never in it.

import type { AccountData, CardData, PhrasingData } from "@asked-before/sdk";
import { CARD_COLUMNS, CARD_TABLES, toCard, toPhrasing, type CardRow, type PhrasingRow } from "./cards";
import { iso, type Db } from "./db";
import { REP_COLUMNS, toRep, type RepRow } from "./reps";
import { ACCOUNT_SHELVES, toShelf, type ShelfRow } from "./shelves";
import { ACCOUNT_UPLOADS, toUpload, type UploadRow } from "./uploads";
import { ACCOUNT, toAccount, type AccountRow } from "./users";

type DataRow = PhrasingRow & { shelf_id: string; origin: PhrasingData["origin"]; upload_id: string | null; card_id: string | null };

const toPhrasingData = (row: DataRow): PhrasingData => ({ ...toPhrasing(row), origin: row.origin, uploadId: row.upload_id, cardId: row.card_id });

/** Rows grouped by a key, each group in the rows' own order. */
function groupBy<T, U>(rows: T[], key: (row: T) => string, map: (row: T) => U): Map<string, U[]> {
  const groups = new Map<string, U[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(map(row));
    else groups.set(k, [map(row)]);
  }
  return groups;
}

/** The account's data, or null when it has no account. */
export async function accountData(db: Db, userId: string): Promise<AccountData | null> {
  const [account, shelves, uploads, phrasings, cards, reps] = await db.batch([
    db.prepare(ACCOUNT).bind(userId),
    db.prepare(ACCOUNT_SHELVES).bind(userId),
    db.prepare(ACCOUNT_UPLOADS).bind(userId),
    db
      .prepare(
        `SELECT f.id, f.shelf_id, f.source_id, f.text, f.time, f.origin, f.upload_id, f.card_id
         FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id
         WHERE sh.user_id = ?1 ORDER BY f.time, f.id`,
      )
      .bind(userId),
    // In the stack's order, as cards.list sets each shelf's.
    db.prepare(`SELECT ${CARD_COLUMNS} ${CARD_TABLES} WHERE sh.user_id = ?1 ORDER BY s.borrows DESC, s.last_borrow_at DESC, c.id`).bind(userId),
    db
      .prepare(
        `SELECT card_id, ${REP_COLUMNS} FROM reps
         WHERE card_id IN (SELECT c.id FROM cards c JOIN shelves sh ON sh.id = c.shelf_id WHERE sh.user_id = ?1)
         ORDER BY created_at, id`,
      )
      .bind(userId),
  ]);
  const accountRow = account!.results[0] as AccountRow | undefined;
  if (!accountRow) return null;

  const repsOf = groupBy(reps!.results as (RepRow & { card_id: string })[], (row) => row.card_id, toRep);
  const uploadsOf = groupBy(uploads!.results as UploadRow[], (row) => row.shelf_id, toUpload);
  const phrasingsOf = groupBy(phrasings!.results as DataRow[], (row) => row.shelf_id, toPhrasingData);
  const cardsOf = groupBy(
    cards!.results as CardRow[],
    (row) => row.shelf_id,
    (row): CardData => ({ ...toCard(row), lesson: row.lesson, reps: repsOf.get(row.id) ?? [] }),
  );
  return {
    exportedAt: iso(Date.now()),
    account: toAccount(accountRow),
    shelves: (shelves!.results as ShelfRow[]).map((row) => ({
      ...toShelf(row),
      uploads: uploadsOf.get(row.id) ?? [],
      phrasings: phrasingsOf.get(row.id) ?? [],
      cards: cardsOf.get(row.id) ?? [],
    })),
  };
}
