// The one Bun process (ADR 0003): the pages, the public API under /api/v1,
// and the proof of concept's three model routes until their tickets retire
// them. Every answer goes through serve(), which adds the security headers
// and logs only the method, path, status, and duration, never message text.

import { apiRoutes } from "./server/api";
import { config } from "./server/config";
import { answerError, HttpError, secure, serve, serveAll } from "./server/http";
import { notFound, pageRoutes } from "./server/pages";
import { check } from "./server/routes/check";
import { group } from "./server/routes/group";
import { rep } from "./server/routes/rep";

const server = Bun.serve({
  port: config.port,
  routes: serveAll({
    ...pageRoutes,
    ...apiRoutes,
    "/api/group": { POST: group },
    "/api/rep": { POST: rep },
    "/api/check": { POST: check },
  }),
  // Whatever no route answers, including a method a path doesn't have.
  fetch: serve((req) => {
    if (!new URL(req.url).pathname.startsWith("/api/")) return notFound(req);
    throw new HttpError(404, "There's no such endpoint.");
  }),
  error: () => secure(answerError(undefined), "/"),
});

console.log(`Asked Before is on ${server.url}`);
