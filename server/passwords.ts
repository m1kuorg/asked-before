// Passwords, hashed with scrypt at one of OWASP's settings, N=2^14, r=8, p=5
// (16 MiB), since Workers have no argon2 (app-notes/cloudflare-workers.md,
// Passwords). The parameters are stored beside each hash, as
// $scrypt$ln=14,r=8,p=5$<salt>$<hash>, so a later change of them still
// verifies the hashes made before it.

import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const LN = 14;
const R = 8;
const P = 5;
const KEY_BYTES = 32;
/** Room above the 16 MiB these parameters take; workerd refuses N·r·p above 2^20 anyway. */
const MAX_MEMORY = 64 * 1024 * 1024;

const STORED = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;

/**
 * Verified when an email has no account, so that logging in takes as long
 * either way. It's the hash of a random password no one knows, made once
 * and kept here, since a Worker can't make random values at module scope.
 */
export const NO_ACCOUNT_HASH = "$scrypt$ln=14,r=8,p=5$wc8E2YelTTNxKjRXBcToFA==$mS7VSuEt4bBUk+izc0iPFgvCXGQx96uCoXEQCO5m/Yo=";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_BYTES, { N: 2 ** LN, r: R, p: P, maxmem: MAX_MEMORY });
  return `$scrypt$ln=${LN},r=${R},p=${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Whether the password is the one `stored` was made from; false for anything that isn't a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.match(STORED);
  if (!parts) return false;
  const [, ln, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: 2 ** Number(ln), r: Number(r), p: Number(p), maxmem: MAX_MEMORY });
  return timingSafeEqual(actual, expected);
}
