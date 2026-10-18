// Captures' side of the store (m1kuorg/basics#50): what a capture is
// compared with before any model is asked, storing it where it goes, and
// reading it back. Words are compared ignoring case and spacing; a
// capture keeps its words in that form beside its text, so that the check
// for the same words captured meanwhile is part of the capture's own
// insert, one batch on D1. Every query joins up to the shelf's owner, so
// another account's shelf reads as missing.

import type { Capture } from "@asked-before/sdk";
import { findCard, toPhrasing, type PhrasingRow } from "./cards";
import { newId, type Db } from "./db";
import { ownsShelf } from "./shelves";
import { placeBatch, type Placement } from "./sorts";

/** A capture before it's stored: its id, your words, and the server's clock. */
export type Draft = { id: string; text: string; time: number };

export const draft = (text: string): Draft => ({ id: newId(), text, time: Date.now() });

/** Words as captures compare them: lowercased, with each run of spacing as one space. */
const comparable = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** How long the same words captured again return the earlier capture rather than add a borrow. */
const REPEAT_WINDOW = 10 * 60 * 1000;

/** The latest capture on shelf ?1 of the words ?2 since ?3, the ten minutes before a capture. */
const EARLIER = "SELECT id FROM phrasings WHERE shelf_id = ?1 AND origin = 'capture' AND words = ?2 AND time > ?3 ORDER BY time DESC, id DESC LIMIT 1";

/**
 * What a capture is compared with before the model, read in one batch: the
 * shelf's capture of the same words in the last ten minutes, or else the
 * card of its latest borrow with the same words, if any. Null when the
 * account has no such shelf.
 */
export async function lookUp(db: Db, userId: string, shelfId: string, capture: Draft): Promise<{ earlier: string } | { cardId: string | null } | null> {
  const words = comparable(capture.text);
  const [owned, earlier, borrows] = await db.batch([
    ownsShelf(db, userId, shelfId),
    db.prepare(EARLIER).bind(shelfId, words, capture.time - REPEAT_WINDOW),
    db.prepare("SELECT card_id, text FROM phrasings WHERE shelf_id = ?1 AND card_id IS NOT NULL ORDER BY time DESC, id DESC").bind(shelfId),
  ]);
  if (!owned!.results.length) return null;
  const found = earlier!.results[0] as { id: string } | undefined;
  if (found) return { earlier: found.id };
  return { cardId: (borrows!.results as { card_id: string; text: string }[]).find((row) => comparable(row.text) === words)?.card_id ?? null };
}

/**
 * Stores a capture and places it as `placement` says, in one batch: the
 * capture goes in only while the account has the shelf and the same words
 * weren't captured in the meantime, and the placement holds to it. When
 * they were, it stores nothing and answers with that capture instead. Null
 * when the account no longer has the shelf.
 */
export async function storeCapture(db: Db, userId: string, shelfId: string, capture: Draft, placement: Placement): Promise<{ id: string; alreadyCaptured: boolean } | null> {
  const words = comparable(capture.text);
  const since = capture.time - REPEAT_WINDOW;
  const now = Date.now();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO phrasings (id, shelf_id, origin, source_id, text, words, time, offered_at, created_at)
         SELECT ?4, id, 'capture', ?5, ?6, ?2, ?7, ?8, ?8 FROM shelves
         WHERE id = ?1 AND user_id = ?9 AND NOT EXISTS (${EARLIER})`,
      )
      .bind(shelfId, words, since, capture.id, `capture-${capture.id}`, capture.text, capture.time, now, userId),
    ...placeBatch(db, shelfId, placement, [capture.id], { capture: capture.id }),
    // This capture, or the one of the same words that came first.
    db
      .prepare(
        `SELECT f.id FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id
         WHERE f.shelf_id = ?1 AND sh.user_id = ?4 AND f.origin = 'capture' AND f.words = ?2 AND f.time > ?3
         ORDER BY f.time DESC, f.id DESC LIMIT 1`,
      )
      .bind(shelfId, words, since, userId),
  ]);
  const stored = results.at(-1)!.results[0] as { id: string } | undefined;
  return stored ? { id: stored.id, alreadyCaptured: stored.id !== capture.id } : null;
}

/** A stored capture with its card as it stands now; or null when the account has no such phrasing. */
export async function captureOf(db: Db, userId: string, phrasingId: string, alreadyCaptured: boolean): Promise<Capture | null> {
  const row = await db
    .prepare("SELECT f.id, f.source_id, f.text, f.time, f.card_id FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id WHERE f.id = ?2 AND sh.user_id = ?1")
    .bind(userId, phrasingId)
    .first<PhrasingRow & { card_id: string | null }>();
  if (!row) return null;
  return {
    phrasing: toPhrasing(row),
    card: row.card_id === null ? null : await findCard(db, userId, row.card_id),
    alreadyCaptured,
  };
}
