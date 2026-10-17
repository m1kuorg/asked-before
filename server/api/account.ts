// Account: update the name and email, change the password
// (m1kuorg/basics#48), export all data, and delete the account
// (m1kuorg/basics#49). All of them need a session: authed(..., { sessionOnly: true }).
// Stubs answer 501 until then.

import { defineRoutes, notBuilt } from "../http";

export const account = defineRoutes({
  "/api/v1/account": {
    PATCH: notBuilt("m1kuorg/basics#48"),
    DELETE: notBuilt("m1kuorg/basics#49"),
  },
  "/api/v1/account/password": { POST: notBuilt("m1kuorg/basics#48") },
  "/api/v1/account/export": { GET: notBuilt("m1kuorg/basics#49") },
});
