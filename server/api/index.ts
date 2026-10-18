// The public API's route table, version 1, composed here and only here.
// Each area of the spec's API table is its own module, built by its own
// ticket. Anything else under /api/, a path or a method, is a 404
// (server/http.ts). On Workers (m1kuorg/basics#60), an area joins the table
// once it's ported: uploads, cards, captures, and the Desk with
// m1kuorg/basics#62, and cold reps with m1kuorg/basics#63.

import type { RouteTable } from "../http";
import { account } from "./account";
import { auth } from "./auth";
import { health } from "./health";
import { keys } from "./keys";
import { shelves } from "./shelves";

const areas: RouteTable[] = [auth, account, keys, shelves, health];

export const apiRoutes: RouteTable = {};
for (const area of areas) {
  for (const [path, methods] of Object.entries(area)) {
    if (path in apiRoutes) throw new Error(`Two API areas both route ${path}.`);
    apiRoutes[path] = methods;
  }
}
