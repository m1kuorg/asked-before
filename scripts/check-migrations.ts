// Checks the schema's migrations on D1 (m1kuorg/basics#63): the files in
// migrations/, which `wrangler d1 migrations apply DB --local` applies
// before startApp() starts `wrangler dev`, in order, each once, recording
// each in d1_migrations. Locally, Wrangler (4.151.1) runs each migration,
// with the insert that records it, as one D1 batch, one transaction, and
// stops at the first that fails. A fresh database gets every migration.
// Ada fills it through the SDK, with the model a stand-in in this script
// that sorts as the demo export's answer key does and answers her cold
// reps, and a restart applies nothing again. Then a copy of the app, in a
// temporary folder, gets a migration the repo doesn't have, numbered after
// its last, rebuilding the cards table, which ALTER TABLE can't change,
// beneath the phrasings and reps that point at it. D1 keeps foreign keys
// on, so dropping cards deletes every rep and empties every phrasing's
// card: on a copy of Ada's state, the rebuild alone loses them, as
// docs/code-map.md warns. With the map's recipe, copying them aside first
// and back after, it keeps every rep and every phrasing's card, read in the
// database and in her download, and her session and API key. A migration that fails, by a statement or by
// leaving a rep on no card, applies nothing, and the app doesn't start;
// one before it in the same run stays applied. On a fresh database, the
// copy applies every migration and ends with the migrated database's
// schema. It needs no key, and exits 1 if any check fails, naming the step.
// Run: bun run check:migrations

import { ApiError, createClient, type AccountData } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { cp, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { phrasings, sortEnds, upload } from "./lib/answer-key";
import { browser, databaseIn, freePort, startApp } from "./lib/app";
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

/** Reads a local D1 database with bun:sqlite, read-only, and closes it again. */
function read<T>(path: string, run: (store: Database) => T): T {
  const store = new Database(path, { readonly: true, strict: true });
  try {
    return run(store);
  } finally {
    store.close();
  }
}

/** The migrations a database records in d1_migrations, in the order they were applied. */
const recorded = (path: string) => read(path, (store) => store.query<{ name: string }, []>("SELECT name FROM d1_migrations ORDER BY id").all().map((m) => m.name));

/** The app's tables and views, by name, without D1's and SQLite's own. */
const tables = (path: string) =>
  read(path, (store) =>
    store.query<{ name: string }, []>("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name").all().map((t) => t.name),
  );

/** A database's tables, indexes, and views, as the statements that made them, without D1's own. */
const schema = (path: string) =>
  read(path, (store) => JSON.stringify(store.query("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY type, name").all()));

/** A table's columns, by name. */
const columns = (path: string, table: string) => read(path, (store) => store.query<{ name: string }, [string]>("SELECT name FROM pragma_table_info(?)").all(table).map((c) => c.name));

/** Every rep, whole, and every phrasing's card, read in the database: what a rebuild of the cards table must keep. */
const links = (path: string) =>
  read(path, (store) => ({
    reps: store.query<Record<string, unknown>, []>("SELECT * FROM reps ORDER BY id").all(),
    cardOf: store.query<{ id: string; card_id: string | null }, []>("SELECT id, card_id FROM phrasings ORDER BY id").all(),
  }));
type Links = ReturnType<typeof links>;
const onCards = (l: Links) => l.cardOf.filter((p) => p.card_id !== null).length;

// The app's own tables, with the uploads' messages, the throttle, the daily caps' counters, the card_status view, and Wrangler's record of the migrations.
const SCHEMA = ["api_keys", "card_status", "cards", "d1_migrations", "phrasings", "reps", "sessions", "shelves", "site_usage", "throttle", "upload_messages", "uploads", "users"];

/** The repo's migrations, as Wrangler lists them: the .sql files in migrations/, in name order. */
const MIGRATIONS = (await readdir(join(ROOT, "migrations"))).filter((file) => file.endsWith(".sql")).sort();

/** The check's own migrations, which the repo doesn't have, numbered after its last: the rebuild, a good one, and a failing one. */
const numbered = (after: number, name: string) => `${String(MIGRATIONS.length + after).padStart(4, "0")}_${name}.sql`;
const PIN = numbered(1, "pin_cards");
const ARCHIVE = numbered(2, "archive_shelves");
const LABEL = numbered(3, "label_cards");

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

/** A failed start's error from Wrangler, on one line, without its colors. */
const said = (error: Error) =>
  error.message
    .split("\n")
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim())
    .find((line) => line.includes("[ERROR]")) ?? error.message.split("\n")[0]!;

