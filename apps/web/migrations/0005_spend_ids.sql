-- Migration 5: the daily caps' counters moved all or nothing
-- (m1kuorg/basics#70, store/usage.ts). A request counts toward its
-- account's day and the app's in one D1 batch: the account's count first,
-- only while both caps have room, then the app's, only when the account's
-- row holds this request's id, so a refused request moves neither, and
-- nothing is ever given back.

ALTER TABLE usage ADD COLUMN spend_id TEXT;   -- the last request counted on the row
