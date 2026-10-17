// Captures: record one phrasing into a project and sort it at once
// (m1kuorg/basics#50). The stub answers 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const captures = defineRoutes({
  "/api/v1/projects/:projectId/captures": { POST: notBuilt("m1kuorg/basics#50") },
});
