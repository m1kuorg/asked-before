// Sessions. The cookie holds a random token; the store keeps only its
// SHA-256, as the session's id, and a session ends 30 days after it starts.

import { db, randomToken, sha256 } from "./db";

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

db.query("DELETE FROM sessions WHERE expires_at <= $now").run({ now: Date.now() });

/** Starts a session and returns its token, for the cookie. */
export function createSession(userId: string): string {
  const token = randomToken(32, "base64url");
  const now = Date.now();
  db.query("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($id, $userId, $now, $expiresAt)").run({
    id: sha256(token),
    userId,
    now,
    expiresAt: now + SESSION_MS,
  });
  return token;
}

/** The live session a cookie's token belongs to, if any. */
export function findSession(token: string | null): { id: string; userId: string } | null {
  if (!token) return null;
  return db
    .query("SELECT id, user_id AS userId FROM sessions WHERE id = $id AND expires_at > $now")
    .get({ id: sha256(token), now: Date.now() }) as { id: string; userId: string } | null;
}

export function deleteSession(sessionId: string): void {
  db.query("DELETE FROM sessions WHERE id = $sessionId").run({ sessionId });
}

/** Ends every session of the account but the one given, as changing the password does. */
export function deleteOtherSessions(userId: string, keepSessionId: string): void {
  db.query("DELETE FROM sessions WHERE user_id = $userId AND id != $keepSessionId").run({ userId, keepSessionId });
}
