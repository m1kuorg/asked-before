-- Migration 6: the shared Guest account (m1kuorg/basics#73), which anyone
-- signs in as without a password (server/api/auth.ts), so every guest
-- shares its shelves, cards, uploads, and reps: the guest workspace. Its
-- email has no @, so no one can sign up with it, and its password hash
-- isn't one server/passwords.ts stores, so no key matches it. The triggers
-- hold it whole beneath the API's own 403s: it can't be renamed, moved to
-- another email or password, deleted, or given an API key.
-- `site_usage.guest_reset` marks the UTC day whose guest workspace has been
-- wiped and given back its sorted demo shelf (server/store/guest.ts).

INSERT INTO users (id, name, email, password_hash, created_at) VALUES ('guest', 'Guest', 'guest', 'none', 1792368000000);

CREATE TRIGGER guest_stays_as_it_is BEFORE UPDATE OF id, name, email, password_hash ON users WHEN OLD.id = 'guest'
BEGIN
  SELECT RAISE(ABORT, 'The Guest account can''t be changed.');
END;

CREATE TRIGGER guest_stays BEFORE DELETE ON users WHEN OLD.id = 'guest'
BEGIN
  SELECT RAISE(ABORT, 'The Guest account can''t be deleted.');
END;

CREATE TRIGGER guest_has_no_keys BEFORE INSERT ON api_keys WHEN NEW.user_id = 'guest'
BEGIN
  SELECT RAISE(ABORT, 'The Guest account can''t have an API key.');
END;

ALTER TABLE site_usage ADD COLUMN guest_reset INTEGER NOT NULL DEFAULT 0;   -- 1 once the day's guest workspace is wiped and restored
