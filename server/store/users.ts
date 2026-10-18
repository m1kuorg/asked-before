// Accounts. Emails arrive trimmed and lowercased, and passwords already
// hashed; this module never sees a password itself.

import type { Account } from "@asked-before/sdk";
import { iso, newId, type Db } from "./db";

export type AccountRow = { id: string; name: string; email: string; created_at: number };

/** An account's columns, as an AccountRow. */
const ACCOUNT_COLUMNS = "id, name, email, created_at";

/** Account ?1, as an AccountRow, for the account itself, a new session (store/sessions.ts), and the download (store/account-data.ts). */
export const ACCOUNT = `SELECT ${ACCOUNT_COLUMNS} FROM users WHERE id = ?1`;

export const toAccount = (row: AccountRow): Account => ({ id: row.id, name: row.name, email: row.email, createdAt: iso(row.created_at) });

/** The new account, or null when the email already has one. */
export async function createUser(db: Db, input: { name: string; email: string; passwordHash: string }): Promise<Account | null> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (email) DO NOTHING
       RETURNING ${ACCOUNT_COLUMNS}`,
    )
    .bind(newId(), input.name, input.email, input.passwordHash, Date.now())
    .first<AccountRow>();
  return row && toAccount(row);
}

export async function getAccount(db: Db, userId: string): Promise<Account | null> {
  const row = await db.prepare(ACCOUNT).bind(userId).first<AccountRow>();
  return row && toAccount(row);
}

/** What logging in checks the password against. */
export async function findLogin(db: Db, email: string): Promise<{ id: string; passwordHash: string } | null> {
  return db.prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ?1").bind(email).first<{ id: string; passwordHash: string }>();
}

/** The account with its new name or email, or null when the email already belongs to another account. */
export async function updateAccount(db: Db, userId: string, change: { name?: string; email?: string }): Promise<Account | null> {
  const row = await db
    .prepare(
      `UPDATE OR IGNORE users SET name = coalesce(?2, name), email = coalesce(?3, email) WHERE id = ?1
       RETURNING ${ACCOUNT_COLUMNS}`,
    )
    .bind(userId, change.name ?? null, change.email ?? null)
    .first<AccountRow>();
  return row && toAccount(row);
}

/** The hash a password change checks the current password against. */
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
