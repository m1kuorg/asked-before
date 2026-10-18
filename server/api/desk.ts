// The Desk (m1kuorg/basics#47), the circulation desk: what's still
// borrowed across the account's shelves, the latest borrows and returns,
// and the totals by status. A session or an API key can read it.

import type { Desk } from "@asked-before/sdk";
import { authed } from "../auth";
import { defineRoutes } from "../http";
import { getDesk } from "../store/desk";

export const desk = defineRoutes({
  "/api/v1/desk": {
    GET: authed((_req, auth) => Response.json(getDesk(auth.userId) satisfies Desk)),
  },
});
