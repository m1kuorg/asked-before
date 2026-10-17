// Cold reps, as the store keeps them (m1kuorg/basics#46): what a card's
// next rep is written from, adding a rep with the card's lesson, and
// recording a check once. Every query joins up to the project's owner, so
// another account's card or rep reads as missing. A rep is open while it's
// unchecked and the latest on its card: starting a newer one leaves it
// unchecked for good. Ids are time-ordered, so the latest rep is the one
// with the greatest (created_at, id).

import type { Rep } from "@asked-before/sdk";
import { db, iso, newId } from "./db";

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
export function repSource(userId: string, cardId: string): RepSource | null {
  const card = db
    .query("SELECT c.skill, c.lesson FROM cards c JOIN projects p ON p.id = c.project_id WHERE c.id = $cardId AND p.user_id = $userId")
    .get({ userId, cardId }) as { skill: string; lesson: string | null } | null;
  if (!card) return null;
  const phrasings = db.query("SELECT text FROM phrasings WHERE card_id = $cardId ORDER BY time, id").all({ cardId }) as { text: string }[];
  const problems = db.query("SELECT problem FROM reps WHERE card_id = $cardId ORDER BY created_at, id").all({ cardId }) as { problem: string }[];
  const last = db
    .query("SELECT verdict FROM reps WHERE card_id = $cardId AND checked_at IS NOT NULL ORDER BY checked_at DESC, id DESC LIMIT 1")
    .get({ cardId }) as { verdict: Rep["verdict"] } | null;
  return {
    ...card,
    phrasings: phrasings.map((p) => p.text),
    earlierProblems: problems.map((r) => r.problem),
    lastVerdict: last?.verdict ?? null,
  };
}

/**
 * Adds an unchecked rep to the card, and keeps `lesson` as the card's
 * lesson only if it has none yet. Returns the rep and the card's lesson as
 * it now stands, or null when the card is gone, as when its last upload
 * was deleted meanwhile.
 */
export function addRep(cardId: string, problem: string, lesson: string | undefined): { rep: Rep; lesson: string | null } | null {
  return db.transaction(() => {
    if (lesson !== undefined) db.query("UPDATE cards SET lesson = $lesson WHERE id = $cardId AND lesson IS NULL").run({ cardId, lesson });
    const card = db.query("SELECT lesson FROM cards WHERE id = $cardId").get({ cardId }) as { lesson: string | null } | null;
    if (!card) return null;
    const row = db
      .query(`INSERT INTO reps (id, card_id, problem, created_at) VALUES ($id, $cardId, $problem, $now) RETURNING ${REP_COLUMNS}`)
      .get({ id: newId(), cardId, problem, now: Date.now() }) as RepRow;
    return { rep: toRep(row), lesson: card.lesson };
  })();
}

/** A rep of the account's, with its card and the card's skill, and whether it's open, checked, or left for a newer rep. */
export type FoundRep = { rep: Rep; cardId: string; skill: string; state: "open" | "checked" | "superseded" };

const NEWER = "EXISTS (SELECT 1 FROM reps n WHERE n.card_id = r.card_id AND (n.created_at, n.id) > (r.created_at, r.id))";

export function findRep(userId: string, repId: string): FoundRep | null {
  const row = db
    .query(
      `SELECT ${REP_COLUMNS.split(", ").map((c) => `r.${c}`).join(", ")}, r.card_id, c.skill, ${NEWER} AS superseded
       FROM reps r JOIN cards c ON c.id = r.card_id JOIN projects p ON p.id = c.project_id
       WHERE r.id = $repId AND p.user_id = $userId`,
    )
    .get({ userId, repId }) as (RepRow & { card_id: string; skill: string; superseded: number }) | null;
  if (!row) return null;
  const state = row.checked_at !== null ? "checked" : row.superseded ? "superseded" : "open";
  return { rep: toRep(row), cardId: row.card_id, skill: row.skill, state };
}

/** Records a check on an open rep, once. Null when it was checked meanwhile, a newer rep started, or it's gone. */
export function recordCheck(repId: string, check: { answer: string; verdict: "pass" | "fail"; reason: string }): Rep | null {
  const row = db
    .query(
      `UPDATE reps AS r SET answer = $answer, verdict = $verdict, reason = $reason, checked_at = $now
       WHERE r.id = $repId AND r.checked_at IS NULL AND NOT ${NEWER}
       RETURNING ${REP_COLUMNS}`,
    )
    .get({ repId, ...check, now: Date.now() }) as RepRow | null;
  return row && toRep(row);
}
