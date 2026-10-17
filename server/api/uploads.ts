// Uploads: list a project's uploads, create one, append a chunk of up to
// 2,000 phrasings, finish it, and get one (m1kuorg/basics#43); retry a
// failed sort (m1kuorg/basics#44); delete one, which needs a session
// (m1kuorg/basics#45). Stubs answer 501 until then.
//
// A chunk holds phrasings as { sourceId, text, time } and nothing else, so
// no answer, title, or other part of an export can reach the server (ADR
// 0001). A phrasing over 2,000 characters, or a chunk over 2,000 phrasings,
// is a 413; a phrasing dated more than a day ahead is a 400. Finishing an
// upload leaves it waiting to be sorted.

import { MAX_CHUNK, MAX_PHRASING_LENGTH, type Upload } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, notBuilt, readJson } from "../http";
import { appendPhrasings, createUpload, finishUpload, getUpload, listUploads } from "../store/uploads";

const DAY = 24 * 60 * 60 * 1000;
/** The largest chunk body: MAX_CHUNK phrasings of MAX_PHRASING_LENGTH characters, every one escaped, with room to spare. */
const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

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

const Page = z.object({
  limit: z.coerce.number({ error: "limit is a number from 1 to 100." }).int("limit is a number from 1 to 100.").min(1, "limit is a number from 1 to 100.").max(100, "limit is a number from 1 to 100.").default(50),
  cursor: z.string().min(1, "cursor is the next value of the page before.").optional(),
});

const found = (upload: Upload | null): Upload => {
  if (!upload) throw new HttpError(404, "There's no such upload.");
  return upload;
};

const open = (upload: Upload | null | "finished"): Upload => {
  if (upload === "finished") throw new HttpError(409, "This upload is finished, so it takes no more phrasings. Start a new upload to add more.");
  return found(upload);
};

export const uploads = defineRoutes({
  "/api/v1/projects/:projectId/uploads": {
    GET: authed((req, auth) => {
      const query = Page.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!query.success) throw new HttpError(400, query.error.issues[0]?.message ?? "The query isn't valid.");
      const page = listUploads(auth.userId, req.params.projectId, query.data.limit, query.data.cursor);
      if (!page) throw new HttpError(404, "There's no such project.");
      return Response.json(page);
    }),
    POST: authed(async (req, auth) => {
      const { source, fileName } = await readJson(req, NewUpload);
      const upload = createUpload(auth.userId, req.params.projectId, source, fileName);
      if (!upload) throw new HttpError(404, "There's no such project.");
      return Response.json(upload, { status: 201 });
    }),
  },
  "/api/v1/uploads/:uploadId": {
    GET: authed((req, auth) => Response.json(found(getUpload(auth.userId, req.params.uploadId)))),
    DELETE: notBuilt("m1kuorg/basics#45"),
  },
  "/api/v1/uploads/:uploadId/phrasings": {
    POST: authed(async (req, auth) => {
      if (Number(req.headers.get("content-length")) > MAX_CHUNK_BYTES) throw new HttpError(413, "This chunk is too big. Send at most 2,000 phrasings at a time.");
      const { phrasings } = await readJson(req, Chunk);
      if (phrasings.length > MAX_CHUNK) throw new HttpError(413, `A chunk can hold at most ${MAX_CHUNK.toLocaleString("en-US")} phrasings.`);
      const ahead = Date.now() + DAY;
      phrasings.forEach(({ text, time }, i) => {
        if (text.length > MAX_PHRASING_LENGTH) {
          throw new HttpError(413, `Phrasing ${i + 1} has more than ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters.`);
        }
        if (Date.parse(time) > ahead) throw new HttpError(400, `Phrasing ${i + 1} is dated more than a day ahead.`);
      });
      return Response.json(open(appendPhrasings(auth.userId, req.params.uploadId, phrasings)));
    }),
  },
  "/api/v1/uploads/:uploadId/finish": {
    POST: authed((req, auth) => {
      const upload = finishUpload(auth.userId, req.params.uploadId);
      if (upload === "finished") throw new HttpError(409, "This upload is finished already.");
      return Response.json(found(upload));
    }),
  },
  "/api/v1/uploads/:uploadId/retry": { POST: notBuilt("m1kuorg/basics#44") },
});
