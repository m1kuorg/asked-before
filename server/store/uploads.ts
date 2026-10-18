// Uploads and the phrasings they bring. Every query joins up to the
// shelf's owner, so another account's upload reads as missing. Appending
// stores only the phrasings whose source id the shelf doesn't hold yet,
// which is what keeps a re-uploaded export from counting a borrow twice,
// and counts each of the upload's messages once, by its source id, so a
// chunk sent twice doesn't count twice either. A phrasing held by an upload
// still receiving (one whose tab closed before it finished, say) moves to
// the upload sending it again, so that upload's sort places it. Each change
// is one batch, its status check folded into its writes, read back at the
// end of the same batch.

import type { Phrasing, Source, Upload, UploadPage } from "@asked-before/sdk";
import { iso, newId, slices, type Db } from "./db";

export type UploadRow = {
  id: string;
  shelf_id: string;
  source: Source;
  file_name: string;
  status: Upload["status"];
  messages: number;
  phrasings: number;
  offered: number;
  error: string | null;
  created_at: number;
  finished_at: number | null;
};

const SELECT = `
  SELECT
    u.id, u.shelf_id, u.source, u.file_name, u.status, u.error, u.created_at, u.finished_at,
    (SELECT count(*) FROM upload_messages m WHERE m.upload_id = u.id) AS messages,
    (SELECT count(*) FROM phrasings f WHERE f.upload_id = u.id) AS phrasings,
    (SELECT count(*) FROM phrasings f WHERE f.upload_id = u.id AND f.offered_at IS NOT NULL) AS offered
  FROM uploads u
  JOIN shelves sh ON sh.id = u.shelf_id`;

/** The account's upload, as ?1 (the account) and ?2 (the upload). */
const ONE_UPLOAD = `${SELECT} WHERE u.id = ?2 AND sh.user_id = ?1`;

/** Every upload of the account's (?1), oldest first (ids are time-ordered), for the download (store/account-data.ts). */
export const ACCOUNT_UPLOADS = `${SELECT} WHERE sh.user_id = ?1 ORDER BY u.id`;

/** Whether upload ?2 is the account's (?1). */
const OWNED = "EXISTS (SELECT 1 FROM uploads u JOIN shelves sh ON sh.id = u.shelf_id WHERE u.id = ?2 AND sh.user_id = ?1)";

/** An upload after a change to it, or why there was none: the account has no such upload, or its status doesn't allow the change. */
export type UploadChange = { upload: Upload } | { refused: "missing" | "status" };

export const toUpload = (row: UploadRow): Upload => ({
  id: row.id,
  shelfId: row.shelf_id,
  source: row.source,
  fileName: row.file_name,
  status: row.status,
  messages: row.messages,
  phrasings: row.phrasings,
  offered: row.offered,
  error: row.error,
  createdAt: iso(row.created_at),
  finishedAt: row.finished_at === null ? null : iso(row.finished_at),
});

export async function getUpload(db: Db, userId: string, uploadId: string): Promise<Upload | null> {
  const row = await db.prepare(ONE_UPLOAD).bind(userId, uploadId).first<UploadRow>();
  return row && toUpload(row);
}

/** The new upload, receiving, made and read back in one batch; or null when the account has no such shelf. */
export async function createUpload(db: Db, userId: string, shelfId: string, source: Source, fileName: string): Promise<Upload | null> {
  const id = newId();
  const [, read] = await db.batch<UploadRow>([
    db
      .prepare("INSERT INTO uploads (id, shelf_id, source, file_name, created_at) SELECT ?2, id, ?4, ?5, ?6 FROM shelves WHERE id = ?3 AND user_id = ?1")
      .bind(userId, id, shelfId, source, fileName, Date.now()),
    db.prepare(ONE_UPLOAD).bind(userId, id),
  ]);
  const row = read?.results[0];
  return row ? toUpload(row) : null;
}

/** A page of the shelf's uploads, newest first (ids are time-ordered); or null when the account has no such shelf. */
export async function listUploads(db: Db, userId: string, shelfId: string, limit: number, cursor: string | undefined): Promise<UploadPage | null> {
  const [owned, page] = await db.batch([
    db.prepare("SELECT 1 FROM shelves WHERE id = ?2 AND user_id = ?1").bind(userId, shelfId),
    db
      .prepare(`${SELECT} WHERE u.shelf_id = ?2 AND sh.user_id = ?1 AND (?3 IS NULL OR u.id < ?3) ORDER BY u.id DESC LIMIT ?4`)
      .bind(userId, shelfId, cursor ?? null, limit + 1),
  ]);
  if (!owned!.results.length) return null;
  const rows = page!.results as UploadRow[];
  const uploads = rows.slice(0, limit).map(toUpload);
  return { uploads, next: rows.length > limit ? uploads.at(-1)!.id : null };
}

/** The upload as a change left it, read in the change's own batch: missing, refused for its status, or changed. */
const changed = (row: UploadRow | undefined, done: boolean): UploadChange => (!row ? { refused: "missing" } : done ? { upload: toUpload(row) } : { refused: "status" });

