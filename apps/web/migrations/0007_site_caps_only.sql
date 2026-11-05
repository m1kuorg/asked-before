-- Migration 7: the daily caps are the app's alone, one for model requests
-- and one for phrasings, counted once for everyone in `site_usage`
-- (m1kuorg/basics#73, store/usage.ts). Each account's own counts in
-- `usage`, from migrations 1, 4, and 5, count nothing now.

DROP TABLE usage;
