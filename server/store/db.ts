// What the store's modules share. The database is D1 (m1kuorg/basics#60),
// bound for each request (server/http.ts's Context) and handed to every
// store function as its first argument, which prepares its statements then
// and there: a Worker has no env at module scope. A read that a write
// depends on goes in the same batch(), one transaction, folded into the
// write's SQL. The schema is migrations/, which `wrangler d1 migrations
// apply` applies. Beside that: new ids, times as the API sends them, the
// random tokens and hashes behind sessions and keys, and slicing a list of
// rows for json_each.

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export type { D1Database as Db } from "@cloudflare/workers-types";

/** The last id's time and its counter within that millisecond, so ids made in one request keep their order. */
let lastMs = 0;
let counter = 0;

/**
 * A new primary key: a time-ordered UUID (version 7). A Worker's clock
 * stands still while a request runs, so ids made in the same millisecond
 * take a counter after the time, and stay in the order they were made.
 */
export function newId(): string {
  const now = Date.now();
  if (now > lastMs) {
    lastMs = now;
    counter = 0;
  } else if (++counter > 0xfff) {
    lastMs++;
    counter = 0;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(lastMs / 2 ** (8 * (5 - i))) & 0xff;
  bytes[6] = 0x70 | (counter >> 8);
  bytes[7] = counter & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A stored time (Unix milliseconds) as the API sends it. */
export const iso = (ms: number) => new Date(ms).toISOString();

/** A secret's SHA-256, in hex, which is all the store keeps of a session's token or a key's secret. */
export const sha256 = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** `bytes` random bytes, as base64url for a cookie's token or hex for a key's parts. */
export const randomToken = (bytes: number, encoding: "base64url" | "hex") => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(encoding);

/** The most one slice of a list binds, well under the 2 MB D1 takes in one bound value. */
const SLICE_BYTES = 500_000;

/**
 * A list of rows as JSON arrays of about 500 KB at most, each bound to one
 * statement that reads it with json_each, so a long list stays inside D1's
 * limits on bound values and parameters. No rows, no slices.
 */
export function slices(rows: unknown[]): string[] {
  const out: string[] = [];
  let slice: string[] = [];
  let bytes = 0;
  for (const row of rows) {
    const json = JSON.stringify(row);
    const size = Buffer.byteLength(json) + 1;
    if (slice.length && bytes + size > SLICE_BYTES) {
      out.push(`[${slice.join(",")}]`);
      slice = [];
      bytes = 0;
    }
    slice.push(json);
    bytes += size;
  }
  if (slice.length) out.push(`[${slice.join(",")}]`);
  return out;
}
