// What the shelf screen loads, in one go, for every view: the shelf, its
// cards, and the first page of its messages not on a card and of its
// uploads, since the tabs count all three (the redesign's rule,
// m1kuorg/basics#74: a tab's count is the first page's length, or "50+" when
// there's a page after). The router mounts the screen afresh on every ?view=
// change, so the last answer per shelf is kept here and drawn at once while
// the screen asks again.

import type { Card, Client, Shelf, UnsortedPage, Upload, UploadPage } from "@asked-before/sdk";

/** How many rows one page of a list brings. */
export const PAGE = 50;

/** `loaded` tells one answer from the next, so a view's own state (its pages, its filter) starts again on fresh data. */
export type ShelfData = { shelf: Shelf; cards: Card[]; once: UnsortedPage; uploads: UploadPage; loaded: number };

let loads = 0;

export async function loadShelf(client: Client, shelfId: string): Promise<ShelfData> {
  const [shelf, cards, once, uploads] = await Promise.all([
    client.shelves.get(shelfId),
    client.cards.list(shelfId),
    client.cards.unsorted(shelfId, { limit: PAGE }),
    client.uploads.list(shelfId, { limit: PAGE }),
  ]);
  return { shelf, cards, once, uploads, loaded: ++loads };
}

/** The last answer for a shelf, kept only while the learner moves between its views, so a switch doesn't blank the header. */
export const lastSeen = new Map<string, ShelfData>();

/** A tab's count: the first page's length, or "50+" when there's more. */
export const pageCount = (items: unknown[], next: string | null) => (next ? `${PAGE}+` : String(items.length));

/** The first upload still waiting or being sorted, if any (of the first page). */
export const sorting = (uploads: Upload[]) => uploads.find((upload) => upload.status === "waiting" || upload.status === "sorting");

export const shelfPath = (shelfId: string) => `/app/shelves/${encodeURIComponent(shelfId)}`;
export const uploadPath = (shelfId: string) => `${shelfPath(shelfId)}/upload`;
export const watchPath = (shelfId: string, uploadId: string) => `${uploadPath(shelfId)}?upload=${encodeURIComponent(uploadId)}`;
export const cardPath = (cardId: string) => `/app/cards/${encodeURIComponent(cardId)}`;

/** The shelf's views, by ?view=: anything else is the cards. */
export type View = "cards" | "once" | "uploads";
export const viewOf = (value: string | null): View => (value === "once" || value === "uploads" ? value : "cards");
export const viewPath = (shelfId: string, view: View) => (view === "cards" ? shelfPath(shelfId) : `${shelfPath(shelfId)}?view=${view}`);
