// Cards: list a shelf's cards with their status, list its unsorted
// phrasings a page at a time, and get one card with its borrows and reps
// (m1kuorg/basics#44). The sort (server/sort.ts) makes the cards; these
// only read them. Another account's shelf or card is a 404.

import { authed } from "../auth";
import { defineRoutes, HttpError, readPage } from "../http";
import { getCard, listCards, listUnsorted } from "../store/cards";

export const cards = defineRoutes({
  "/api/v1/shelves/:shelfId/cards": {
    GET: authed(async (_req, { db, params, auth }) => {
      const cards = await listCards(db, auth.userId, params.shelfId);
      if (!cards) throw new HttpError(404, "There's no such shelf.");
      return Response.json({ cards });
    }),
  },
  "/api/v1/shelves/:shelfId/unsorted": {
    GET: authed(async (req, { db, params, auth }) => {
      const { limit, cursor } = readPage(req);
      const page = await listUnsorted(db, auth.userId, params.shelfId, limit, cursor);
      if (!page) throw new HttpError(404, "There's no such shelf.");
      return Response.json(page);
    }),
  },
  "/api/v1/cards/:cardId": {
    GET: authed(async (_req, { db, params, auth }) => {
      const card = await getCard(db, auth.userId, params.cardId);
      if (!card) throw new HttpError(404, "There's no such card.");
      return Response.json(card);
    }),
  },
});
