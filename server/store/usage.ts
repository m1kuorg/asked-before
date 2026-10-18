// The daily model-request counters, one per account per UTC day. Spending
// one is the daily cap's hook: server/model.ts spends one before every model
// request it makes for an account, and past DAILY_MODEL_REQUESTS that
// request is a 429 instead.

import { HttpError } from "../http";
import type { Db } from "./db";

/** Counts a model request for the account, in one statement, only while the day's count is under `cap`; else throws 429. */
export async function spendModelRequest(db: Db, userId: string, cap: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const spent = await db
    .prepare(
      `INSERT INTO usage (user_id, day, model_requests) VALUES (?1, ?2, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET model_requests = model_requests + 1 WHERE model_requests < ?3
       RETURNING model_requests`,
    )
    .bind(userId, day, cap)
    .first();
  if (!spent) {
    throw new HttpError(429, `You've used today's ${cap} model ${cap === 1 ? "request" : "requests"}. More open at midnight UTC.`);
  }
}
