// Uploads: list a shelf's uploads, create one, append a chunk of up to
// 2,000 phrasings, finish it, and get one (m1kuorg/basics#43); retry a
// failed sort (m1kuorg/basics#44); delete one, which needs a session
// (m1kuorg/basics#45).
//
// A chunk holds phrasings as { sourceId, text, time } and nothing else, so
// no answer, title, or other part of an export can reach the server (ADR
// 0001). A phrasing over 2,000 characters, or a chunk over 2,000 phrasings,
// is a 413; a phrasing dated more than 5 minutes after the server's clock
// is a 400 (its time is a Unix timestamp, so no time zone runs ahead), lest
// a card show borrowed again the moment it's returned. Finishing an upload
// answers with it waiting to be sorted, and starts the shelf's sort in its
// Durable Object (worker/sorter.ts, server/sort.ts), which records its
// progress and any failure on the upload; when that start fails, the
// upload answers failed, so a retry starts it again. Retrying a failed sort carries on
// from the first phrasing it hadn't offered; anything but a failed upload
// is a 409. Deleting an upload deletes its phrasings, and any card left
// with fewer than two borrows, whose remaining phrasing becomes unsorted; a
// sort under way on it stops.

import { MAX_CHUNK, MAX_PHRASING_LENGTH, type Upload } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import type { Env } from "../config";
import { defineRoutes, HttpError, readJson, readPage } from "../http";
import type { Db } from "../store/db";
import { appendPhrasings, createUpload, deleteUpload, failUnstarted, finishUpload, getUpload, listUploads, retryUpload, type UploadChange } from "../store/uploads";

/** How far past the server's clock a phrasing may be dated, for a clock that runs a little fast. */
const AHEAD_MS = 5 * 60 * 1000;
/**
 * The largest chunk body: MAX_CHUNK phrasings of MAX_PHRASING_LENGTH
 * characters at three bytes each, as any character past ASCII takes in
 * UTF-8, with room for their ids and times. A Worker has 128 MB, which
 * the body, its text, and its phrasings share while the chunk is stored.
 */
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

const NewUpload = z.strictObject({
  source: z.enum(["chatgpt", "claude"], { error: "source is chatgpt or claude." }),
  fileName: z
    .string({ error: "An upload needs its file's name." })
    .trim()
    .min(1, "An upload needs its file's name.")
    .max(255, "A file name can have at most 255 characters."),
});

const Phrasing = z.strictObject(
  {
    sourceId: z.string({ error: "Each phrasing needs its sourceId." }).min(1, "Each phrasing needs its sourceId.").max(200, "A sourceId can have at most 200 characters."),
    text: z.string({ error: "Each phrasing needs its text." }).regex(/\S/, "Each phrasing needs its text."),
    time: z.iso.datetime({ offset: true, error: "Each phrasing's time is an ISO timestamp." }),
  },
  { error: "A phrasing is { sourceId, text, time } and nothing else." },
);

const Chunk = z.strictObject(
  { phrasings: z.array(Phrasing, { error: "phrasings is a list." }) },
  { error: "A chunk is { phrasings } and nothing else." },
);

const NO_UPLOAD = "There's no such upload.";

const found = (upload: Upload | null): Upload => {
  if (!upload) throw new HttpError(404, NO_UPLOAD);
  return upload;
};

/** The changed upload; or a 404, or a 409 saying `conflict` when its status refused the change. */
const changed = (change: UploadChange, conflict: string): Upload => {
  if ("upload" in change) return change.upload;
  throw change.refused === "missing" ? new HttpError(404, NO_UPLOAD) : new HttpError(409, conflict);
};

/**
 * Starts the upload's shelf's sort, or wakes the one under way to take this
 * upload after its own (server/sort.ts), and answers the upload. When the
 * shelf's Durable Object can't be started, the upload fails, saying so,
 * rather than wait for a sort that never comes: a retry starts it again.
 */
const startSortAndAnswer = async (env: Env, db: Db, userId: string, upload: Upload) => {
  try {
    await env.SORTER.getByName(upload.shelfId).start();
    return Response.json(upload);
  } catch {
    return Response.json(found(await failUnstarted(db, userId, upload.id, "The sort didn't start. Try again.")));
  }
};

export const uploads = defineRoutes({
  "/api/v1/shelves/:shelfId/uploads": {
    GET: authed(async (req, { db, params, auth }) => {
      const { limit, cursor } = readPage(req);
      const page = await listUploads(db, auth.userId, params.shelfId, limit, cursor);
      if (!page) throw new HttpError(404, "There's no such shelf.");
      return Response.json(page);
    }),
    POST: authed(async (req, { db, params, auth }) => {
      const { source, fileName } = await readJson(req, NewUpload);
      const upload = await createUpload(db, auth.userId, params.shelfId, source, fileName);
      if (!upload) throw new HttpError(404, "There's no such shelf.");
      return Response.json(upload, { status: 201 });
    }),
  },
  "/api/v1/uploads/:uploadId": {
    GET: authed(async (_req, { db, params, auth }) => Response.json(found(await getUpload(db, auth.userId, params.uploadId)))),
    DELETE: authed(
      async (_req, { db, params, auth }) => {
        if (!(await deleteUpload(db, auth.userId, params.uploadId))) throw new HttpError(404, NO_UPLOAD);
        return new Response(null, { status: 204 });
      },
      { sessionOnly: true },
    ),
  },
  "/api/v1/uploads/:uploadId/phrasings": {
    POST: authed(async (req, { db, params, auth }) => {
      if (Number(req.headers.get("content-length")) > MAX_CHUNK_BYTES) throw new HttpError(413, "This chunk is too big. Send at most 2,000 phrasings at a time.");
      const { phrasings } = await readJson(req, Chunk);
      if (phrasings.length > MAX_CHUNK) throw new HttpError(413, `A chunk can hold at most ${MAX_CHUNK.toLocaleString("en-US")} phrasings.`);
      const latest = Date.now() + AHEAD_MS;
      phrasings.forEach(({ text, time }, i) => {
        if (text.length > MAX_PHRASING_LENGTH) {
          throw new HttpError(413, `Phrasing ${i + 1} has more than ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters.`);
        }
        if (Date.parse(time) > latest) throw new HttpError(400, `Phrasing ${i + 1} is dated more than 5 minutes after the server's clock.`);
      });
      const appended = await appendPhrasings(db, auth.userId, params.uploadId, phrasings);
      return Response.json(changed(appended, "This upload is finished, so it takes no more phrasings. Start a new upload to add more."));
    }),
  },
  "/api/v1/uploads/:uploadId/finish": {
    POST: authed(async (_req, { env, db, params, auth }) => startSortAndAnswer(env, db, auth.userId, changed(await finishUpload(db, auth.userId, params.uploadId), "This upload is finished already."))),
  },
  "/api/v1/uploads/:uploadId/retry": {
    POST: authed(async (_req, { env, db, params, auth }) => startSortAndAnswer(env, db, auth.userId, changed(await retryUpload(db, auth.userId, params.uploadId), "Only a sort that failed can be tried again."))),
  },
});
