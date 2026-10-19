// Captures: record one phrasing onto a shelf and sort it at once
// (m1kuorg/basics#50, ADR 0002), so an agent can answer in the same turn.
// An API key may make one.
//
// A capture is { text } and nothing else: your own words, of at most 2,000
// characters once trimmed (413 past it), stamped with the server's clock.
// The same words on the same shelf within ten minutes answer 200 with
// that earlier capture and add no borrow. Otherwise it counts toward the
// app's daily phrasings, for everyone (store/usage.ts), a 429 past them,
// and it's stored and answers 201: words that match a phrasing on
// a card, ignoring case and spacing, join that card without asking the
// model; anything else is placed by the sort's own request and checks
// (sortCapture in server/sort.ts), at a lower effort, against the shelf's
// cards and its most recent unsorted phrasings. It joins a card, makes a
// new one with unsorted phrasings that ask the same thing, or waits unsorted; the rest of what the answer says
// is left for the next upload's sort. A failed model request stores
// nothing, so the capture can be sent again.

import { MAX_PHRASING_LENGTH, type Capture } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { sortCapture } from "../sort";
import { captureOf, draft, lookUp, storeCapture } from "../store/captures";
import type { Db } from "../store/db";
import { spendPhrasings } from "../store/usage";

const NO_SHELF = "There's no such shelf.";

const NewCapture = z.strictObject(
  { text: z.string({ error: "A capture needs your question's text." }).regex(/\S/, "A capture needs your question's text.") },
  { error: "A capture is { text } and nothing else." },
);

const answer = async (db: Db, userId: string, phrasingId: string, alreadyCaptured: boolean) => {
  const capture = await captureOf(db, userId, phrasingId, alreadyCaptured);
  if (!capture) throw new HttpError(404, NO_SHELF);
  return Response.json(capture satisfies Capture, { status: alreadyCaptured ? 200 : 201 });
};

export const captures = defineRoutes({
  "/api/v1/shelves/:shelfId/captures": {
    POST: authed(async (req, { env, db, config, params, auth }) => {
      const text = (await readJson(req, NewCapture)).text.trim();
      if (text.length > MAX_PHRASING_LENGTH) throw new HttpError(413, `A capture can have at most ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters.`);
      const { shelfId } = params;
      const capture = draft(text);
      const found = await lookUp(db, auth.userId, shelfId, capture);
      if (!found) throw new HttpError(404, NO_SHELF);
      if ("earlier" in found) return answer(db, auth.userId, found.earlier, true);
      await spendPhrasings(db, 1, config.dailyPhrasings);
      const placement = found.cardId
        ? { joins: [{ cardId: found.cardId, phrasingIds: [capture.id] }], newCards: [] }
        : await sortCapture(env, shelfId, capture);
      const stored = await storeCapture(db, auth.userId, shelfId, capture, placement);
      if (!stored) throw new HttpError(404, NO_SHELF);
      return answer(db, auth.userId, stored.id, stored.alreadyCaptured);
    }),
  },
});
