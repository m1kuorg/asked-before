// The roadmap: the account's cards across every shelf, placed on a fixed
// path of developer areas by the words in each card's skill name
// (server/roadmap-areas.ts), with no model request. A session or an API
// key can read it.

import type { Roadmap } from "@asked-before/sdk";
import { authed } from "../auth";
import { defineRoutes } from "../http";
import { getRoadmap } from "../store/roadmap";

export const roadmap = defineRoutes({
  "/api/v1/roadmap": {
    GET: authed(async (_req, { db, auth }) => Response.json((await getRoadmap(db, auth.userId)) satisfies Roadmap)),
  },
});
