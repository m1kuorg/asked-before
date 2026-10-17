// Cards: list a project's cards with their status, list its unsorted
// phrasings a page at a time, and get one card with its borrows and reps
// (m1kuorg/basics#44). The sort (server/sort.ts) makes the cards; these
// only read them. Another account's project or card is a 404.

import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError } from "../http";
import { getCard, listCards, listUnsorted } from "../store/cards";

const Page = z.object({
  limit: z.coerce.number({ error: "limit is a number from 1 to 100." }).int("limit is a number from 1 to 100.").min(1, "limit is a number from 1 to 100.").max(100, "limit is a number from 1 to 100.").default(50),
  cursor: z.string().min(1, "cursor is the next value of the page before.").optional(),
});

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
      const query = Page.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!query.success) throw new HttpError(400, query.error.issues[0]?.message ?? "The query isn't valid.");
      const page = listUnsorted(auth.userId, req.params.projectId, query.data.limit, query.data.cursor);
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
