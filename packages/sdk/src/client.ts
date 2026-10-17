// The client: one per server and credential, with one group of methods per
// API area. Each area's methods live in that area's own file, so building an
// area never edits this one.

import { account } from "./account";
import { auth } from "./auth";
import { captures } from "./captures";
import { cards } from "./cards";
import { dashboard } from "./dashboard";
import { health } from "./health";
import { requester, type ClientOptions } from "./http";
import { keys } from "./keys";
import { projects } from "./projects";
import { reps } from "./reps";
import { uploads } from "./uploads";

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
