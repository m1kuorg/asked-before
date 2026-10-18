// Sessions. The cookie holds a random token; the store keeps only its
// SHA-256, as the session's id, and a session ends 30 days after it starts.
// Expired ones are swept whenever a session starts, by signing up or
// logging in.

import type { Account } from "@asked-before/sdk";
import { randomToken, sha256, type Db } from "./db";
import { toAccount, type AccountRow } from "./users";

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Starts a session for the account, in one batch: sweeps the expired
 * sessions, ends the one the browser had (its cookie's token, `earlier`),
 * adds the new one, and reads the account. All of it happens only while the
 * account still has `passwordHash`, the hash just made or just checked, so
 * an account deleted, or a password changed, since then gets no session and
 * null. Otherwise the new session's token, for the cookie, and the account.
 */
export async function createSession(
  db: Db,
  { userId, passwordHash, earlier }: { userId: string; passwordHash: string; earlier: string | null },
): Promise<{ token: string; account: Account } | null> {
  const token = randomToken(32, "base64url");
  const now = Date.now();
  const stillHolds = "SELECT 1 FROM users WHERE id = ?1 AND password_hash = ?2";
  const [, , , read] = await db.batch<AccountRow>([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    db.prepare(`DELETE FROM sessions WHERE id = ?3 AND EXISTS (${stillHolds})`).bind(userId, passwordHash, earlier === null ? null : sha256(earlier)),
    db
      .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) SELECT ?3, id, ?4, ?5 FROM users WHERE id = ?1 AND password_hash = ?2")
      .bind(userId, passwordHash, sha256(token), now, now + SESSION_MS),
    db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?1 AND password_hash = ?2").bind(userId, passwordHash),
  ]);
  const row = read?.results[0];
  return row ? { token, account: toAccount(row) } : null;
}

/** The live session a cookie's token belongs to, if any. */
export async function findSession(db: Db, token: string | null): Promise<{ id: string; userId: string } | null> {
  if (!token) return null;
  return db
    .prepare("SELECT id, user_id AS userId FROM sessions WHERE id = ?1 AND expires_at > ?2")
    .bind(sha256(token), Date.now())
    .first<{ id: string; userId: string }>();
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?1").bind(sessionId).run();
}
