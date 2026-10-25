// Search: "Have you asked this before?" Finds the account's phrasings that
// have every word of ?q=, across its shelves or on ?shelfId=, and the cards
// they're on (packages/sdk/src/search.ts). A session or an API key can
// read it. It asks the model nothing.

import { searchWords, type SearchAnswer } from "@asked-before/sdk";
import { authed } from "../auth";
import { defineRoutes, HttpError } from "../http";
import { search as find } from "../store/search";

export const search = defineRoutes({
  "/api/v1/search": {
    GET: authed(async (req, { db, auth }) => {
      const query = new URL(req.url).searchParams;
      const q = query.get("q") ?? "";
      const words = searchWords(q);
      // The message never repeats q: the server's messages never hold your words.
      if (!words.length) throw new HttpError(400, "q needs a word of 2 or more characters.");
      const answer = await find(db, auth.userId, q, words, query.get("shelfId") || null);
      if (!answer) throw new HttpError(404, "There's no such shelf.");
      return Response.json(answer satisfies SearchAnswer);
    }),
  },
});
