// The throttle: at most 20 tries in 15 minutes, a row per caller in the
// throttle table, since a Worker keeps nothing in memory between requests.
// Signing up and logging in count per network, the caller's address as
// Cloudflare saw it (CF-Connecting-IP), an IPv6 one by its /64
// (api/auth.ts); checking a session's account's password key, to change the
// email or the password or to delete the account, counts per account, since
// that check takes microseconds where scrypt took 70 ms (ADR 0006). A try
// past the limit writes nothing, so a flood of them spends none of D1's
// rows written. The table also holds each network's sign-ups today,
// "signups:<network>", whose window ends at midnight UTC (store/users.ts's
// createUser()), swept here like any other.

import { HttpError } from "../http";
import type { Db } from "./db";

const TRIES = 20;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Counts a try from `caller`, an address or "account:<id>", or throws 429
 * past the limit. One batch sweeps every ended window, this caller's
 * included, then starts the caller's window with this try or adds it to
 * the one still running, while it's under the limit.
 */
export async function throttle(db: Db, caller: string): Promise<void> {
  const now = Date.now();
  const [, counted] = await db.batch<{ tries: number }>([
    db.prepare("DELETE FROM throttle WHERE ends_at <= ?1").bind(now),
    db
      .prepare(
        `INSERT INTO throttle (address, tries, ends_at) VALUES (?1, 1, ?2)
         ON CONFLICT (address) DO UPDATE SET tries = tries + 1 WHERE tries <= ?3
         RETURNING tries`,
      )
      .bind(caller, now + WINDOW_MS, TRIES),
  ]);
  const tries = counted?.results[0]?.tries;
  if (tries === undefined || tries > TRIES) throw new HttpError(429, "Too many tries. Wait a few minutes, then try again.");
}
