// The server's settings, read once from the environment. Each has a default,
// so a fresh clone needs only ANTHROPIC_API_KEY (which server/model.ts reads).

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** The public URL, when set. Without it, a request's own origin is the app's origin. */
const publicUrl = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL) : undefined;

export const config = {
  /** 0 takes any free port, as the checks do. */
  port: wholeNumber("PORT", 3000, 0),
  /** The SQLite file. Its folder is made if it's missing. */
  databasePath: process.env.DATABASE_PATH ?? join(ROOT, "data", "asked-before.sqlite"),
  publicUrl,
  /** An https public URL makes the session cookie Secure and __Host- prefixed. */
  https: publicUrl?.protocol === "https:",
  /** Model requests one account may make per UTC day. */
  dailyModelRequests: wholeNumber("DAILY_MODEL_REQUESTS", 300),
  /** Phrasings a sort sends the model at once, beside as many of the project's most recent unsorted ones (server/sort.ts). */
  sortBatchSize: wholeNumber("SORT_BATCH_SIZE", 300),
};

/** A setting that's a whole number of `least` or more, or `fallback` when it's unset. */
function wholeNumber(name: string, fallback: number, least = 1): number {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < least) throw new Error(`${name} must be a whole number of ${least} or more.`);
  return value;
}
