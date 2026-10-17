// Cards: list a project's cards with their status, list its unsorted
// phrasings, and get one card with its borrows and reps
// (m1kuorg/basics#44). Stubs answer 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const cards = defineRoutes({
  "/api/v1/projects/:projectId/cards": { GET: notBuilt("m1kuorg/basics#44") },
  "/api/v1/projects/:projectId/unsorted": { GET: notBuilt("m1kuorg/basics#44") },
  "/api/v1/cards/:cardId": { GET: notBuilt("m1kuorg/basics#44") },
});
