// Reps: start a cold rep on a card, and check an answer once
// (m1kuorg/basics#46). Both ask the model (server/reps.ts), so both count
// toward the account's daily cap, and an API key may do both.
//
// Starting a rep writes a fresh problem from the card's phrasings and its
// earlier problems, plus the lesson when the card has none yet, which is
// kept only then. It answers 201 with the rep, and with the lesson on the
// card's first rep or after a failed one (any start until a checked rep has
// passed, or since the latest checked one failed), else null. A rep left
// unchecked when a newer one starts stays unchecked for good.
//
// Checking takes { answer } and nothing else, and answers with the rep, now
// holding the answer, the verdict, and the reason, and the card as the
// check left it: a pass stamps it returned. A rep already checked, or left
// for a newer one, is a 409, and so is losing a race to check it. Another
// account's card or rep is a 404. A failed model request stores nothing.

import type { CheckedRep, StartedRep } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { judge, writeRep } from "../reps";
import { findCard } from "../store/cards";
import { addRep, findRep, recordCheck, repSource } from "../store/reps";

/** The longest answer, in characters, a check takes. */
const MAX_ANSWER = 4000;

const Answer = z.strictObject(
  { answer: z.string({ error: "A check needs your answer." }).trim().min(1, "A check needs your answer.") },
  { error: "A check is { answer } and nothing else." },
);

const CHECKED = "This cold rep is checked already. Start a new one to try again.";
const SUPERSEDED = "A newer cold rep on this card has started, so this one can't be checked. Answer that one instead.";

export const reps = defineRoutes({
  "/api/v1/cards/:cardId/reps": {
    POST: authed(async (_req, { env, db, params, auth }) => {
      const card = await repSource(db, auth.userId, params.cardId);
      if (!card) throw new HttpError(404, "There's no such card.");
      const withLesson = card.lesson === null;
      const written = await writeRep(env, auth.userId, { skill: card.skill, phrasings: card.phrasings, earlierProblems: card.earlierProblems, withLesson });
      const added = await addRep(db, params.cardId, written.problem, written.lesson);
      if (!added) throw new HttpError(404, "There's no such card.");
      const showLesson = withLesson || card.lastVerdict !== "pass";
      return Response.json({ rep: added.rep, lesson: showLesson ? added.lesson : null } satisfies StartedRep, { status: 201 });
    }),
  },
  "/api/v1/reps/:repId/check": {
    POST: authed(async (req, { env, db, params, auth }) => {
      const { answer } = await readJson(req, Answer);
      if (answer.length > MAX_ANSWER) throw new HttpError(413, `An answer can have at most ${MAX_ANSWER.toLocaleString("en-US")} characters.`);
      const found = await findRep(db, auth.userId, params.repId);
      if (!found) throw new HttpError(404, "There's no such cold rep.");
      if (found.state === "checked") throw new HttpError(409, CHECKED);
      if (found.state === "superseded") throw new HttpError(409, SUPERSEDED);
      const { verdict, reason } = await judge(env, auth.userId, { skill: found.skill, problem: found.rep.problem, answer });
      const rep = await recordCheck(db, found.rep.id, { answer, verdict, reason });
      if (!rep) {
        const now = await findRep(db, auth.userId, params.repId);
        if (!now) throw new HttpError(404, "There's no such cold rep.");
        throw new HttpError(409, now.state === "superseded" ? SUPERSEDED : CHECKED);
      }
      const card = await findCard(db, auth.userId, found.cardId);
      if (!card) throw new HttpError(404, "There's no such card.");
      return Response.json({ rep, card } satisfies CheckedRep);
    }),
  },
});
