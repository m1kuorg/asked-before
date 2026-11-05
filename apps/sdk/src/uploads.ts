// Uploads: create, append a chunk of phrasings, finish, list, and get
// (m1kuorg/basics#43), retry a failed sort (m1kuorg/basics#44), and delete
// (m1kuorg/basics#45). An upload is one export loaded onto a shelf: make
// it, append its phrasings (read with readExport) in chunks of up to
// MAX_CHUNK, then finish it, which starts its sort. A phrasing the shelf
// already holds, by its source id, is skipped, so the same export uploaded
// twice stores nothing new; one held by an upload that never finished joins
// this upload instead, to be sorted with it. Get the upload again to follow its sort: it
// waits behind the shelf's other uploads, then sorts, and ends sorted or
// failed with an error, which retry picks up from where it stopped.
// Deleting an upload, which needs a session rather than an API key, deletes
// its phrasings, and any card left with fewer than two borrows.

import { paged, path, type PageOptions, type Requester } from "./http.ts";
import type { Phrasing, Source } from "./readers.ts";

/** The most phrasings one append may carry, few enough that a chunk is stored in a few milliseconds of the server's CPU. */
export const MAX_CHUNK = 500;

/** Receiving phrasings, then waiting to be sorted, sorting, and sorted, or failed with an error. */
export type UploadStatus = "receiving" | "waiting" | "sorting" | "sorted" | "failed";

export type Upload = {
  id: string;
  shelfId: string;
  source: Source;
  fileName: string;
  status: UploadStatus;
  /** Your messages it was sent, each counted once, even when a chunk was sent twice. */
  messages: number;
  /** The ones among them it sorts: those new to the shelf, and any an upload that never finished held. The rest were on the shelf already. */
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

/** One page of a shelf's uploads, newest first. Pass `next` as the cursor for the page after; it's null on the last. */
export type UploadPage = { uploads: Upload[]; next: string | null };

export const uploads = (request: Requester) => ({
  list: (shelfId: string, page: PageOptions = {}) => request<UploadPage>("GET", paged(path`/shelves/${shelfId}/uploads`, page)),
  create: (shelfId: string, input: NewUpload) => request<Upload>("POST", path`/shelves/${shelfId}/uploads`, input),
  get: (uploadId: string) => request<Upload>("GET", path`/uploads/${uploadId}`),
  /** Sends up to MAX_CHUNK phrasings. Only `{ sourceId, text, time }` is sent of each. */
  append: (uploadId: string, phrasings: Phrasing[]) =>
    request<Upload>("POST", path`/uploads/${uploadId}/phrasings`, {
      phrasings: phrasings.map(({ sourceId, text, time }) => ({ sourceId, text, time })),
    }),
  /** Ends the upload's receiving and starts its sort. */
  finish: (uploadId: string) => request<Upload>("POST", path`/uploads/${uploadId}/finish`),
  /** Sorts a failed upload again, from its first phrasing no sort has seen. Anything but a failed upload is a 409. */
  retry: (uploadId: string) => request<Upload>("POST", path`/uploads/${uploadId}/retry`),
  /** Deletes the upload and its phrasings; a card left with fewer than two borrows goes too, with its reps, and its remaining phrasing becomes unsorted. Needs a session: an API key gets 403. */
  delete: (uploadId: string) => request<void>("DELETE", path`/uploads/${uploadId}`),
});
