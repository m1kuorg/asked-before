// Health: the liveness check (m1kuorg/basics#41). It needs no account.

import { defineRoutes } from "../http";

export const health = defineRoutes({
  "/api/v1/health": { GET: () => Response.json({ ok: true }) },
});
