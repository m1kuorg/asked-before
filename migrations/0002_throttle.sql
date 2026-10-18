-- Migration 2: the per-IP throttle on signing up and logging in
-- (server/store/throttle.ts), kept here since a Worker holds nothing in memory
-- between requests (m1kuorg/basics#61). One row per address, for the window
-- its tries are counted in; signing up and logging in sweep the ended ones.

CREATE TABLE throttle (
  address TEXT PRIMARY KEY,                -- the caller's IP address (CF-Connecting-IP)
  tries INTEGER NOT NULL,
  ends_at INTEGER NOT NULL                 -- when the window ends
);
CREATE INDEX throttle_by_end ON throttle(ends_at);
