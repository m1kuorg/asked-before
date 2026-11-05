// What the upload screen remembers between its own mounts: the router mounts
// it afresh when sending ends and the address becomes ?upload=<id>, so the
// shelf and the upload just finished are drawn at once while it asks again.

import type { Shelf, Upload } from "@asked-before/sdk";

export { shelfPath, uploadPath, watchPath } from "@/screens/shelf/data";

/** The shelves this visit has shown, by id. */
export const seenShelves = new Map<string, Shelf>();
/** Uploads this visit finished sending, by id, until their own page loads them. */
export const finished = new Map<string, Upload>();

/** How often a sort's progress is asked for while it runs. */
export const WATCH_MS = 1000;
