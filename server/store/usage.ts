// The daily model-request counters, one per account per UTC day. Spending
// one is the daily cap's hook: server/model.ts spends one before every model
// request it makes for an account, and past DAILY_MODEL_REQUESTS that
// request is a 429 instead.

import { config } from "../config";
import { HttpError } from "../http";
import { db } from "./db";

// Counts the request only while the day's count is under the cap, in one statement.
const spend = db.query(`
  INSERT INTO usage (user_id, day, model_requests) VALUES ($userId, $day, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET model_requests = model_requests + 1 WHERE model_requests < $cap
  RETURNING model_requests
`);

export function spendModelRequest(userId: string): void {
  const cap = config.dailyModelRequests;
  const day = new Date().toISOString().slice(0, 10);
  if (cap < 1 || !spend.get({ userId, day, cap })) {
    throw new HttpError(429, `You've used today's ${cap} model requests. More open at midnight UTC.`);
  }
}