/** A copy of the app's files in the work folder, sharing this repo's installed packages, to add migrations to without touching the repo. */
async function copyApp(name: string): Promise<string> {
  const copy = join(work, name);
  const paths = ["package.json", "tsconfig.json", "tsconfig.base.json", "wrangler.jsonc", "worker", "server", "src", "public", "demo", "packages", "migrations", "components.json", join("scripts", "build-pages.ts"), join("scripts", "tailwind-plugin.ts")];
  for (const path of paths) await cp(join(ROOT, path), join(copy, path), { recursive: true, verbatimSymlinks: true });
  await symlink(join(ROOT, "node_modules"), join(copy, "node_modules"));
  return copy;
}

/**
 * PIN, a migration for this check only: the cards table rebuilt with a
 * pinned column, as SQLite changes what ALTER TABLE can't. Its view goes
 * first and comes back after. With `copyAside`, it follows the code map's
 * recipe for D1, whose foreign keys stay on: the reps and the phrasings'
 * cards are copied aside before the old table is dropped and put back after.
 * The table and the view are as the database holds them.
 */
function rebuildCards(path: string, { copyAside }: { copyAside: boolean }): string {
  const [cards, view] = read(path, (store) => ["cards", "card_status"].map((name) => store.query<{ sql: string }, [string]>("SELECT sql FROM sqlite_schema WHERE name = ?").get(name)!.sql));
  const rebuild = [
    "DROP VIEW card_status;",
    `${cards!.replace(/^CREATE TABLE cards \(/, "CREATE TABLE cards_new (\n  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),")};`,
    "INSERT INTO cards_new SELECT 0, * FROM cards;",
    "DROP TABLE cards;",
    "ALTER TABLE cards_new RENAME TO cards;",
  ];
  const aside = ["CREATE TABLE keep_reps AS SELECT * FROM reps;", "CREATE TABLE keep_card_ids AS SELECT id, card_id FROM phrasings WHERE card_id IS NOT NULL;"];
  const back = [
    "INSERT INTO reps SELECT * FROM keep_reps;",
    "UPDATE phrasings SET card_id = (SELECT k.card_id FROM keep_card_ids k WHERE k.id = phrasings.id) WHERE id IN (SELECT id FROM keep_card_ids);",
    "DROP TABLE keep_reps;",
    "DROP TABLE keep_card_ids;",
  ];
  return [
    `-- Migration ${PIN}, from check:migrations: cards rebuilt with a pinned column${copyAside ? ", its children copied aside and back" : ", alone"}.`,
    ...(copyAside ? [...aside, ...rebuild, ...back] : rebuild),
    `${view};`,
    "",
  ].join("\n");
}

const work = await mkdtemp(join(tmpdir(), "asked-before-migrations-"));
/** Ada's local state, kept across every start on it. */
const state = join(work, "state");
const databaseOf = (folder: string) => {
  const path = databaseIn(folder);
  if (!path) throw new Error(`No local D1 database in ${folder}.`);
  return path;
};

// Sorts end as the answer key sorts, and rep and check requests get the answers queued for them.
const model = await startModelStub(sortsByKey(refuse()));
const env = { ANTHROPIC_BASE_URL: model.url };
// One port for every start on Ada's state, so her browser keeps its address and its session cookie.
const port = freePort();
const ada = browser(`http://localhost:${port}`);

/** Starts the app (the repo's, or `root`'s) on a state, Ada's by default, runs `run` against it, and stops it. */
async function onState(run: () => Promise<void>, { root, on = state }: { root?: string; on?: string } = {}) {
  const app = await startApp(env, { state: on, port, root });
  try {
    await run();
  } finally {
    await app.stop();
  }
}

let before: AccountData;
let linked: Links;
let apiKey = "";
let copy = "";

