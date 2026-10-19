-- Migration 4: the daily caps that keep the app inside Workers Free
-- (m1kuorg/basics#68, store/usage.ts). Beside each account's model requests,
-- `usage` counts the phrasings it sent that day, uploads and captures
-- together, and `site_usage` counts both for the whole app, across every
-- account, one row per UTC day.
-- From here on, users.password_hash holds a salted SHA-256 of the key the
-- SDK derives from the password (server/passwords.ts, ADR 0006), not scrypt.

ALTER TABLE usage ADD COLUMN phrasings INTEGER NOT NULL DEFAULT 0;

CREATE TABLE site_usage (
  day TEXT PRIMARY KEY,                    -- UTC, yyyy-mm-dd
  model_requests INTEGER NOT NULL DEFAULT 0,
  phrasings INTEGER NOT NULL DEFAULT 0
);
