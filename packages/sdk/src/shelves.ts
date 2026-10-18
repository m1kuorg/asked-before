// Shelves: list, create, get, rename, and delete (m1kuorg/basics#41).
// Renaming a shelf, and deleting it with everything in it, need a
// session, not an API key.

import { path, type Requester } from "./http.ts";

export type Shelf = {
  id: string;
  name: string;
  /** A demo shelf holds the demo export, labeled as demo data wherever it shows. */
  demo: boolean;
  createdAt: string;
  /** Its cards, and how many of them are borrowed, returned, and borrowed again. */
  counts: { cards: number; borrowed: number; returned: number; borrowedAgain: number };
  /** When its latest upload was made, or null before its first. */
  lastUploadAt: string | null;
};

export type NewShelf = { name: string; demo?: boolean };

export const shelves = (request: Requester) => ({
  list: () => request<{ shelves: Shelf[] }>("GET", "/shelves").then((body) => body.shelves),
  create: (input: NewShelf) => request<Shelf>("POST", "/shelves", input),
  get: (shelfId: string) => request<Shelf>("GET", path`/shelves/${shelfId}`),
  /** Needs a session: an API key gets 403. */
  rename: (shelfId: string, name: string) => request<Shelf>("PATCH", path`/shelves/${shelfId}`, { name }),
  delete: (shelfId: string) => request<void>("DELETE", path`/shelves/${shelfId}`),
});
