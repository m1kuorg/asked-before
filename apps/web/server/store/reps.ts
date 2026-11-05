// Cold reps, as the store keeps them (m1kuorg/basics#46): what a card's
// next rep is written from, adding a rep with the card's lesson, and
// recording a check once. Every query joins up to the shelf's owner, so
// another account's card or rep reads as missing. A rep is open while it's
// unchecked and the latest on its card: starting a newer one leaves it
// unchecked for good. Ids are time-ordered, so the latest rep is the one
// with the greatest (created_at, id). On D1, what a rep is written from is
// read in one batch, and adding one is one batch that keeps the lesson only
// while the card has none and adds the rep only while the card is there.

import type { Rep } from "@asked-before/sdk";
import { iso, newId, type Db } from "./db";

export type RepRow = {
  id: string;
  problem: string;
  answer: string | null;
  verdict: Rep["verdict"];
  reason: string | null;
  created_at: number;
  checked_at: number | null;
};

export const REP_COLUMNS = "id, problem, answer, verdict, reason, created_at, checked_at";

export const toRep = (row: RepRow): Rep => ({
  id: row.id,
  problem: row.problem,
  answer: row.answer,
  verdict: row.verdict,
  reason: row.reason,
  createdAt: iso(row.created_at),
  checkedAt: row.checked_at === null ? null : iso(row.checked_at),
});

/** What a card's next rep is written from. */
export type RepSource = {
  skill: string;
  lesson: string | null;
  /** The card's phrasings' words, oldest first. */
  phrasings: string[];
  /** Every problem the card has had, oldest first, so a new one never repeats one. */
  earlierProblems: string[];
  /** The verdict of the card's latest checked rep, or null before one is checked. */
  lastVerdict: Rep["verdict"];
};

/** The card's skill, lesson, phrasings, earlier problems, and latest verdict; or null when the account has no such card. */
export async function repSource(db: Db, userId: string, cardId: string): Promise<RepSource | null> {
  const [card, phrasings, problems, last] = await db.batch([
    db.prepare("SELECT c.skill, c.lesson FROM cards c JOIN shelves sh ON sh.id = c.shelf_id WHERE c.id = ?2 AND sh.user_id = ?1").bind(userId, cardId),
    db.prepare("SELECT text FROM phrasings WHERE card_id = ?1 ORDER BY time, id").bind(cardId),
    db.prepare("SELECT problem FROM reps WHERE card_id = ?1 ORDER BY created_at, id").bind(cardId),
    db.prepare("SELECT verdict FROM reps WHERE card_id = ?1 AND checked_at IS NOT NULL ORDER BY checked_at DESC, id DESC LIMIT 1").bind(cardId),
  ]);
  const found = card!.results[0] as { skill: string; lesson: string | null } | undefined;
  if (!found) return null;
  return {
    ...found,
    phrasings: (phrasings!.results as { text: string }[]).map((p) => p.text),
    earlierProblems: (problems!.results as { problem: string }[]).map((r) => r.problem),
    lastVerdict: (last!.results[0] as { verdict: Rep["verdict"] } | undefined)?.verdict ?? null,
  };
}

/**
 * Adds an unchecked rep to the card, and keeps `lesson` as the card's
 * lesson only if it has none yet, in one batch. Returns the rep and the
 * card's lesson as it now stands, or null when the card is gone, as when
 * its last upload was deleted meanwhile.
 */
export async function addRep(db: Db, cardId: string, problem: string, lesson: string | undefined): Promise<{ rep: Rep; lesson: string | null } | null> {
  const results = await db.batch([
    ...(lesson === undefined ? [] : [db.prepare("UPDATE cards SET lesson = ?2 WHERE id = ?1 AND lesson IS NULL").bind(cardId, lesson)]),
    db
      .prepare(`INSERT INTO reps (id, card_id, problem, created_at) SELECT ?1, id, ?3, ?4 FROM cards WHERE id = ?2 RETURNING ${REP_COLUMNS}`)
      .bind(newId(), cardId, problem, Date.now()),
    db.prepare("SELECT lesson FROM cards WHERE id = ?1").bind(cardId),
  ]);
  const [added, card] = results.slice(-2);
  const row = added!.results[0] as RepRow | undefined;
  return row ? { rep: toRep(row), lesson: (card!.results[0] as { lesson: string | null }).lesson } : null;
}

/** A rep of the account's, with its card and the card's skill, and whether it's open, checked, or left for a newer rep. */
export type FoundRep = { rep: Rep; cardId: string; skill: string; state: "open" | "checked" | "superseded" };

const NEWER = "EXISTS (SELECT 1 FROM reps n WHERE n.card_id = r.card_id AND (n.created_at, n.id) > (r.created_at, r.id))";

export async function findRep(db: Db, userId: string, repId: string): Promise<FoundRep | null> {
  const row = await db
    .prepare(
      `SELECT ${REP_COLUMNS.split(", ").map((c) => `r.${c}`).join(", ")}, r.card_id, c.skill, ${NEWER} AS superseded
       FROM reps r JOIN cards c ON c.id = r.card_id JOIN shelves sh ON sh.id = c.shelf_id
       WHERE r.id = ?2 AND sh.user_id = ?1`,
    )
    .bind(userId, repId)
    .first<RepRow & { card_id: string; skill: string; superseded: number }>();
  if (!row) return null;
  const state = row.checked_at !== null ? "checked" : row.superseded ? "superseded" : "open";
  return { rep: toRep(row), cardId: row.card_id, skill: row.skill, state };
}

/** Records a check on an open rep, once, in one statement. Null when it was checked meanwhile, a newer rep started, or it's gone. */
export async function recordCheck(db: Db, repId: string, check: { answer: string; verdict: "pass" | "fail"; reason: string }): Promise<Rep | null> {
  const row = await db
    .prepare(
      `UPDATE reps AS r SET answer = ?2, verdict = ?3, reason = ?4, checked_at = ?5
       WHERE r.id = ?1 AND r.checked_at IS NULL AND NOT ${NEWER}
       RETURNING ${REP_COLUMNS}`,
    )
    .bind(repId, check.answer, check.verdict, check.reason, Date.now())
    .first<RepRow>();
  return row && toRep(row);
}
