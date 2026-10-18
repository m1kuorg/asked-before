-- Migration 3: a capture's words as captures compare them
-- (server/store/captures.ts): trimmed, each run of spacing made one space,
-- and lowercased. With them stored, a capture's insert itself checks that
-- the same words weren't captured on the shelf in the ten minutes before,
-- in one D1 batch (m1kuorg/basics#62), where bun:sqlite's transaction had
-- read every recent capture back to compare them first.

ALTER TABLE phrasings ADD COLUMN words TEXT;   -- a capture's words, as compared; empty for an export's phrasing
