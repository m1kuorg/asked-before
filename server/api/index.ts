// The public API's route table, version 1, composed here and only here.
// Each area of the spec's API table is its own module, built by its own
// ticket; an area whose ticket hasn't landed answers 501. Anything else
// under /api/ is a 404.

import { HttpError, type RouteTable } from "../http";
import { account } from "./account";
import { auth } from "./auth";
import { captures } from "./captures";
import { cards } from "./cards";
import { dashboard } from "./dashboard";
import { health } from "./health";
import { keys } from "./keys";
import { projects } from "./projects";
import { reps } from "./reps";
import { uploads } from "./uploads";

const areas: RouteTable[] = [auth, account, keys, projects, uploads, cards, captures, reps, dashboard, health];

export const apiRoutes: RouteTable = {};
for (const area of areas) {
  for (const [path, methods] of Object.entries(area)) {
    if (path in apiRoutes) throw new Error(`Two API areas both route ${path}.`);
    apiRoutes[path] = methods;
  }
}

apiRoutes["/api/*"] = {
  GET: noSuchEndpoint,
  POST: noSuchEndpoint,
  PATCH: noSuchEndpoint,
  DELETE: noSuchEndpoint,
};

function noSuchEndpoint(): never {
  throw new HttpError(404, "There's no such endpoint.");
}
