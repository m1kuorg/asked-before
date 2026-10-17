// Cards: list a project's cards with their status, list its unsorted
// phrasings a page at a time, and get one card with its borrows and reps
// (m1kuorg/basics#44). The sort (server/sort.ts) makes the cards; these
// only read them. Another account's project or card is a 404.

import { authed } from "../auth";
import { defineRoutes, HttpError, readPage } from "../http";
import { getCard, listCards, listUnsorted } from "../store/cards";

export const cards = defineRoutes({
  "/api/v1/projects/:projectId/cards": {
    GET: authed((req, auth) => {
      const cards = listCards(auth.userId, req.params.projectId);
      if (!cards) throw new HttpError(404, "There's no such project.");
      return Response.json({ cards });
    }),
  },
  "/api/v1/projects/:projectId/unsorted": {
    GET: authed((req, auth) => {
      const { limit, cursor } = readPage(req);
      const page = listUnsorted(auth.userId, req.params.projectId, limit, cursor);
      if (!page) throw new HttpError(404, "There's no such project.");
      return Response.json(page);
    }),
  },
  "/api/v1/cards/:cardId": {
    GET: authed((req, auth) => {
      const card = getCard(auth.userId, req.params.cardId);
      if (!card) throw new HttpError(404, "There's no such card.");
      return Response.json(card);
    }),
  },
});
