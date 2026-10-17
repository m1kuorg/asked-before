// Uploads and the phrasings they bring. Every query joins up to the
// project's owner, so another account's upload reads as missing. Appending
// stores only the phrasings whose source id the project doesn't hold yet,
// which is what keeps a re-uploaded export from counting a borrow twice.

import type { Phrasing, Source, Upload, UploadPage } from "@asked-before/sdk";
import { db, iso, newId } from "./db";

type Row = {
  id: string;
  project_id: string;
  source: Source;
  file_name: string;
  status: Upload["status"];
  message_count: number;
  phrasings: number;
  offered: number;
  error: string | null;
  created_at: number;
  finished_at: number | null;
};

const SELECT = `
  SELECT
    u.id, u.project_id, u.source, u.file_name, u.status, u.message_count, u.error, u.created_at, u.finished_at,
    (SELECT count(*) FROM phrasings f WHERE f.upload_id = u.id) AS phrasings,
    (SELECT count(*) FROM phrasings f WHERE f.upload_id = u.id AND f.offered_at IS NOT NULL) AS offered
  FROM uploads u
  JOIN projects p ON p.id = u.project_id`;

const toUpload = (row: Row): Upload => ({
  id: row.id,
  projectId: row.project_id,
  source: row.source,
  fileName: row.file_name,
  status: row.status,
  messages: row.message_count,
  phrasings: row.phrasings,
  offered: row.offered,
  error: row.error,
  createdAt: iso(row.created_at),
  finishedAt: row.finished_at === null ? null : iso(row.finished_at),
});

const ownsProject = (userId: string, projectId: string) =>
  db.query("SELECT 1 FROM projects WHERE id = $projectId AND user_id = $userId").get({ userId, projectId }) !== null;

export function getUpload(userId: string, uploadId: string): Upload | null {
  const row = db.query(`${SELECT} WHERE u.id = $uploadId AND p.user_id = $userId`).get({ userId, uploadId }) as Row | null;
  return row && toUpload(row);
}

/** The new upload, receiving; or null when the account has no such project. */
export function createUpload(userId: string, projectId: string, source: Source, fileName: string): Upload | null {
  if (!ownsProject(userId, projectId)) return null;
  const id = newId();
  db.query("INSERT INTO uploads (id, project_id, source, file_name, created_at) VALUES ($id, $projectId, $source, $fileName, $now)").run({
    id,
    projectId,
    source,
    fileName,
    now: Date.now(),
  });
  return getUpload(userId, id);
}

/** A page of the project's uploads, newest first (ids are time-ordered); or null when the account has no such project. */
export function listUploads(userId: string, projectId: string, limit: number, cursor: string | undefined): UploadPage | null {
  if (!ownsProject(userId, projectId)) return null;
  const rows = db
    .query(`${SELECT} WHERE u.project_id = $projectId AND p.user_id = $userId AND ($cursor IS NULL OR u.id < $cursor) ORDER BY u.id DESC LIMIT $take`)
    .all({ userId, projectId, cursor: cursor ?? null, take: limit + 1 }) as Row[];
  const uploads = rows.slice(0, limit).map(toUpload);
  return { uploads, next: rows.length > limit ? uploads.at(-1)!.id : null };
}

const insertPhrasing = db.query(`
  INSERT INTO phrasings (id, project_id, origin, upload_id, source_id, text, time, created_at)
  VALUES ($id, $projectId, 'export', $uploadId, $sourceId, $text, $time, $now)
  ON CONFLICT (project_id, source_id) DO NOTHING
`);

/**
 * Adds a chunk to an upload that's still receiving: every phrasing counts
 * toward its messages, and those new to the project are stored. Null when
 * the account has no such upload; "finished" when it takes no more.
 */
export function appendPhrasings(userId: string, uploadId: string, phrasings: Phrasing[]): Upload | null | "finished" {
  const upload = getUpload(userId, uploadId);
  if (!upload) return null;
  if (upload.status !== "receiving") return "finished";
  const now = Date.now();
  db.transaction(() => {
    for (const { sourceId, text, time } of phrasings) {
      insertPhrasing.run({ id: newId(), projectId: upload.projectId, uploadId, sourceId, text, time: Date.parse(time), now });
    }
    db.query("UPDATE uploads SET message_count = message_count + $count WHERE id = $uploadId").run({ uploadId, count: phrasings.length });
  })();
  return getUpload(userId, uploadId);
}

/** Ends an upload's receiving, leaving it waiting to be sorted (server/sort.ts). Null when there's no such upload; "finished" when it was already. */
export function finishUpload(userId: string, uploadId: string): Upload | null | "finished" {
  const upload = getUpload(userId, uploadId);
  if (!upload) return null;
  const changed = db
    .query("UPDATE uploads SET status = 'waiting', finished_at = $now WHERE id = $uploadId AND status = 'receiving'")
    .run({ uploadId, now: Date.now() }).changes;
  return changed ? getUpload(userId, uploadId) : "finished";
}

/** Sets a failed upload waiting to be sorted again, from its first phrasing not yet offered. Null when there's no such upload; "not failed" when it didn't fail. */
export function retryUpload(userId: string, uploadId: string): Upload | null | "not failed" {
  const upload = getUpload(userId, uploadId);
  if (!upload) return null;
  const changed = db.query("UPDATE uploads SET status = 'waiting', error = NULL WHERE id = $uploadId AND status = 'failed'").run({ uploadId }).changes;
  return changed ? getUpload(userId, uploadId) : "not failed";
}
