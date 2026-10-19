// The Worker's bindings and settings (wrangler.jsonc), read for each request:
// a Worker has no env at module scope. Each setting is a string var with a
// default here, so a fresh clone needs only ANTHROPIC_API_KEY.

import type { DurableObjectNamespace, Rpc } from "@cloudflare/workers-types";
import type { Db } from "./store/db";

/** The sort's Durable Object as a handler reaches it (worker/sorter.ts): one per shelf, named by the shelf's id. */
export interface ShelfSort extends Rpc.DurableObjectBranded {
  /** Starts the shelf's sort, or wakes it once the batch under way is done, to take its next waiting upload. */
  start(): Promise<void>;
}

export type Env = {
  /** The database (D1). Only server/store/ queries it; handlers hand it on. */
  DB: Db;
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
  SITE_DAILY_MODEL_REQUESTS?: string;
  DAILY_PHRASINGS?: string;
  SITE_DAILY_PHRASINGS?: string;
  FIRST_DAY_SITE_DAILY_MODEL_REQUESTS?: string;
  FIRST_DAY_SITE_DAILY_PHRASINGS?: string;
  NETWORK_DAILY_SIGNUPS?: string;
  SORT_BATCH_SIZE?: string;
};

/**
 * A daily cap for each account, and one for the whole app, across every
 * account, both counted per UTC day (store/usage.ts); and `firstDay`, the
 * app's cap as an account on its first UTC day, the day it was made, sees
 * it: a smaller share, so accounts made today can't spend the app's whole day.
 */
export type Caps = { account: number; site: number; firstDay: number };

export type Config = {
  /** The public URL, when set. Without it, a request's own origin is the app's origin. */
  publicUrl: URL | undefined;
  /** An https public URL makes the session cookie Secure and __Host- prefixed. */
  https: boolean;
  /** Model requests per UTC day. */
  dailyModelRequests: Caps;
  /**
   * Phrasings sent per UTC day, uploads and captures together, which keep
   * the app under D1 Free's 100,000 rows written a day: each phrasing
   * stored and sorted writes 7 to 9.
   */
  dailyPhrasings: Caps;
  /** Accounts one network, an IPv4 address or an IPv6 /64, may make per UTC day (store/users.ts). */
  dailySignups: number;
  /** Phrasings a sort sends the model at once, beside as many of the shelf's most recent unsorted ones (server/sort.ts). */
  sortBatchSize: number;
};

/** The settings, or an error naming the one that's wrong, which the Worker answers as a 500. */
export function readConfig(env: Env): Config {
  const publicUrl = env.PUBLIC_URL ? new URL(env.PUBLIC_URL) : undefined;
  return {
    publicUrl,
    https: publicUrl?.protocol === "https:",
    dailyModelRequests: {
      account: wholeNumber(env, "DAILY_MODEL_REQUESTS", 10),
      site: wholeNumber(env, "SITE_DAILY_MODEL_REQUESTS", 200),
      firstDay: wholeNumber(env, "FIRST_DAY_SITE_DAILY_MODEL_REQUESTS", 100),
    },
    dailyPhrasings: {
      account: wholeNumber(env, "DAILY_PHRASINGS", 1000),
      site: wholeNumber(env, "SITE_DAILY_PHRASINGS", 8000),
      firstDay: wholeNumber(env, "FIRST_DAY_SITE_DAILY_PHRASINGS", 4000),
    },
    dailySignups: wholeNumber(env, "NETWORK_DAILY_SIGNUPS", 3),
    sortBatchSize: wholeNumber(env, "SORT_BATCH_SIZE", 300),
  };
}

/** A setting that's a whole number of 1 or more, or `fallback` when it's unset. */
function wholeNumber(
  env: Env,
  name:
    | "DAILY_MODEL_REQUESTS"
    | "SITE_DAILY_MODEL_REQUESTS"
    | "FIRST_DAY_SITE_DAILY_MODEL_REQUESTS"
    | "DAILY_PHRASINGS"
    | "SITE_DAILY_PHRASINGS"
    | "FIRST_DAY_SITE_DAILY_PHRASINGS"
    | "NETWORK_DAILY_SIGNUPS"
    | "SORT_BATCH_SIZE",
  fallback: number,
): number {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a whole number of 1 or more.`);
  return value;
}
