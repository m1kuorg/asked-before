// Captures: record one phrasing into a project and sort it at once
// (m1kuorg/basics#50, ADR 0002), so an agent can answer in the same turn.
// An API key may make one.
//
// A capture is { text } and nothing else: your own words, of at most 2,000
// characters (413 past it), stamped with the server's clock. The same
// words in the same project within ten minutes answer 200 with that
// earlier capture and add no borrow. Otherwise it's stored and answers
// 201: words that match a phrasing on a card, ignoring case and spacing,
// join that card without asking the model; anything else is placed by the
// sort's own request and checks (server/sort.ts), at a lower effort,
// against the project's cards and its most recent unsorted phrasings. It
// lands on a card, makes a new one with an unsorted phrasing that asks the
// same thing, or waits unsorted. A failed model request stores nothing, so
// the capture can be sent again.

import { MAX_PHRASING_LENGTH } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { config } from "../config";
import { defineRoutes, HttpError, readJson } from "../http";
import type { Effort } from "../model";
import { askPlacement } from "../sort";
import { cardHolding, captureOf, draft, ownsProject, recentCapture, storeCapture, type Destination } from "../store/captures";
import { sortCards, unsortedWindow } from "../store/sorts";

/** Lower than the upload sort's medium (SORT_EFFORT): a capture is one phrasing, and the agent is waiting for it. */
export const CAPTURE_EFFORT: Effort = "low";

const NewCapture = z.strictObject(
  { text: z.string({ error: "A capture needs your question's text." }).regex(/\S/, "A capture needs your question's text.") },
  { error: "A capture is { text } and nothing else." },
);

export const captures = defineRoutes({
  "/api/v1/projects/:projectId/captures": {
    POST: authed(async (req, auth) => {
      const { text } = await readJson(req, NewCapture);
      if (text.length > MAX_PHRASING_LENGTH) throw new HttpError(413, `A capture can have at most ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters.`);
      const { projectId } = req.params;
      if (!ownsProject(auth.userId, projectId)) throw new HttpError(404, "There's no such project.");
      const capture = draft(text.trim(), Date.now());
      const earlier = recentCapture(projectId, capture.text, capture.time);
      if (earlier) return Response.json(captureOf(auth.userId, earlier, true));

      let to: Destination;
      const cardId = cardHolding(projectId, capture.text);
      if (cardId) to = { cardId };
      else {
        const cards = sortCards(projectId);
        const batch = [capture, ...unsortedWindow(projectId, config.sortBatchSize)];
        // With no card to join and nothing unsorted, it can only wait unsorted, so the model isn't asked.
        const placement = cards.length || batch.length > 1 ? await askPlacement(auth.userId, cards, batch, CAPTURE_EFFORT) : { joins: [], newCards: [] };
        to = { placement, batch: batch.map((p) => p.id) };
      }
      const stored = storeCapture(projectId, capture, to);
      if (!stored) throw new HttpError(404, "There's no such project.");
      return Response.json(captureOf(auth.userId, stored.id, stored.repeat), { status: stored.repeat ? 200 : 201 });
    }),
  },
});
