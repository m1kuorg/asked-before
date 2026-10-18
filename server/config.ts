// The Worker's bindings and settings (wrangler.jsonc), read for each request:
// a Worker has no env at module scope. Each setting is a string var with a
// default here, so a fresh clone needs only ANTHROPIC_API_KEY.

import type { D1Database, DurableObjectNamespace, Rpc } from "@cloudflare/workers-types";

/** The sort's Durable Object as a handler reaches it (worker/sorter.ts): one per shelf, named by the shelf's id. */
export interface ShelfSort extends Rpc.DurableObjectBranded {
  /** Starts the shelf's sort, or wakes it once the batch under way is done, to take its next waiting upload. */
  start(): Promise<void>;
}

export type Env = {
  /** The database (D1). Only server/store/ queries it; handlers hand it on. */
  DB: D1Database;
  /** Each shelf's sort (server/sort.ts), started when an upload finishes or a failed one is retried. */
  SORTER: DurableObjectNamespace<ShelfSort>;
  /** The model's key (server/model.ts): a Worker secret, and locally from .env or the shell. */
  ANTHROPIC_API_KEY?: string;
  /** Where model requests go instead of Anthropic's API: only a check sets it, to its stand-in (scripts/lib/model-stub.ts). */
  ANTHROPIC_BASE_URL?: string;
  /** A fault in the sort's Durable Object (worker/sorter.ts): only a check sets it. "start" makes every start() throw, and "database" every query an alarm makes. */
  SORTER_FAULT?: "start" | "database";
  PUBLIC_URL?: string;
  DAILY_MODEL_REQUESTS?: string;
  SORT_BATCH_SIZE?: string;
};

export type Config = {
  /** The public URL, when set. Without it, a request's own origin is the app's origin. */
  publicUrl: URL | undefined;
  /** An https public URL makes the session cookie Secure and __Host- prefixed. */
  https: boolean;
  /** Model requests one account may make per UTC day. */
  dailyModelRequests: number;
  /** Phrasings a sort sends the model at once, beside as many of the shelf's most recent unsorted ones (server/sort.ts). */
  sortBatchSize: number;
};

/** The settings, or an error naming the one that's wrong, which the Worker answers as a 500. */
export function readConfig(env: Env): Config {
  const publicUrl = env.PUBLIC_URL ? new URL(env.PUBLIC_URL) : undefined;
  return {
    publicUrl,
    https: publicUrl?.protocol === "https:",
    dailyModelRequests: wholeNumber(env, "DAILY_MODEL_REQUESTS", 300),
    sortBatchSize: wholeNumber(env, "SORT_BATCH_SIZE", 300),
  };
}

/** A setting that's a whole number of 1 or more, or `fallback` when it's unset. */
function wholeNumber(env: Env, name: "DAILY_MODEL_REQUESTS" | "SORT_BATCH_SIZE", fallback: number): number {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a whole number of 1 or more.`);
  return value;
}
