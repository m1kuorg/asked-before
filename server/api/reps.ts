// Reps: start a cold rep on a card, and check an answer once
// (m1kuorg/basics#46). Stubs answer 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const reps = defineRoutes({
  "/api/v1/cards/:cardId/reps": { POST: notBuilt("m1kuorg/basics#46") },
  "/api/v1/reps/:repId/check": { POST: notBuilt("m1kuorg/basics#46") },
});
