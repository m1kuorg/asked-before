-- Migration 1: the spec's whole schema (m1kuorg/basics#40, Store), as it
-- stood when migrations arrived (m1kuorg/basics#54). server/store/db.ts
-- applies it once, to a fresh database; a later change is a new migration.
-- Times are Unix milliseconds. Every child row is deleted with its parent.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,              -- trimmed and lowercased
  password_hash TEXT NOT NULL,             -- Bun.password's PHC string
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                     -- SHA-256 of the cookie's token, in hex
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_by_user ON sessions(user_id);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,                     -- the <id> in ab_<id>_<secret>
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,               -- SHA-256 of the <secret>, in hex
  created_at INTEGER NOT NULL,
  last_used_at INTEGER                     -- written at most once a minute
);
CREATE INDEX api_keys_by_user ON api_keys(user_id);

CREATE TABLE shelves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX shelves_by_user ON shelves(user_id);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('chatgpt', 'claude')),
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'receiving'
    CHECK (status IN ('receiving', 'waiting', 'sorting', 'sorted', 'failed')),
  error TEXT,                              -- why the sort failed
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX uploads_by_shelf ON uploads(shelf_id);

-- Every one of your messages an upload was sent, by its source id, once:
-- its count is the upload's messages, so a chunk sent twice counts once.
-- The new ones among them are the upload's phrasings.
CREATE TABLE upload_messages (
  upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  PRIMARY KEY (upload_id, source_id)
) WITHOUT ROWID;

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  skill TEXT NOT NULL COLLATE NOCASE,
  lesson TEXT,                             -- written with the card's first rep
  created_at INTEGER NOT NULL,
  UNIQUE (shelf_id, skill)
);

CREATE TABLE phrasings (
  id TEXT PRIMARY KEY,
  shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('export', 'capture')),
  upload_id TEXT REFERENCES uploads(id) ON DELETE CASCADE,   -- empty for a capture
  source_id TEXT NOT NULL,                 -- the export's message id, or a generated one for a capture
  text TEXT NOT NULL,
  time INTEGER NOT NULL,                   -- when you sent it
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,      -- empty while unsorted
  offered_at INTEGER,                      -- when a sort last saw it; empty until then
  created_at INTEGER NOT NULL,
  UNIQUE (shelf_id, source_id),
  CHECK ((origin = 'export') = (upload_id IS NOT NULL))
);
CREATE INDEX phrasings_by_card ON phrasings(card_id);
CREATE INDEX phrasings_by_upload ON phrasings(upload_id);

CREATE TABLE reps (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  problem TEXT NOT NULL,
  answer TEXT,                             -- the rest is empty until the rep is checked, once
  verdict TEXT CHECK (verdict IN ('pass', 'fail')),
  reason TEXT,
  created_at INTEGER NOT NULL,
  checked_at INTEGER
);
CREATE INDEX reps_by_card ON reps(card_id);

CREATE TABLE usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                       -- UTC, yyyy-mm-dd
  model_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- A card's count, first and last borrow, return stamp, and status, for every
-- caller. It compares timestamps, not dates: borrowed while no rep has passed,
-- returned while its last borrow is at or before its last pass, and borrowed
-- again once a borrow comes after that pass.
CREATE VIEW card_status AS
SELECT
  card_id,
  shelf_id,
  borrows,
  first_borrow_at,
  last_borrow_at,
  returned_at,
  CASE
    WHEN returned_at IS NULL THEN 'borrowed'
    WHEN last_borrow_at <= returned_at THEN 'returned'
    ELSE 'borrowed_again'
  END AS status
FROM (
  SELECT
    c.id AS card_id,
    c.shelf_id,
    (SELECT count(*) FROM phrasings p WHERE p.card_id = c.id) AS borrows,
    (SELECT min(p.time) FROM phrasings p WHERE p.card_id = c.id) AS first_borrow_at,
    (SELECT max(p.time) FROM phrasings p WHERE p.card_id = c.id) AS last_borrow_at,
    (SELECT max(r.checked_at) FROM reps r WHERE r.card_id = c.id AND r.verdict = 'pass') AS returned_at
  FROM cards c
);
