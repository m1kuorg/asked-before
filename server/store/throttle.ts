// The per-IP throttle on signing up and logging in: at most 20 tries from
// one address in 15 minutes, a row per address in the throttle table, since
// a Worker keeps nothing in memory between requests. The address is the
// caller's as Cloudflare saw it (CF-Connecting-IP).

import { HttpError } from "../http";
import type { Db } from "./db";

const TRIES = 20;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Counts a try from the address, or throws 429 past the limit. One batch
 * sweeps every ended window, this address's included, then starts the
 * address's window with this try or adds it to the one still running.
 */
export async function throttle(db: Db, address: string): Promise<void> {
  const now = Date.now();
  const [, counted] = await db.batch<{ tries: number }>([
    db.prepare("DELETE FROM throttle WHERE ends_at <= ?1").bind(now),
    db
      .prepare(
        `INSERT INTO throttle (address, tries, ends_at) VALUES (?1, 1, ?2)
         ON CONFLICT (address) DO UPDATE SET tries = tries + 1
         RETURNING tries`,
      )
      .bind(address, now + WINDOW_MS),
  ]);
  if ((counted?.results[0]?.tries ?? 0) > TRIES) {
    throw new HttpError(429, "Too many tries from this address. Wait a few minutes, then try again.");
  }
}
