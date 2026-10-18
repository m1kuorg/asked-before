// Dashboard: the cross-project summary (m1kuorg/basics#47): what's still
// borrowed across the account's projects, the latest borrows and returns,
// and the totals by status. A session or an API key can read it.

import type { Dashboard } from "@asked-before/sdk";
import { authed } from "../auth";
import { defineRoutes } from "../http";
import { getDashboard } from "../store/dashboard";

export const dashboard = defineRoutes({
  "/api/v1/dashboard": {
    GET: authed((_req, auth) => Response.json(getDashboard(auth.userId) satisfies Dashboard)),
  },
});
