// The public API's route table, version 1, composed here and only here.
// Each area of the spec's API table is its own module, built by its own
// ticket. Anything else under /api/, a path or a method, is a 404
// (server/http.ts).

import type { RouteTable } from "../http";
import { account } from "./account";
import { auth } from "./auth";
import { captures } from "./captures";
import { cards } from "./cards";
import { desk } from "./desk";
import { health } from "./health";
import { keys } from "./keys";
import { reps } from "./reps";
import { shelves } from "./shelves";
import { uploads } from "./uploads";

const areas: RouteTable[] = [auth, account, keys, shelves, uploads, cards, captures, reps, desk, health];

export const apiRoutes: RouteTable = {};
for (const area of areas) {
  for (const [path, methods] of Object.entries(area)) {
    if (path in apiRoutes) throw new Error(`Two API areas both route ${path}.`);
    apiRoutes[path] = methods;
  }
}
