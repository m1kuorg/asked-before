// Captures: record one phrasing into a project and sort it at once
// (m1kuorg/basics#50, ADR 0002), so an agent can answer in the same turn.
// An API key may make one.
//
// A capture is { text } and nothing else: your own words, of at most 2,000
// characters once trimmed (413 past it), stamped with the server's clock.
// The same words in the same project within ten minutes answer 200 with
// that earlier capture and add no borrow. Otherwise it's stored and
// answers 201: words that match a phrasing on a card, ignoring case and
// spacing, join that card without asking the model; anything else is
// placed by the sort's own request and checks (server/sort.ts), at a lower
// effort, against the project's cards and its most recent unsorted
// phrasings. It joins a card, makes a new one with unsorted phrasings that
// ask the same thing, or waits unsorted; the rest of what the answer says
// is left for the next upload's sort. A failed model request stores
// nothing, so the capture can be sent again.

import { MAX_PHRASING_LENGTH, type Capture } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import type { Effort } from "../model";
import { askPlacement } from "../sort";
import { captureOf, draft, lookUp, storeCapture, type Draft } from "../store/captures";
import { sortCards, unsortedWindow, type Placement } from "../store/sorts";

/**
 * Lower than the upload sort's medium (SORT_EFFORT), since the agent waits
 * on a capture in the same turn. Tuned with `bun run check:capture-sort 3`
 * (m1kuorg/basics#50): low and medium both placed 60 of 60 captures, fresh
 * rephrasings of the demo export's five skills and questions none of them
 * ask, with medians of 1.7s and 1.8s. The slowest low capture took 2.7s in
 * one set of runs and 5.0s in another; the slowest medium one, 3.3s.
 */
export const CAPTURE_EFFORT: Effort = "low";

/**
 * How many of the project's most recent unsorted phrasings a capture is
 * compared with. With the sort's 300, a capture behind a long unsorted
 * history took up to 12s, the model's answer busy placing the others.
 */
export const CAPTURE_WINDOW = 50;

const NO_PROJECT = "There's no such project.";

const NewCapture = z.strictObject(
  { text: z.string({ error: "A capture needs your question's text." }).regex(/\S/, "A capture needs your question's text.") },
  { error: "A capture is { text } and nothing else." },
);

/** Asks the sort where the capture goes, and keeps only that: the card it joins, or the new card it makes. */
async function sortCapture(userId: string, projectId: string, capture: Draft): Promise<Placement> {
  const cards = sortCards(projectId);
  const batch = [capture, ...unsortedWindow(projectId, CAPTURE_WINDOW)];
  // With no card to join and nothing unsorted, it can only wait unsorted, so the model isn't asked.
  if (!cards.length && batch.length === 1) return { joins: [], newCards: [] };
  const { joins, newCards } = await askPlacement(userId, cards, batch, CAPTURE_EFFORT);
  const holds = (ids: string[]) => ids.includes(capture.id);
  return {
    joins: joins.filter((join) => holds(join.phrasingIds)).map((join) => ({ cardId: join.cardId, phrasingIds: [capture.id] })),
    newCards: newCards.filter((card) => holds(card.phrasingIds)),
  };
}

const answer = (userId: string, phrasingId: string, alreadyCaptured: boolean) => {
  const capture = captureOf(userId, phrasingId, alreadyCaptured);
  if (!capture) throw new HttpError(404, NO_PROJECT);
  return Response.json(capture satisfies Capture, { status: alreadyCaptured ? 200 : 201 });
};

export const captures = defineRoutes({
  "/api/v1/projects/:projectId/captures": {
    POST: authed(async (req, auth) => {
      const text = (await readJson(req, NewCapture)).text.trim();
      if (text.length > MAX_PHRASING_LENGTH) throw new HttpError(413, `A capture can have at most ${MAX_PHRASING_LENGTH.toLocaleString("en-US")} characters.`);
      const { projectId } = req.params;
      const capture = draft(text);
      const found = lookUp(auth.userId, projectId, capture);
      if (!found) throw new HttpError(404, NO_PROJECT);
      if ("earlier" in found) return answer(auth.userId, found.earlier, true);
      const placement = found.cardId
        ? { joins: [{ cardId: found.cardId, phrasingIds: [capture.id] }], newCards: [] }
        : await sortCapture(auth.userId, projectId, capture);
      const stored = storeCapture(auth.userId, projectId, capture, placement);
      if (!stored) throw new HttpError(404, NO_PROJECT);
      return answer(auth.userId, stored.id, stored.alreadyCaptured);
    }),
  },
});
