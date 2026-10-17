// The client: one per server and credential, with one group of methods per
// API area. Each area's methods live in that area's own file, so building an
// area never edits this one.

import { account } from "./account.ts";
import { auth } from "./auth.ts";
import { captures } from "./captures.ts";
import { cards } from "./cards.ts";
import { dashboard } from "./dashboard.ts";
import { health } from "./health.ts";
import { requester, type ClientOptions } from "./http.ts";
import { keys } from "./keys.ts";
import { projects } from "./projects.ts";
import { reps } from "./reps.ts";
import { uploads } from "./uploads.ts";

/**
 * In the page, `createClient()` calls its own origin with the session cookie.
 * Elsewhere, pass the server's `baseUrl` and an `apiKey`.
 */
export function createClient(options: ClientOptions = {}) {
  const request = requester(options);
  return {
    auth: auth(request),
    account: account(request),
    keys: keys(request),
    projects: projects(request),
    uploads: uploads(request),
    cards: cards(request),
    captures: captures(request),
    reps: reps(request),
    dashboard: dashboard(request),
    health: health(request),
  };
}

export type Client = ReturnType<typeof createClient>;
