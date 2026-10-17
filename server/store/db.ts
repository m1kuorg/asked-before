// The store's one SQLite connection (ADR 0003). Opening it turns on WAL
// journaling and a busy timeout, applies the migrations in migrations/
// that the database hasn't had yet, and then turns on foreign keys.
// Only the modules in server/store/ query it; everything else calls them.
// Beside it, what the store's modules share: new ids, times as the API
// sends them, and the random tokens and hashes behind sessions and keys.

import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config";

const MIGRATIONS = join(import.meta.dir, "migrations");

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath, { create: true, strict: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");
migrate();
db.run("PRAGMA foreign_keys = ON");

/**
 * Applies every file in migrations/ named `<4-digit version>-<what>.sql`
 * that the database hasn't recorded, in order of version, in one
 * transaction that records each in the migrations table. Foreign keys are
 * still off, as SQLite's steps for rebuilding a table need, so dropping a
 * parent table deletes nothing beneath it; instead, a migration that
 * leaves a row pointing at one that isn't there fails. Any failure undoes
 * them all, and the server doesn't start. The transaction takes the write
 * lock first, so another process opening the file waits, then finds them
 * recorded.
 */
function migrate() {
  const files = readdirSync(MIGRATIONS).filter((name) => /^\d{4}-[\w-]+\.sql$/.test(name)).sort();
  db.transaction(() => {
    db.run("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)");
    const applied = new Set(db.query<{ version: number }, []>("SELECT version FROM migrations").all().map((m) => m.version));
    const record = db.query("INSERT INTO migrations (version, name, applied_at) VALUES ($version, $name, $now)");
    for (const name of files) {
      const version = Number(name.slice(0, 4));
      if (applied.has(version)) continue;
      try {
        db.run(readFileSync(join(MIGRATIONS, name), "utf8"));
        const dangling = db.query<{ table: string }, []>("PRAGMA foreign_key_check").all();
        if (dangling.length) throw new Error(`it leaves rows in ${[...new Set(dangling.map((row) => row.table))].join(", ")} pointing at rows that aren't there`);
      } catch (error) {
        throw new Error(`Migration ${name} failed, so none were applied: ${error instanceof Error ? error.message : String(error)}`);
      }
      record.run({ version, name, now: Date.now() });
    }
  }).immediate();
}

/** A new primary key: a time-ordered UUID. */
export const newId = () => Bun.randomUUIDv7();

/** A stored time (Unix milliseconds) as the API sends it. */
export const iso = (ms: number) => new Date(ms).toISOString();

/** A secret's SHA-256, in hex, which is all the store keeps of a session's token or a key's secret. */
export const sha256 = (secret: string) => new Bun.CryptoHasher("sha256").update(secret).digest("hex");

/** `bytes` random bytes, as base64url for a cookie's token or hex for a key's parts. */
export const randomToken = (bytes: number, encoding: "base64url" | "hex") => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(encoding);
