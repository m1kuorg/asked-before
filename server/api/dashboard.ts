// Dashboard: the cross-project summary (m1kuorg/basics#47). The stub
// answers 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const dashboard = defineRoutes({
  "/api/v1/dashboard": { GET: notBuilt("m1kuorg/basics#47") },
});
