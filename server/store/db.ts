// The store's one SQLite connection (ADR 0003). Opening it applies
// schema.sql and turns on foreign keys, WAL journaling, and a busy timeout.
// Only the modules in server/store/ query it; everything else calls them.

import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config";

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath, { create: true, strict: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA busy_timeout = 5000");
db.run(readFileSync(join(import.meta.dir, "schema.sql"), "utf8"));

/** A new primary key: a time-ordered UUID. */
export const newId = () => Bun.randomUUIDv7();

/** A stored time (Unix milliseconds) as the API sends it. */
export const iso = (ms: number) => new Date(ms).toISOString();
