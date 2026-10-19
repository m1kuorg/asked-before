// Accounts. Emails arrive trimmed and lowercased, and password keys
// already hashed (server/passwords.ts); no password ever reaches the server.

import type { Account } from "@asked-before/sdk";
import { iso, newId, type Db } from "./db";

export type AccountRow = { id: string; name: string; email: string; created_at: number };

/** An account's columns, as an AccountRow. */
const ACCOUNT_COLUMNS = "id, name, email, created_at";

/** Account ?1, as an AccountRow, for the account itself, a new session (store/sessions.ts), and the download (store/account-data.ts). */
export const ACCOUNT = `SELECT ${ACCOUNT_COLUMNS} FROM users WHERE id = ?1`;

export const toAccount = (row: AccountRow): Account => ({ id: row.id, name: row.name, email: row.email, createdAt: iso(row.created_at) });

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The new account, made from `network` (an IPv4 address, or an IPv6 /64)
 * while it has made fewer than `cap` today, a UTC day; or why not: "taken"
 * when the email already has one, whatever the network's count, or
 * "capped" when the network has made today's. One batch: the network's
 * count today is a row of the throttle table, "signups:<network>", whose
 * window ends at midnight UTC, and counts only an account made, so a
 * sign-up refused for any reason counts nothing.
 */
export async function createUser(
  db: Db,
  input: { name: string; email: string; passwordHash: string },
  { network, cap }: { network: string; cap: number },
): Promise<Account | "taken" | "capped"> {
  const id = newId();
  const now = Date.now();
  const midnight = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
  const key = `signups:${network}`;
  const [before, created] = await db.batch<{ taken: number } & AccountRow>([
    db.prepare("SELECT EXISTS (SELECT 1 FROM users WHERE email = ?1) AS taken").bind(input.email),
    db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, created_at) SELECT ?3, ?4, ?5, ?6, ?2 WHERE coalesce((SELECT tries FROM throttle WHERE address = ?1 AND ends_at > ?2), 0) < ?7
         ON CONFLICT (email) DO NOTHING
         RETURNING ${ACCOUNT_COLUMNS}`,
      )
      .bind(key, now, id, input.name, input.email, input.passwordHash, cap),
    db
      .prepare(
        `INSERT INTO throttle (address, tries, ends_at) SELECT ?1, 1, ?3 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?4)
         ON CONFLICT (address) DO UPDATE SET tries = CASE WHEN ends_at > ?2 THEN tries + 1 ELSE 1 END, ends_at = ?3`,
      )
      .bind(key, now, midnight, id),
  ]);
  const row = created?.results[0];
  if (row) return toAccount(row);
  return before?.results[0]?.taken ? "taken" : "capped";
}

export async function getAccount(db: Db, userId: string): Promise<Account | null> {
  const row = await db.prepare(ACCOUNT).bind(userId).first<AccountRow>();
  return row && toAccount(row);
}

/** What logging in checks the password against. */
export async function findLogin(db: Db, email: string): Promise<{ id: string; passwordHash: string } | null> {
  return db.prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ?1").bind(email).first<{ id: string; passwordHash: string }>();
}

/** The account with its new name, or null when it's gone. */
export async function renameAccount(db: Db, userId: string, name: string): Promise<Account | null> {
  const row = await db.prepare(`UPDATE users SET name = ?2 WHERE id = ?1 RETURNING ${ACCOUNT_COLUMNS}`).bind(userId, name).first<AccountRow>();
  return row && toAccount(row);
}

/**
 * Moves the account to a new email, with the hash of the password key that
 * email salts (`to`), and the new name too when one is given, and ends
 * every other session of the account but `keepSessionId` (every one, given
 * null), as a password change does, since the server can't tell that `to`
 * comes from the same password; one batch, only while the hash is still
 * `from`, the one the current key was just checked against. The account;
 * or why not: "taken" when another account has the email, or "changed"
 * when the hash isn't `from` any more, since the password changed
 * meanwhile.
 */
export async function changeEmail(
  db: Db,
  userId: string,
  { name, email, from, to, keepSessionId }: { name?: string; email: string; from: string; to: string; keepSessionId: string | null },
): Promise<Account | "taken" | "changed"> {
  const [moved, held] = await db.batch<AccountRow>([
    db
      .prepare(
        `UPDATE OR IGNORE users SET name = coalesce(?2, name), email = ?3, password_hash = ?4 WHERE id = ?1 AND password_hash = ?5
         RETURNING ${ACCOUNT_COLUMNS}`,
      )
      .bind(userId, name ?? null, email, to, from),
    db.prepare(`${ACCOUNT} AND password_hash = ?2`).bind(userId, from),
    db
      .prepare("DELETE FROM sessions WHERE user_id = ?1 AND id IS NOT ?2 AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND email = ?3 AND password_hash = ?4)")
      .bind(userId, keepSessionId, email, to),
  ]);
  const row = moved?.results[0];
  if (row) return toAccount(row);
  return held?.results.length ? "taken" : "changed";
}

/** The hash a password change checks the current password's key against. */
export async function passwordHashOf(db: Db, userId: string): Promise<string | null> {
  const row = await db.prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?1").bind(userId).first<{ passwordHash: string }>();
  return row?.passwordHash ?? null;
}

/**
 * Replaces the hash `from`, the one the current password was just checked
 * against, with `to`, and ends every session of the account but
 * `keepSessionId` (every one, given null), in one batch. False, changing
 * nothing, when the hash isn't `from` any more: the password changed
 * meanwhile.
 */
export async function changePasswordHash(db: Db, userId: string, { from, to, keepSessionId }: { from: string; to: string; keepSessionId: string | null }): Promise<boolean> {
  const [changed] = await db.batch([
    db.prepare("UPDATE users SET password_hash = ?2 WHERE id = ?1 AND password_hash = ?3").bind(userId, to, from),
    db
      .prepare("DELETE FROM sessions WHERE user_id = ?1 AND id IS NOT ?2 AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND password_hash = ?3)")
      .bind(userId, keepSessionId, to),
  ]);
  return (changed?.meta.changes ?? 0) > 0;
}

/**
 * Deletes the account while its hash is still `hash`, the one the password
 * was just checked against, and with it, by cascade, everything in it: its
 * sessions, keys, usage, and shelves, with their uploads, phrasings, cards,
 * and reps. One statement, so it's whole or nothing. False, deleting
 * nothing, when the hash isn't `hash` any more: the password changed
 * meanwhile, or the account is gone.
 */
export async function deleteUser(db: Db, userId: string, hash: string): Promise<boolean> {
  const { meta } = await db.prepare("DELETE FROM users WHERE id = ?1 AND password_hash = ?2").bind(userId, hash).run();
  return meta.changes > 0;
}
