// API keys. A key is ab_<id>_<secret>: the store keeps the id and the
// SHA-256 of the secret, never the secret, so a key is shown only once, when
// it's made. A key is looked up by its id, and its last use is written at
// most once a minute. Revoking one deletes it, so it stops working at once.

import type { ApiKey, CreatedApiKey } from "@asked-before/sdk";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { iso, randomToken, sha256, type Db } from "./db";

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
export async function listKeys(db: Db, userId: string): Promise<ApiKey[]> {
  const { results } = await db
    .prepare("SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id = ?1 ORDER BY created_at, id")
    .bind(userId)
    .all<Row>();
  return results.map(toKey);
}

/** Makes a key and returns it whole, the one time it's ever seen. */
export async function createKey(db: Db, userId: string, name: string): Promise<CreatedApiKey> {
  const id = randomToken(8, "hex");
  const secret = randomToken(16, "hex");
  const row = await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, secret_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
       RETURNING id, name, created_at, last_used_at`,
    )
    .bind(id, userId, name, sha256(secret), Date.now())
    .first<Row>();
  return { ...toKey(row!), key: `ab_${id}_${secret}` };
}

/** Revokes a key. False when the account has no such key. */
export async function revokeKey(db: Db, userId: string, keyId: string): Promise<boolean> {
  const { meta } = await db.prepare("DELETE FROM api_keys WHERE id = ?1 AND user_id = ?2").bind(keyId, userId).run();
  return meta.changes > 0;
}

/**
 * Whose key this is, and its id; or null for a key that isn't valid or was
 * revoked. One batch reads the key and stamps its use, the stamp only for
 * the right secret and at most once a minute.
 */
export async function useKey(db: Db, token: string): Promise<{ keyId: string; userId: string } | null> {
  const parts = token.match(KEY);
  if (!parts) return null;
  const [, id, secret] = parts as [string, string, string];
  const secretHash = sha256(secret);
  const now = Date.now();
  const [found] = await db.batch<{ userId: string; secretHash: string }>([
    db.prepare("SELECT user_id AS userId, secret_hash AS secretHash FROM api_keys WHERE id = ?1").bind(id),
    db
      .prepare("UPDATE api_keys SET last_used_at = ?3 WHERE id = ?1 AND secret_hash = ?2 AND (last_used_at IS NULL OR last_used_at <= ?4)")
      .bind(id, secretHash, now, now - LAST_USED_EVERY_MS),
  ]);
  const row = found?.results[0];
  if (!row || !timingSafeEqual(Buffer.from(secretHash), Buffer.from(row.secretHash))) return null;
  return { keyId: id, userId: row.userId };
}
