// Analysis (m1kuorg/basics#79): how you ask, and what you keep re-asking,
// counted by code, never by the model. A session or an API key can read it.
// `timeZone` is the IANA zone the months are counted in, UTC unless given;
// one the runtime doesn't know is a 400 that doesn't repeat it. `shelfId`
// counts one shelf; another account's, or none, is a 404.
//
// CPU (Workers Free allows 10 ms a request): SQL does the counting, and the
// JavaScript only works out each month's start in the zone and shapes the
// answer, so its cost follows the months, not the phrasings. Measured on
// 2026-10-25 under wrangler dev: 8,000 phrasings on 50 cards over 20 months,
// sorted through the SDK, took about 0.14 ms of JavaScript a request (the
// handler run 200 times with D1's answers replayed, so D1's own time is left
// out), and about 65 ms of wall time, nearly all of it D1's SQLite.

import type { Analysis } from "@asked-before/sdk";
import { authed } from "../auth";
import { defineRoutes, HttpError } from "../http";
import { getAnalysis, Zone } from "../store/analysis";

/** Longer than any IANA name, so a long value never reaches Intl. */
const MAX_ZONE = 64;

/** The zone the months are counted in: UTC when none is given, or a 400 for one the runtime doesn't know. */
function readZone(value: string | null): Zone {
  try {
    if ((value?.length ?? 0) <= MAX_ZONE) return new Zone(value || "UTC");
  } catch {
    // An unknown zone: the 400 below.
  }
  throw new HttpError(400, "timeZone isn't a time zone the server knows. Send an IANA name, such as Europe/Berlin.");
}

export const analysis = defineRoutes({
  "/api/v1/analysis": {
    GET: authed(async (req, { db, auth }) => {
      const query = new URL(req.url).searchParams;
      const zone = readZone(query.get("timeZone"));
      const answer = await getAnalysis(db, auth.userId, zone, query.get("shelfId") || null);
      if (!answer) throw new HttpError(404, "There's no such shelf.");
      return Response.json(answer satisfies Analysis);
    }),
  },
});
