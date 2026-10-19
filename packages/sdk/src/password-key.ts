// The password never leaves your computer (ADR 0006). The SDK derives a key
// from it with scrypt at N=2^14, r=8, p=5, salted with the account's email
// as the server keeps it (trimmed and lowercased), and sends that key, 32
// bytes as 64 hex digits, wherever the API takes a password. scrypt runs
// here, in pure JavaScript, so it works the same in a browser, Bun, and
// Node, and the server's 10 ms of CPU on Workers Free never runs it. The
// server can't see a password any more, so the SDK holds passwords to the
// length rules, and answers a broken one as the server would, with a 400.

import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ApiError } from "./http.ts";

/** The fewest characters a new password may have. */
export const NEW_PASSWORD = 10;
/** The most characters any password may have. */
const MAX_PASSWORD = 200;

/** An email as the server keeps it, and as the key's salt takes it. */
const normalEmail = (email: string) => email.trim().toLowerCase();

/**
 * The key the API takes in place of the password: scrypt of the password
 * (in Unicode's NFC form, so the same characters typed on any keyboard
 * give the same key) with the salt "asked-before/1:" and the email.
 */
export async function passwordKey(password: string, email: string): Promise<string> {
  const key = await scryptAsync(password.normalize("NFC"), `asked-before/1:${normalEmail(email)}`, { N: 2 ** 14, r: 8, p: 5, dkLen: 32 });
  return bytesToHex(key);
}

/**
 * Throws a 400, before anything is sent, for a password that's missing,
 * shorter than `min` characters, or longer than any may be; `what` names
 * it in the message, as in "A new password needs at least 10 characters."
 */
export function checkPassword(password: unknown, what: string, min = 0): asserts password is string {
  if (typeof password !== "string" || (min > 0 && !password)) throw new ApiError(400, `${what} is needed.`);
  if (password.length < min) throw new ApiError(400, `${what} needs at least ${min} characters.`);
  if (password.length > MAX_PASSWORD) throw new ApiError(400, `${what} can have at most ${MAX_PASSWORD} characters.`);
}
