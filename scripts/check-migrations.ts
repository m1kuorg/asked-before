// Checks the schema's migrations (m1kuorg/basics#54): the files in
// server/store/migrations/, which the app applies at startup, in order,
// each once, in one transaction, recording them in the database. A fresh
// database gets migration 1, the whole schema. Ada fills it through the
// SDK, with the model a stand-in in this script that sorts as the demo
// export's answer key does and passes a cold rep, and a restart applies
// nothing again. Then a copy of the app, in a temporary folder, gets a
// migration 2 that the repo doesn't have: it rebuilds the cards table, the
// one change SQLite can't make in place, beneath the phrasings and reps
// that point at it. Started on Ada's database, the copy applies it, and
// her download, her session, and her API key are as they were. A third
// migration that fails, by a statement or by leaving a rep on no card,
// stops the app and applies nothing. On a fresh database, the copy applies
// both migrations and ends with the migrated database's schema. It needs
// no key, and exits 1 if any check fails, naming the step.
// Run: bun run check:migrations

import { ApiError, createClient, type AccountData } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { phrasings, sortEnds, upload } from "./lib/answer-key";
import { browser, freePort, startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";
import { known, repReply, sortsByKey, verdictReply } from "./lib/reps";

const ROOT = join(import.meta.dir, "..");

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof ApiError ? `${error.status} ` : ""}${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

/** Reads a database the app has closed or still holds, and closes it again. */
function read<T>(path: string, run: (store: Database) => T): T {
  const store = new Database(path, { readonly: true, strict: true });
  try {
    return run(store);
  } finally {
    store.close();
  }
}

/** The migrations a database records, in the order they were applied, as "1 0001-schema.sql". */
const recorded = (path: string) =>
  read(path, (store) => store.query<{ version: number; name: string }, []>("SELECT version, name FROM migrations ORDER BY applied_at, version").all().map((m) => `${m.version} ${m.name}`));

/** The tables and views a database holds, by name. */
const tables = (path: string) =>
  read(path, (store) => store.query<{ name: string }, []>("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY name").all().map((t) => t.name));

/** A database's tables, indexes, and views, as the statements that made them. */
const schema = (path: string) =>
  read(path, (store) => JSON.stringify(store.query("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name").all()));

// The spec's tables (m1kuorg/basics#40, Store), with the uploads' messages, the card_status view, and the migrations the database records.
const SCHEMA = ["api_keys", "card_status", "cards", "migrations", "phrasings", "reps", "sessions", "shelves", "upload_messages", "uploads", "usage", "users"];

/** What an account's download holds, in counts, to say what survived. */
function held(data: AccountData): string {
  const all = data.shelves.flatMap((p) => p.phrasings);
  const cards = data.shelves.flatMap((p) => p.cards);
  const reps = cards.flatMap((c) => c.reps);
  const A = cards.find((c) => c.skill === known.skill);
  return `${data.shelves.length} shelf(s), ${data.shelves.flatMap((p) => p.uploads).length} upload(s), ${all.length} phrasings (${all.filter((p) => p.cardId).length} on ${cards.length} cards), ${reps.length} rep(s), card A ${A?.status ?? "missing"}`;
}

/** An account's download without the time it was made, to compare one with another. */
const kept = ({ exportedAt: _, ...data }: AccountData) => JSON.stringify(data);

/**
 * A copy of the app's files, sharing this repo's installed packages, to add
 * a migration to without touching the repo.
 */
async function copyApp(): Promise<string> {
  const copy = join(work, "app");
  for (const path of ["package.json", "tsconfig.json", "server.ts", "server", "src", "public", "demo", "packages"]) {
    await cp(join(ROOT, path), join(copy, path), { recursive: true, verbatimSymlinks: true });
  }
  await symlink(join(ROOT, "node_modules"), join(copy, "node_modules"));
  return copy;
}

/**
 * Migration 2, for this check only: the cards table rebuilt with a pinned
 * column, as SQLite changes what ALTER TABLE can't, beneath the phrasings
 * and reps that point at it. Its view goes first and comes back after. The
 * table and the view are as the database holds them.
 */
function rebuildCards(path: string): string {
  const [cards, view] = read(path, (store) => ["cards", "card_status"].map((name) => store.query<{ sql: string }, [string]>("SELECT sql FROM sqlite_schema WHERE name = ?").get(name)!.sql));
  return [
    "-- Migration 2, from check:migrations: cards rebuilt with a pinned column.",
    "DROP VIEW card_status;",
    `${cards!.replace(/^CREATE TABLE cards \(/, "CREATE TABLE cards_new (\n  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),")};`,
    "INSERT INTO cards_new SELECT 0, * FROM cards;",
    "DROP TABLE cards;",
    "ALTER TABLE cards_new RENAME TO cards;",
    `${view};`,
    "",
  ].join("\n");
}

const work = await mkdtemp(join(tmpdir(), "asked-before-migrations-"));
const databasePath = join(work, "app.sqlite");

// Sorts end as the answer key sorts, and rep and check requests get the answers queued for them.
const model = await startModelStub(sortsByKey(refuse()));
// One port for every start on Ada's database, so her browser keeps its address and its session cookie.
const port = freePort();
const env = { DATABASE_PATH: databasePath, ANTHROPIC_BASE_URL: model.url, PORT: String(port) };
const ada = browser(`http://localhost:${port}`);

/** Starts the app (the repo's, or `root`'s) on the database, runs `run` against it, and stops it. */
async function onDatabase(run: () => Promise<void>, root?: string) {
  const app = await startApp(env, root);
  try {
    await run();
  } finally {
    await app.stop();
  }
}

let before: AccountData;
let apiKey = "";
let copy = "";

try {
  await step("1. A fresh database gets migration 1, the whole schema", async () => {
    await onDatabase(async () => {});
    check(recorded(databasePath).join() === "1 0001-schema.sql", `it records ${recorded(databasePath).join(", ") || "nothing"}`);
    const names = tables(databasePath);
    check(names.join() === SCHEMA.join(), `it holds ${names.join(", ")}`);
  });

  await step("2. Data made through the API, on migration 1 alone", async () => {
    await onDatabase(async () => {
      await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
      apiKey = (await ada.client.keys.create({ name: "Script" })).key;
      const demo = await ada.client.shelves.create({ name: "Demo", demo: true });
      const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
      const A = (await ada.client.cards.list(demo.id)).find((c) => c.skill === known.skill)!;
      model.queue(repReply("You committed to main by mistake. What do you do?"));
      const { rep } = await ada.client.reps.start(A.id);
      model.queue(verdictReply("pass", "A stand-in's reason."));
      const checked = await ada.client.reps.check(rep.id, { answer: known.right });
      check(sorted.status === "sorted" && checked.card.status === "returned", `the demo export sorted, and card A ${checked.card.status} after a cold rep`);
      before = await ada.client.account.export();
      check(before.shelves[0]!.cards.length > 1, `Ada's download holds ${held(before)}`);
    });
  });

  await step("3. Restarted, the app applies nothing again", async () => {
    await onDatabase(async () => {
      const after = await ada.client.account.export();
      check(kept(after) === kept(before), `Ada's download is as it was: ${held(after)}`);
    });
    check(recorded(databasePath).join() === "1 0001-schema.sql", `the database still records ${recorded(databasePath).join(", ")}`);
  });

  await step("4. A copy of the app with migration 2, which rebuilds the cards table, applies it to that data", async () => {
    copy = await copyApp();
    await Bun.write(join(copy, "server", "store", "migrations", "0002-pin-cards.sql"), rebuildCards(databasePath));
    await onDatabase(async () => {
      const after = await ada.client.account.export();
      check(kept(after) === kept(before), `Ada's download is as it was: ${held(after)}`);
      const me = await ada.client.auth.me();
      const byKey = await createClient({ baseUrl: `http://localhost:${port}`, apiKey }).shelves.list();
      check(me.email === "ada@example.com" && byKey.length === 1, `Ada's session and her API key still work (${byKey.map((p) => p.name).join()})`);
    }, copy);
    check(recorded(databasePath).join() === "1 0001-schema.sql,2 0002-pin-cards.sql", `the database records ${recorded(databasePath).join(", ")}`);
    const pinned = read(databasePath, (store) => store.query<{ cards: number; unpinned: number }, []>("SELECT count(*) AS cards, sum(pinned = 0) AS unpinned FROM cards").get()!);
    check(pinned.cards === before.shelves[0]!.cards.length && pinned.unpinned === pinned.cards, `cards has its pinned column, unpinned on all ${pinned.cards} cards`);
  });

  await step("5. A migration that fails applies nothing, and the app doesn't start until it's gone", async () => {
    const broken = join(copy, "server", "store", "migrations", "0003-archive-shelves.sql");
    const archive = "ALTER TABLE shelves ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;\n";
    const failings = [
      { what: "a statement that fails", sql: `${archive}SELECT * FROM no_such_table;\n`, says: "no such table: no_such_table" },
      { what: "a rep left on no card", sql: `${archive}INSERT INTO reps (id, card_id, problem, created_at) VALUES ('stray', 'no-such-card', 'A rep on no card.', 0);\n`, says: "reps" },
    ];
    for (const { what, sql, says } of failings) {
      await Bun.write(broken, sql);
      const said = await startApp(env, copy).then(
        async (app) => (await app.stop(), "it started"),
        (error: Error) => error.message.split("\n").find((line) => line.includes("0003-")) ?? error.message,
      );
      check(said.includes("Migration 0003-archive-shelves.sql failed") && said.includes(says), `with ${what}, the app stops: ${said.trim()}`);
      const columns = read(databasePath, (store) => store.query<{ name: string }, []>("SELECT name FROM pragma_table_info('shelves')").all().map((c) => c.name));
      const stray = read(databasePath, (store) => store.query<{ n: number }, []>("SELECT count(*) AS n FROM reps WHERE id = 'stray'").get()!.n);
      check(recorded(databasePath).join() === "1 0001-schema.sql,2 0002-pin-cards.sql" && !columns.includes("archived") && stray === 0, `and the database is as migration 2 left it: ${recorded(databasePath).join(", ")}, ${columns.includes("archived") ? "an" : "no"} archived column, ${stray} stray rep(s)`);
    }
    await rm(broken);
    await onDatabase(async () => {
      const after = await ada.client.account.export();
      check(kept(after) === kept(before), `with the migration gone, it starts, and Ada's download is as it was: ${held(after)}`);
    }, copy);
  });

  await step("6. On a fresh database, the copy applies every migration, in order", async () => {
    const fresh = await startApp({ ANTHROPIC_BASE_URL: model.url }, copy);
    try {
      check(recorded(fresh.databasePath).join() === "1 0001-schema.sql,2 0002-pin-cards.sql", `it records ${recorded(fresh.databasePath).join(", ")}`);
      check(schema(fresh.databasePath) === schema(databasePath), "its schema is the migrated database's, table for table");
      const bea = fresh.browser();
      await bea.client.auth.signUp({ name: "Bea", email: "bea@example.com", password: "difference engine" });
      const made = await bea.client.shelves.create({ name: "Study" });
      check((await bea.client.shelves.list()).map((p) => p.id).join() === made.id, `and the app works on it: Bea signs up and makes "${made.name}"`);
    } finally {
      await fresh.stop();
    }
  });
} finally {
  model.stop();
  await rm(work, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nMigrations keep the data.");
process.exit(failures.length ? 1 : 0);
