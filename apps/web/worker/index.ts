// The Worker (m1kuorg/basics#60): the API under /api/, the one path that
// reaches it before the static assets (wrangler.jsonc). server/http.ts's
// answer() routes it, answers every failure as JSON, adds the security
// headers, and logs each request. Each shelf's sort runs in its Durable
// Object, Sorter (worker/sorter.ts), and a cron every five minutes starts
// again any sort that has stalled, with an upload left waiting or sorting,
// and resets the guest workspace on its first run of each UTC day.

import type { ExportedHandler } from "@cloudflare/workers-types";
import { apiRoutes } from "../server/api";
import type { Env } from "../server/config";
import { answer } from "../server/http";
import { resumeStalledSorts } from "../server/sort";
import { resetGuestWorkspace } from "../server/store/guest";

export { Sorter } from "./sorter";

export default {
  fetch: (req, env) => answer(req, env, apiRoutes),
  // The cron (wrangler.jsonc) starts the stalled sorts again, and resets the guest workspace once a day. Nothing
  // escapes either, and nothing is logged: a reset that failed is tried again on the next run.
  scheduled: async (controller, env) => {
    await Promise.all([resumeStalledSorts(env, controller.scheduledTime), resetGuestWorkspace(env.DB, controller.scheduledTime).catch(() => {})]);
  },
} satisfies ExportedHandler<Env>;
