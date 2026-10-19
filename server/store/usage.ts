// The daily caps (m1kuorg/basics#68), counted per UTC day for each account
// in `usage` and for the whole app in `site_usage`: model requests, which
// server/model.ts spends one of before every request it makes for an
// account, and phrasings, which an upload's chunk spends for every one it
// carries, even one the shelf holds already, since recording that the
// upload sent it writes too, and a capture for itself, before they're
// stored. Past either cap, the request is a 429 instead.
// Workers Free gives the whole Cloudflare account 100,000 D1 rows written a
// day, and every query fails past them, logging in too; the phrasing caps
// keep the app under that.

import type { Caps } from "../config";
import { HttpError } from "../http";
import type { Db } from "./db";

const count = (n: number) => n.toLocaleString("en-US");

/**
 * Counts `n` toward the app's day and the account's, in one batch, each
 * only while it stays within its cap. The app's count is taken only while
 * the account's has room too, so an account past its own cap never touches
 * the app's. When the app's cap refuses and the account's took it, the
 * account's is given back, so a refused request counts toward neither.
 * Which cap refused, or null when both took it.
 */
async function spend(db: Db, userId: string, what: "model_requests" | "phrasings", n: number, caps: Caps): Promise<"account" | "site" | null> {
  const day = new Date().toISOString().slice(0, 10);
  const accountHasRoom = `coalesce((SELECT ${what} FROM usage WHERE user_id = ?4 AND day = ?1), 0) + ?2 <= ?5`;
  const [site, account] = await db.batch([
    db
      .prepare(
        `INSERT INTO site_usage (day, ${what}) SELECT ?1, ?2 WHERE ?2 <= ?3 AND ${accountHasRoom}
         ON CONFLICT (day) DO UPDATE SET ${what} = ${what} + ?2 WHERE ${what} + ?2 <= ?3 AND ${accountHasRoom}
         RETURNING ${what}`,
      )
      .bind(day, n, caps.site, userId, caps.account),
    db
      .prepare(
        `INSERT INTO usage (user_id, day, ${what}) SELECT ?1, ?2, ?3 WHERE ?3 <= ?4
         ON CONFLICT (user_id, day) DO UPDATE SET ${what} = ${what} + ?3 WHERE ${what} + ?3 <= ?4
         RETURNING ${what}`,
      )
      .bind(userId, day, n, caps.account),
  ]);
  if (!account!.results.length) return "account";
  if (site!.results.length) return null;
  await db.prepare(`UPDATE usage SET ${what} = ${what} - ?3 WHERE user_id = ?1 AND day = ?2`).bind(userId, day, n).run();
  return "site";
}

/** Counts a model request for the account, or throws 429 past its daily cap or the app's. */
export async function spendModelRequest(db: Db, userId: string, caps: Caps): Promise<void> {
  const refused = await spend(db, userId, "model_requests", 1, caps);
  if (refused === "account") {
    throw new HttpError(429, `You've used today's ${count(caps.account)} model ${caps.account === 1 ? "request" : "requests"}. More open at midnight UTC.`);
  }
  if (refused === "site") throw new HttpError(429, "Asked Before has made all the model requests it can today, across every account. More open at midnight UTC.");
}

/** Counts `n` phrasings the account sent, an upload's chunk or a capture, or throws 429 when they'd pass its daily cap or the app's. */
export async function spendPhrasings(db: Db, userId: string, n: number, caps: Caps): Promise<void> {
  const refused = await spend(db, userId, "phrasings", n, caps);
  if (refused === "account") {
    throw new HttpError(429, `Your account can send ${count(caps.account)} phrasings a day, uploads and captures together, and these would pass today's. More open at midnight UTC.`);
  }
  if (refused === "site") throw new HttpError(429, "These phrasings would pass what Asked Before can take today, across every account. More open at midnight UTC.");
}
