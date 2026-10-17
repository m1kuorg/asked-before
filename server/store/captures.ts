// Captures' side of the store (m1kuorg/basics#50): what a capture is
// compared with before any model is asked, and storing it where it goes.
// Words are compared ignoring case and spacing. Every query is scoped by a
// project its caller has checked the account owns.

import type { Capture } from "@asked-before/sdk";
import { db, iso, newId } from "./db";
import { findCard } from "./cards";
import { placeBatch, type Placement } from "./sorts";

/** A capture before it's stored: its id, your words, and the server's clock. */
export type Draft = { id: string; text: string; time: number };

export const draft = (text: string, time: number): Draft => ({ id: newId(), text, time });

/** Words as captures compare them: ignoring case, and runs of spacing as one space. */
const same = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

export const ownsProject = (userId: string, projectId: string) =>
  db.query("SELECT 1 FROM projects WHERE id = $projectId AND user_id = $userId").get({ userId, projectId }) !== null;

/** How long the same words captured again return the earlier capture rather than add a borrow. */
const REPEAT_WINDOW = 10 * 60 * 1000;

/** The project's capture with the same words in the ten minutes before `now`, or null. */
export function recentCapture(projectId: string, text: string, now: number): string | null {
  const words = same(text);
  const rows = db
    .query("SELECT id, text FROM phrasings WHERE project_id = $projectId AND origin = 'capture' AND time > $since ORDER BY time DESC, id DESC")
    .all({ projectId, since: now - REPEAT_WINDOW }) as { id: string; text: string }[];
  return rows.find((row) => same(row.text) === words)?.id ?? null;
}

/** The card of the project's latest borrow with the same words, or null. */
export function cardHolding(projectId: string, text: string): string | null {
  const words = same(text);
  const rows = db
    .query("SELECT card_id, text FROM phrasings WHERE project_id = $projectId AND card_id IS NOT NULL ORDER BY time DESC, id DESC")
    .all({ projectId }) as { card_id: string; text: string }[];
  return rows.find((row) => same(row.text) === words)?.card_id ?? null;
}

const insert = db.query(`
  INSERT INTO phrasings (id, project_id, origin, source_id, text, time, card_id, offered_at, created_at)
  VALUES ($id, $projectId, 'capture', $sourceId, $text, $time, $cardId, $now, $now)
`);
const projectExists = db.query("SELECT 1 FROM projects WHERE id = $projectId");

/** Where a capture goes: onto the card that holds its words, or wherever a checked sort answer for its batch puts it. */
export type Destination = { cardId: string } | { placement: Placement; batch: string[] };

/**
 * Stores a capture where it goes, in one transaction. When the same words
 * were captured in the meantime, it stores nothing and answers with that
 * capture, as a repeat. Null when the project is gone.
 */
export function storeCapture(projectId: string, capture: Draft, to: Destination): { id: string; repeat: boolean } | null {
  return db.transaction(() => {
    if (!projectExists.get({ projectId })) return null;
    const earlier = recentCapture(projectId, capture.text, capture.time);
    if (earlier) return { id: earlier, repeat: true };
    const cardId = "cardId" in to ? to.cardId : null;
    insert.run({ id: capture.id, projectId, sourceId: `capture-${capture.id}`, text: capture.text, time: capture.time, cardId, now: Date.now() });
    if ("placement" in to) placeBatch(projectId, to.placement, to.batch);
    return { id: capture.id, repeat: false };
  })();
}

/** A stored capture with its card as it stands now. */
export function captureOf(userId: string, phrasingId: string, repeat: boolean): Capture {
  const row = db.query("SELECT id, source_id, text, time, card_id FROM phrasings WHERE id = $phrasingId").get({ phrasingId }) as {
    id: string;
    source_id: string;
    text: string;
    time: number;
    card_id: string | null;
  };
  return {
    phrasing: { id: row.id, sourceId: row.source_id, text: row.text, time: iso(row.time) },
    card: row.card_id === null ? null : findCard(userId, row.card_id),
    repeat,
  };
}
