// The Worker (m1kuorg/basics#60): the API under /api/, the one path that
// reaches it before the static assets (wrangler.jsonc). server/http.ts's
// answer() routes it, answers every failure as JSON, adds the security
// headers, and logs each request. Each shelf's sort runs in its Durable
// Object, Sorter (worker/sorter.ts).

import type { ExportedHandler } from "@cloudflare/workers-types";
import { apiRoutes } from "../server/api";
import type { Env } from "../server/config";
import { answer } from "../server/http";

export { Sorter } from "./sorter";

export default {
  fetch: (req, env) => answer(req, env, apiRoutes),
} satisfies ExportedHandler<Env>;
