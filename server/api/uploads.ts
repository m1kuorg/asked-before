// Uploads: list a project's uploads, create one, append a chunk of up to
// 2,000 phrasings, finish it, and get one (m1kuorg/basics#43); retry a
// failed sort (m1kuorg/basics#44); delete one, which needs a session
// (m1kuorg/basics#45). Stubs answer 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const uploads = defineRoutes({
  "/api/v1/projects/:projectId/uploads": { GET: notBuilt("m1kuorg/basics#43"), POST: notBuilt("m1kuorg/basics#43") },
  "/api/v1/uploads/:uploadId": {
    GET: notBuilt("m1kuorg/basics#43"),
    DELETE: notBuilt("m1kuorg/basics#45"),
  },
  "/api/v1/uploads/:uploadId/phrasings": { POST: notBuilt("m1kuorg/basics#43") },
  "/api/v1/uploads/:uploadId/finish": { POST: notBuilt("m1kuorg/basics#43") },
  "/api/v1/uploads/:uploadId/retry": { POST: notBuilt("m1kuorg/basics#44") },
});
