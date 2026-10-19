// The daily caps (m1kuorg/basics#68), counted per UTC day for each account
// in `usage` and for the whole app in `site_usage`: model requests, which
// server/model.ts spends one of before every request it makes for an
// account, and phrasings, which an upload's chunk spends for every one it
// carries, even one the shelf holds already, since recording that the
// upload sent it writes too, and a capture for itself, before they're
// stored. Past either cap, the request is a 429 instead. An account on its
// first UTC day, the day it was made, sees a smaller share of the app's
// cap, so accounts made today can't spend the whole app's day
// (m1kuorg/basics#69).
// Workers Free gives the whole Cloudflare account 100,000 D1 rows written a
// day, and every query fails past them, logging in too; the phrasing caps
// keep the app under that.

import type { Caps } from "../config";
import { HttpError } from "../http";
import { newId, type Db } from "./db";

const count = (n: number) => n.toLocaleString("en-US");

/**
 * Counts `n` toward the account's day and the app's, all or nothing, in one
 * batch: the account's count first, only while it and the app's both stay
 * within their caps, the app's being its first day's share while the
 * account was made today; then the app's, only when the account's row holds
 * this request's id, so it moves only when the account's did. A refused
 * request moves neither, so nothing is given back (m1kuorg/basics#70).
 * Which cap refused, or null when both took it: the account's, when both
 * would.
 */
async function spend(db: Db, userId: string, what: "model_requests" | "phrasings", n: number, caps: Caps): Promise<"account" | "site" | "firstDay" | null> {
  const day = new Date().toISOString().slice(0, 10);
  const spendId = newId();
  const accountHasRoom = `coalesce((SELECT ${what} FROM usage WHERE user_id = ?1 AND day = ?2), 0) + ?3 <= ?4`;
  const madeToday = "coalesce((SELECT created_at >= ?6 FROM users WHERE id = ?1), 0)";
  const siteHasRoom = `coalesce((SELECT ${what} FROM site_usage WHERE day = ?2), 0) + ?3 <= CASE WHEN ${madeToday} THEN min(?5, ?7) ELSE ?5 END`;
  const args = [userId, day, n, caps.account, caps.site, Date.parse(day), caps.firstDay];
  const [account, , why] = await db.batch<{ refused: "account" | "site" | "firstDay" }>([
    db
      .prepare(
        `INSERT INTO usage (user_id, day, ${what}, spend_id) SELECT ?1, ?2, ?3, ?8 WHERE ${accountHasRoom} AND ${siteHasRoom}
         ON CONFLICT (user_id, day) DO UPDATE SET ${what} = ${what} + ?3, spend_id = ?8
         RETURNING spend_id`,
      )
      .bind(...args, spendId),
    db
      .prepare(
        `INSERT INTO site_usage (day, ${what}) SELECT ?2, ?3 WHERE EXISTS (SELECT 1 FROM usage WHERE user_id = ?1 AND day = ?2 AND spend_id = ?4)
         ON CONFLICT (day) DO UPDATE SET ${what} = ${what} + ?3`,
      )
      .bind(userId, day, n, spendId),
    // Read only when the account's count was refused, so the counts are as they were before the batch.
    db.prepare(`SELECT CASE WHEN NOT (${accountHasRoom}) THEN 'account' WHEN ${madeToday} AND ?7 < ?5 THEN 'firstDay' ELSE 'site' END AS refused`).bind(...args),
  ]);
  return account!.results.length ? null : why!.results[0]!.refused;
}

/** Counts a model request for the account, or throws 429 past its daily cap or the app's. */
export async function spendModelRequest(db: Db, userId: string, caps: Caps): Promise<void> {
  const refused = await spend(db, userId, "model_requests", 1, caps);
  if (refused === "account") {
    throw new HttpError(429, `You've used today's ${count(caps.account)} model ${caps.account === 1 ? "request" : "requests"}. More open at midnight UTC.`);
  }
  if (refused === "site") throw new HttpError(429, "Asked Before has made all the model requests it can today, across every account. More open at midnight UTC.");
  if (refused === "firstDay") throw new HttpError(429, "Asked Before has made all the model requests it can today for accounts made today. More open at midnight UTC.");
}

/** Counts `n` phrasings the account sent, an upload's chunk or a capture, or throws 429 when they'd pass its daily cap or the app's. */
export async function spendPhrasings(db: Db, userId: string, n: number, caps: Caps): Promise<void> {
  const refused = await spend(db, userId, "phrasings", n, caps);
  if (refused === "account") {
    throw new HttpError(429, `Your account can send ${count(caps.account)} phrasings a day, uploads and captures together, and these would pass today's. More open at midnight UTC.`);
  }
  if (refused === "site") throw new HttpError(429, "These phrasings would pass what Asked Before can take today, across every account. More open at midnight UTC.");
  if (refused === "firstDay") throw new HttpError(429, "These phrasings would pass what Asked Before can take today from accounts made today. More open at midnight UTC.");
}
