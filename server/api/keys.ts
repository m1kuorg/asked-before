// API keys: list, create (the key is shown once), and revoke
// (m1kuorg/basics#48). All of them need a session: authed(..., { sessionOnly: true }).
// Stubs answer 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const keys = defineRoutes({
  "/api/v1/keys": { GET: notBuilt("m1kuorg/basics#48"), POST: notBuilt("m1kuorg/basics#48") },
  "/api/v1/keys/:keyId": { DELETE: notBuilt("m1kuorg/basics#48") },
});
