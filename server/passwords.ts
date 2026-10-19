// Password keys (ADR 0006). A password never reaches the server: the SDK
// derives a key from it with scrypt, salted with the account's email
// (packages/sdk/src/password-key.ts), and sends that, 32 bytes as 64 hex
// digits, in its place. The key is as random as scrypt's output, so storing
// it needs no slow hash: it's kept as a SHA-256 under a random salt of the
// account's own, as sha256$<salt>$<hash>, which takes microseconds of the
// 10 ms of CPU a request has on Workers Free, and compared in constant time.

import { Buffer } from "node:buffer";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** A password key as the SDK sends it; `what` names it in the message, as in "passwordKey". */
export const PasswordKey = (what: string) =>
  z
    .string({ error: `${what} is needed: the SDK derives it from the password.` })
    .regex(/^[0-9a-f]{64}$/, `${what} is 64 lowercase hex digits: the SDK derives it from the password.`);

const STORED = /^sha256\$([0-9a-f]{32})\$([0-9a-f]{64})$/;

/** Compared against when there's no stored hash, so that an unknown email takes as long as a wrong key. */
const NONE = { salt: Buffer.alloc(16), hash: Buffer.alloc(32) };

const digest = (salt: Buffer, key: string) => createHash("sha256").update(salt).update(Buffer.from(key, "hex")).digest();

export function hashKey(key: string): string {
  const salt = randomBytes(16);
  return `sha256$${salt.toString("hex")}$${digest(salt, key).toString("hex")}`;
}

/** Whether the key is the one `stored` was made from; false for no hash, or anything that isn't a stored one. */
export function verifyKey(key: string, stored: string | null): boolean {
  const parts = stored?.match(STORED);
  const { salt, hash } = parts ? { salt: Buffer.from(parts[1]!, "hex"), hash: Buffer.from(parts[2]!, "hex") } : NONE;
  const matches = timingSafeEqual(digest(salt, key), hash);
  return matches && !!parts;
}
