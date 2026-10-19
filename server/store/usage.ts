// The daily caps (m1kuorg/basics#68), one each for the whole app, counted
// once for everyone, guests included, per UTC day in `site_usage`
// (m1kuorg/basics#73): model requests, which server/model.ts spends one of
// before every request it makes, and phrasings, which an upload's chunk
// spends for every one it carries, even one the shelf holds already, since
// recording that the upload sent it writes too, and a capture for itself,
// before they're stored. Past either cap, the request is a 429 instead.
// Workers Free gives the whole Cloudflare account 100,000 D1 rows written a
// day, and every query fails past them, logging in too; the phrasing cap
// keeps the app under that.

import { HttpError } from "../http";
import type { Db } from "./db";

/**
 * Counts `n` toward the app's day, in one statement that takes it only
 * while the day's count stays within `cap`, so a refused request moves
 * nothing. Whether it was counted.
 */
async function spend(db: Db, what: "model_requests" | "phrasings", n: number, cap: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const counted = await db
    .prepare(
      `INSERT INTO site_usage (day, ${what}) SELECT ?1, ?2 WHERE coalesce((SELECT ${what} FROM site_usage WHERE day = ?1), 0) + ?2 <= ?3
       ON CONFLICT (day) DO UPDATE SET ${what} = ${what} + ?2
       RETURNING ${what}`,
    )
    .bind(day, n, cap)
    .first();
  return counted !== null;
}

/** Counts a model request, or throws 429 past the app's daily cap. */
export async function spendModelRequest(db: Db, cap: number): Promise<void> {
  if (!(await spend(db, "model_requests", 1, cap))) throw new HttpError(429, "Asked Before has used today's model requests for everyone. More open at midnight UTC.");
}

/** Counts `n` phrasings sent, an upload's chunk or a capture, or throws 429 when they'd pass the app's daily cap. */
export async function spendPhrasings(db: Db, n: number, cap: number): Promise<void> {
  if (!(await spend(db, "phrasings", n, cap))) throw new HttpError(429, "These phrasings would pass what Asked Before can take today for everyone. More open at midnight UTC.");
}
