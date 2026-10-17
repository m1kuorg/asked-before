// Uploads: create, append a chunk of phrasings, finish, list, and get
// (m1kuorg/basics#43), retry a failed sort (m1kuorg/basics#44), and delete
// (m1kuorg/basics#45). An upload is one export loaded into a project: make
// it, append its phrasings (read with readExport) in chunks of up to
// MAX_CHUNK, then finish it, which leaves it waiting to be sorted. A
// phrasing the project already holds, by its source id, is skipped, so the
// same export uploaded twice stores nothing new.

import { path, type Requester } from "./http";
import type { Phrasing, Source } from "./readers";

/** The most phrasings one append may carry. */
export const MAX_CHUNK = 2000;

/** Receiving phrasings, then waiting to be sorted, sorting, and sorted, or failed with an error. */
export type UploadStatus = "receiving" | "waiting" | "sorting" | "sorted" | "failed";

export type Upload = {
  id: string;
  projectId: string;
  source: Source;
  fileName: string;
  status: UploadStatus;
  /** Your messages it was sent. */
  messages: number;
  /** The new ones among them, stored as its phrasings: the rest were in the project already. */
  phrasings: number;
  /** How many of its phrasings a sort has seen so far. */
  offered: number;
  /** Why its sort failed, when it did. */
  error: string | null;
  createdAt: string;
  /** When its last phrasings arrived, or null while it's still receiving. */
  finishedAt: string | null;
};

export type NewUpload = { source: Source; fileName: string };

/** One page of a project's uploads, newest first. Pass `next` as the cursor for the page after; it's null on the last. */
export type UploadPage = { uploads: Upload[]; next: string | null };

export type UploadListOptions = { limit?: number; cursor?: string };

export const uploads = (request: Requester) => ({
  list: (projectId: string, { limit, cursor }: UploadListOptions = {}) => {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    if (cursor !== undefined) query.set("cursor", cursor);
    const search = query.size ? `?${query}` : "";
    return request<UploadPage>("GET", `${path`/projects/${projectId}/uploads`}${search}`);
  },
  create: (projectId: string, input: NewUpload) => request<Upload>("POST", path`/projects/${projectId}/uploads`, input),
  get: (uploadId: string) => request<Upload>("GET", path`/uploads/${uploadId}`),
  /** Sends up to MAX_CHUNK phrasings. Only `{ sourceId, text, time }` is sent of each. */
  append: (uploadId: string, phrasings: Phrasing[]) =>
    request<Upload>("POST", path`/uploads/${uploadId}/phrasings`, {
      phrasings: phrasings.map(({ sourceId, text, time }) => ({ sourceId, text, time })),
    }),
  finish: (uploadId: string) => request<Upload>("POST", path`/uploads/${uploadId}/finish`),
});