/**
 * Adds a chunk to an upload that's still receiving, in one batch: each
 * phrasing counts once toward its messages, and those new to the shelf, or
 * held by an upload still receiving, become its own. The chunk goes in as
 * json_each lists, each of its rows [id, sourceId, text, time], and only
 * while the upload is the account's and still receiving: once it's
 * finished it takes no more, and the change is refused for its status.
 */
export async function appendPhrasings(db: Db, userId: string, uploadId: string, phrasings: Phrasing[]): Promise<UploadChange> {
  const receiving = "SELECT u.id, u.shelf_id FROM uploads u JOIN shelves sh ON sh.id = u.shelf_id WHERE u.id = ?2 AND sh.user_id = ?1 AND u.status = 'receiving'";
  const now = Date.now();
  const lists = slices(phrasings.map(({ sourceId, text, time }) => [newId(), sourceId, text, Date.parse(time)]));
  const results = await db.batch([
    ...lists.flatMap((list) => [
      // A phrasing the shelf holds already stays where it is, unless its upload is still receiving: no sort has seen it, so it moves to this upload.
      db
        .prepare(
          `INSERT INTO phrasings (id, shelf_id, origin, upload_id, source_id, text, time, created_at)
           SELECT j.value ->> 0, u.shelf_id, 'export', u.id, j.value ->> 1, j.value ->> 2, j.value ->> 3, ?4
           FROM (${receiving}) u, json_each(?3) j WHERE true
           ON CONFLICT (shelf_id, source_id) DO UPDATE SET upload_id = excluded.upload_id
           WHERE (SELECT status FROM uploads WHERE id = phrasings.upload_id) = 'receiving'`,
        )
        .bind(userId, uploadId, list, now),
      db
        .prepare(
          `INSERT INTO upload_messages (upload_id, source_id)
           SELECT u.id, j.value ->> 1 FROM (${receiving}) u, json_each(?3) j WHERE true
           ON CONFLICT DO NOTHING`,
        )
        .bind(userId, uploadId, list),
    ]),
    db.prepare(ONE_UPLOAD).bind(userId, uploadId),
  ]);
  const row = results.at(-1)!.results[0] as UploadRow | undefined;
  return changed(row, row?.status === "receiving");
}

/** Ends an upload's receiving, leaving it waiting to be sorted (server/sort.ts). Refused for its status when it was finished already. */
export async function finishUpload(db: Db, userId: string, uploadId: string): Promise<UploadChange> {
  const [update, read] = await db.batch<UploadRow>([
    db.prepare(`UPDATE uploads SET status = 'waiting', finished_at = ?3 WHERE id = ?2 AND status = 'receiving' AND ${OWNED}`).bind(userId, uploadId, Date.now()),
    db.prepare(ONE_UPLOAD).bind(userId, uploadId),
  ]);
  return changed(read!.results[0], update!.meta.changes > 0);
}

/** Sets a failed upload waiting to be sorted again, from its first phrasing not yet offered. Refused for its status when it didn't fail. */
export async function retryUpload(db: Db, userId: string, uploadId: string): Promise<UploadChange> {
  const [update, read] = await db.batch<UploadRow>([
    db.prepare(`UPDATE uploads SET status = 'waiting', error = NULL WHERE id = ?2 AND status = 'failed' AND ${OWNED}`).bind(userId, uploadId),
    db.prepare(ONE_UPLOAD).bind(userId, uploadId),
  ]);
  return changed(read!.results[0], update!.meta.changes > 0);
}

/**
 * Fails an upload whose sort didn't start, saying why, while it still
 * waits for it, so a retry can start it again. The upload as it stands
 * then, perhaps sorting by now; or null when the account has no such upload.
 */
export async function failUnstarted(db: Db, userId: string, uploadId: string, error: string): Promise<Upload | null> {
  const [, read] = await db.batch<UploadRow>([
    db.prepare(`UPDATE uploads SET status = 'failed', error = ?3 WHERE id = ?2 AND status = 'waiting' AND ${OWNED}`).bind(userId, uploadId, error),
    db.prepare(ONE_UPLOAD).bind(userId, uploadId),
  ]);
  const row = read!.results[0];
  return row ? toUpload(row) : null;
}

/**
 * Deletes an upload and its phrasings, in one batch. A card of its shelf
 * left with fewer than two borrows goes too, with its reps, and its
 * remaining phrasing becomes unsorted. False when the account has no such
 * upload.
 */
export async function deleteUpload(db: Db, userId: string, uploadId: string): Promise<boolean> {
  const [, deleted] = await db.batch([
    // First the cards its going leaves under two borrows, counting only the phrasings that stay.
    db
      .prepare(
        `DELETE FROM cards
         WHERE shelf_id = (SELECT u.shelf_id FROM uploads u JOIN shelves sh ON sh.id = u.shelf_id WHERE u.id = ?2 AND sh.user_id = ?1)
           AND (SELECT count(*) FROM phrasings f WHERE f.card_id = cards.id AND f.upload_id IS NOT ?2) < 2`,
      )
      .bind(userId, uploadId),
    db.prepare(`DELETE FROM uploads WHERE id = ?2 AND ${OWNED}`).bind(userId, uploadId),
  ]);
  return deleted!.meta.changes > 0;
}