try {
  await step("1. A fresh database gets every migration, in order, the whole schema", async () => {
    await onState(async () => {});
    const names = recorded(databaseOf(state));
    check(names.join() === MIGRATIONS.join(), `d1_migrations records ${names.join(", ") || "nothing"}`);
    check(tables(databaseOf(state)).join() === SCHEMA.join(), `it holds ${tables(databaseOf(state)).join(", ")}`);
  });

  await step("2. Data made through the API: a sorted shelf, and cold reps passed, failed, and open", async () => {
    await onState(async () => {
      await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
      apiKey = (await ada.client.keys.create({ name: "Script" })).key;
      const demo = await ada.client.shelves.create({ name: "Demo", demo: true });
      const sorted = await sortEnds(ada.client, (await upload(ada.client, demo.id, phrasings, "demo-export.json")).id);
      const cards = await ada.client.cards.list(demo.id);
      const A = cards.find((c) => c.skill === known.skill)!;
      const [B, C] = cards.filter((c) => c.id !== A.id);
      model.queue(repReply("You committed to main by mistake. What do you do?"), verdictReply("pass", "A stand-in's reason."));
      const passed = await ada.client.reps.check((await ada.client.reps.start(A.id)).rep.id, { answer: known.right });
      model.queue(repReply("A stand-in's problem."), verdictReply("fail", "A stand-in's reason."));
      const failed = await ada.client.reps.check((await ada.client.reps.start(B!.id)).rep.id, { answer: "A wrong answer." });
      model.queue(repReply("A stand-in's open problem."));
      await ada.client.reps.start(C!.id);
      check(sorted.status === "sorted" && passed.card.status === "returned" && failed.rep.verdict === "fail", `the demo export sorted, card A ${passed.card.status}, and card B's rep ${failed.rep.verdict}ed`);
      before = await ada.client.account.export();
      check(before.shelves[0]!.cards.length > 2, `Ada's download holds ${held(before)}`);
    });
    linked = links(databaseOf(state));
    check(linked.reps.length === 3 && onCards(linked) > 0 && onCards(linked) < linked.cardOf.length, `the database holds ${linked.reps.length} reps and ${onCards(linked)} of ${linked.cardOf.length} phrasings on a card`);
  });

  await step("3. Restarted, the app applies nothing again", async () => {
    await onState(async () => {
      const after = await ada.client.account.export();
      check(kept(after) === kept(before), `Ada's download is as it was: ${held(after)}`);
    });
    check(recorded(databaseOf(state)).join() === MIGRATIONS.join(), `the database still records ${recorded(databaseOf(state)).join(", ")}`);
  });

  await step("4. On a copy of Ada's state, rebuilding the cards table alone loses every rep and every phrasing's card", async () => {
    const naive = await copyApp("naive");
    await Bun.write(join(naive, "migrations", PIN), rebuildCards(databaseOf(state), { copyAside: false }));
    const copied = join(work, "state-naive");
    await cp(state, copied, { recursive: true });
    await onState(
      async () => {
        const after = await ada.client.account.export();
        const reps = after.shelves.flatMap((p) => p.cards.flatMap((c) => c.reps)).length;
        const onACard = after.shelves.flatMap((p) => p.phrasings).filter((p) => p.cardId).length;
        check(reps === 0 && onACard === 0, `Ada's download is left with ${held(after)}`);
      },
      { root: naive, on: copied },
    );
    const lost = links(databaseOf(copied));
    check(lost.reps.length === 0 && onCards(lost) === 0, `the cascade deleted every rep (${lost.reps.length} left of ${linked.reps.length}) and emptied every phrasing's card (${onCards(lost)} left of ${onCards(linked)})`);
    await rm(copied, { recursive: true, force: true });
  });

  await step("5. With the recipe, copying them aside first, the rebuild keeps every rep and every phrasing's card", async () => {
    copy = await copyApp("app");
    await Bun.write(join(copy, "migrations", PIN), rebuildCards(databaseOf(state), { copyAside: true }));
    await onState(
      async () => {
        const after = await ada.client.account.export();
        check(kept(after) === kept(before), `Ada's download is as it was: ${held(after)}`);
        const me = await ada.client.auth.me();
        const byKey = await createClient({ baseUrl: `http://localhost:${port}`, apiKey }).shelves.list();
        check(me.email === "ada@example.com" && byKey.length === 1, `Ada's session and her API key still work (${byKey.map((p) => p.name).join()})`);
      },
      { root: copy },
    );
    const database = databaseOf(state);
    check(recorded(database).join() === [...MIGRATIONS, PIN].join(), `the database records ${recorded(database).join(", ")}`);
    const now = links(database);
    check(Bun.deepEquals(now, linked, true), `every rep, whole (${now.reps.length} of ${linked.reps.length}), and every phrasing's card (${onCards(now)} of ${onCards(linked)}) are as they were`);
    const pinned = read(database, (store) => store.query<{ cards: number; unpinned: number }, []>("SELECT count(*) AS cards, sum(pinned = 0) AS unpinned FROM cards").get()!);
    check(pinned.cards === before.shelves[0]!.cards.length && pinned.unpinned === pinned.cards, `cards has its pinned column, unpinned on all ${pinned.cards} cards`);
    check(tables(database).join() === SCHEMA.join(), "the copies are gone, and the view is back");
  });

  await step("6. A migration that fails applies nothing, and the app doesn't start until it's gone", async () => {
    const database = databaseOf(state);
    const applied = recorded(database).join();
    const archive = "ALTER TABLE shelves ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;\n";
    const failings = [
      { what: "a statement that fails", sql: `${archive}SELECT * FROM no_such_table;\n`, says: "no such table: no_such_table" },
      { what: "a rep left on no card", sql: `${archive}INSERT INTO reps (id, card_id, problem, created_at) VALUES ('stray', 'no-such-card', 'A rep on no card.', 0);\n`, says: "FOREIGN KEY constraint failed" },
    ];
    const broken = join(copy, "migrations", ARCHIVE);
    for (const { what, sql, says } of failings) {
      await Bun.write(broken, sql);
      const result = await startApp(env, { state, port, root: copy }).then(
        async (app) => (await app.stop(), "it started"),
        (error: Error) => said(error),
      );
      check(result.includes(says), `with ${what}, the app doesn't start: ${result}`);
      const stray = read(database, (store) => store.query<{ n: number }, []>("SELECT count(*) AS n FROM reps WHERE id = 'stray'").get()!.n);
      const archived = columns(database, "shelves").includes("archived");
      check(recorded(database).join() === applied && !archived && stray === 0, `and the database is as ${PIN} left it: no ${ARCHIVE} recorded, ${archived ? "an" : "no"} archived column, ${stray} stray rep(s)`);
    }

    await Bun.write(broken, archive);
    await Bun.write(join(copy, "migrations", LABEL), "ALTER TABLE cards ADD COLUMN label TEXT;\nSELECT * FROM no_such_table;\n");
    const result = await startApp(env, { state, port, root: copy }).then(
      async (app) => (await app.stop(), "it started"),
      (error: Error) => said(error),
    );
    const labelled = columns(database, "cards").includes("label");
    check(result.includes("no such table") && recorded(database).at(-1) === ARCHIVE && columns(database, "shelves").includes("archived") && !labelled, `with a good ${ARCHIVE} and a failing ${LABEL} in one run, the first stays applied and the second doesn't: ${recorded(database).slice(-2).join(", ")}, ${labelled ? "a" : "no"} label column`);
    await rm(join(copy, "migrations", LABEL));

    await onState(
      async () => {
        const after = await ada.client.account.export();
        check(kept(after) === kept(before), `with ${LABEL} gone, it starts, and Ada's download is as it was: ${held(after)}`);
      },
      { root: copy },
    );
  });

  await step("7. On a fresh database, the copy applies every migration, in order", async () => {
    const fresh = await startApp(env, { root: copy });
    try {
      const names = recorded(fresh.databasePath);
      check(names.join() === [...MIGRATIONS, PIN, ARCHIVE].join(), `it records ${names.join(", ")}`);
      check(schema(fresh.databasePath) === schema(databaseOf(state)), "its schema is the migrated database's, table for table");
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
