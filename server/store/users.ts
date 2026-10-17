// Accounts. Emails arrive trimmed and lowercased, and passwords already
// hashed; this module never sees a password itself.

import type { Account } from "@asked-before/sdk";
import { db, iso, newId } from "./db";

type Row = { id: string; name: string; email: string; created_at: number };

const toAccount = (row: Row): Account => ({ id: row.id, name: row.name, email: row.email, createdAt: iso(row.created_at) });

/** The new account, or null when the email already has one. */
export function createUser(input: { name: string; email: string; passwordHash: string }): Account | null {
  const row = db
    .query(
      `INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($id, $name, $email, $passwordHash, $now)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, created_at`,
    )
    .get({ id: newId(), now: Date.now(), ...input }) as Row | null;
  return row && toAccount(row);
}

export function getAccount(userId: string): Account | null {
  const row = db.query("SELECT id, name, email, created_at FROM users WHERE id = $userId").get({ userId }) as Row | null;
  return row && toAccount(row);
}

/** What logging in checks the password against. */
export function findLogin(email: string): { id: string; passwordHash: string } | null {
  return db.query("SELECT id, password_hash AS passwordHash FROM users WHERE email = $email").get({ email }) as {
    id: string;
    passwordHash: string;
  } | null;
}
