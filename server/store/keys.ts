// API keys. A key is ab_<id>_<secret>: the store keeps the id and the
// SHA-256 of the secret, never the secret, so a key is shown only once, when
// it's made. A key is looked up by its id, and its last use is written at
// most once a minute. Revoking one deletes it, so it stops working at once.

import type { ApiKey, CreatedApiKey } from "@asked-before/sdk";
import { timingSafeEqual } from "node:crypto";
import { db, iso, randomToken, sha256 } from "./db";

const KEY = /^ab_([0-9a-f]{16})_([0-9a-f]{32})$/;
const LAST_USED_EVERY_MS = 60_000;

type Row = { id: string; name: string; created_at: number; last_used_at: number | null };


const toKey = (row: Row): ApiKey => ({
  id: row.id,
  name: row.name,
  prefix: `ab_${row.id}`,
  createdAt: iso(row.created_at),
  lastUsedAt: row.last_used_at === null ? null : iso(row.last_used_at),
});

/** The account's keys, oldest first. */
export function listKeys(userId: string): ApiKey[] {
  const rows = db
    .query("SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id = $userId ORDER BY created_at, id")
    .all({ userId }) as Row[];
  return rows.map(toKey);
}

/** Makes a key and returns it whole, the one time it's ever seen. */
export function createKey(userId: string, name: string): CreatedApiKey {
  const id = randomToken(8, "hex");
  const secret = randomToken(16, "hex");
  const row = db
    .query(
      `INSERT INTO api_keys (id, user_id, name, secret_hash, created_at) VALUES ($id, $userId, $name, $secretHash, $now)
       RETURNING id, name, created_at, last_used_at`,
    )
    .get({ id, userId, name, secretHash: sha256(secret), now: Date.now() }) as Row;
  return { ...toKey(row), key: `ab_${id}_${secret}` };
}

/** Revokes a key. False when the account has no such key. */
export function revokeKey(userId: string, keyId: string): boolean {
  return db.query("DELETE FROM api_keys WHERE id = $keyId AND user_id = $userId").run({ userId, keyId }).changes > 0;
}

/** Whose key this is, and its id, stamping its use; or null for a key that isn't valid or was revoked. */
export function useKey(token: string): { keyId: string; userId: string } | null {
  const parts = token.match(KEY);
  if (!parts) return null;
  const [, id, secret] = parts as [string, string, string];
  const row = db.query("SELECT user_id AS userId, secret_hash AS secretHash FROM api_keys WHERE id = $id").get({ id }) as {
    userId: string;
    secretHash: string;
  } | null;
  if (!row || !timingSafeEqual(Buffer.from(sha256(secret)), Buffer.from(row.secretHash))) return null;
  const now = Date.now();
  db.query("UPDATE api_keys SET last_used_at = $now WHERE id = $id AND (last_used_at IS NULL OR last_used_at <= $stale)").run({
    id,
    now,
    stale: now - LAST_USED_EVERY_MS,
  });
  return { keyId: id, userId: row.userId };
}
