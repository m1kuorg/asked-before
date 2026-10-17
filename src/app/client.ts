// The page's one way to reach the server: the SDK, on the page's own origin
// with its session cookie (ADR 0004). A 401 means the session is over, so
// the page goes to log in, and comes back here after.

import { createClient } from "@asked-before/sdk";

/** Log in, then come back to where the learner is now. */
export function toLogIn(): void {
  location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
}

export const client = createClient({
  fetch: async (url, init) => {
    const response = await fetch(url, init);
    if (response.status !== 401) return response;
    toLogIn();
    // The page is leaving; nothing should draw the failure meanwhile.
    return new Promise<Response>(() => {});
  },
});
