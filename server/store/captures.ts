// Captures' side of the store (m1kuorg/basics#50): what a capture is
// compared with before any model is asked, storing it where it goes, and
// reading it back. Words are compared ignoring case and spacing. Every
// query joins up to the shelf's owner, so another account's shelf
// reads as missing.

import type { Capture } from "@asked-before/sdk";
import { findCard, toPhrasing, type PhrasingRow } from "./cards";
import { db, newId } from "./db";
import { ownsShelf } from "./shelves";
import { placeBatch, type Placement } from "./sorts";

/** A capture before it's stored: its id, your words, and the server's clock. */
export type Draft = { id: string; text: string; time: number };

export const draft = (text: string): Draft => ({ id: newId(), text, time: Date.now() });

/** Words as captures compare them: lowercased, with each run of spacing as one space. */
const comparable = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** How long the same words captured again return the earlier capture rather than add a borrow. */
const REPEAT_WINDOW = 10 * 60 * 1000;

/** The shelf's capture of the same words in the ten minutes before this one, or null. */
function earlierCapture(shelfId: string, capture: Draft): string | null {
  const words = comparable(capture.text);
  const rows = db
    .query("SELECT id, text FROM phrasings WHERE shelf_id = $shelfId AND origin = 'capture' AND time > $since ORDER BY time DESC, id DESC")
    .all({ shelfId, since: capture.time - REPEAT_WINDOW }) as { id: string; text: string }[];
  return rows.find((row) => comparable(row.text) === words)?.id ?? null;
}

/**
 * What a capture is compared with before the model: the shelf's capture
 * of the same words in the last ten minutes, or else the card of its
 * latest borrow with the same words, if any. Null when the account has no
 * such shelf.
 */
export function lookUp(userId: string, shelfId: string, capture: Draft): { earlier: string } | { cardId: string | null } | null {
  if (!ownsShelf(userId, shelfId)) return null;
  const earlier = earlierCapture(shelfId, capture);
  if (earlier) return { earlier };
  const words = comparable(capture.text);
  const rows = db
    .query("SELECT card_id, text FROM phrasings WHERE shelf_id = $shelfId AND card_id IS NOT NULL ORDER BY time DESC, id DESC")
    .all({ shelfId }) as { card_id: string; text: string }[];
  return { cardId: rows.find((row) => comparable(row.text) === words)?.card_id ?? null };
}

const insert = db.query(`
  INSERT INTO phrasings (id, shelf_id, origin, source_id, text, time, offered_at, created_at)
  VALUES ($id, $shelfId, 'capture', $sourceId, $text, $time, $now, $now)
`);

/**
 * Stores a capture and places it as `placement` says, in one transaction.
 * When the same words were captured in the meantime, it stores nothing and
 * answers with that capture instead. Null when the account no longer has
 * the shelf.
 */
export function storeCapture(userId: string, shelfId: string, capture: Draft, placement: Placement): { id: string; alreadyCaptured: boolean } | null {
  return db.transaction(() => {
    if (!ownsShelf(userId, shelfId)) return null;
    const earlier = earlierCapture(shelfId, capture);
    if (earlier) return { id: earlier, alreadyCaptured: true };
    insert.run({ id: capture.id, shelfId, sourceId: `capture-${capture.id}`, text: capture.text, time: capture.time, now: Date.now() });
    placeBatch(shelfId, placement, [capture.id]);
    return { id: capture.id, alreadyCaptured: false };
  })();
}

/** A stored capture with its card as it stands now; or null when the account has no such phrasing. */
export function captureOf(userId: string, phrasingId: string, alreadyCaptured: boolean): Capture | null {
  const row = db
    .query("SELECT f.id, f.source_id, f.text, f.time, f.card_id FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id WHERE f.id = $phrasingId AND sh.user_id = $userId")
    .get({ userId, phrasingId }) as (PhrasingRow & { card_id: string | null }) | null;
  if (!row) return null;
  return {
    phrasing: toPhrasing(row),
    card: row.card_id === null ? null : findCard(userId, row.card_id),
    alreadyCaptured,
  };
}
