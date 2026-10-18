// Health: the liveness check (m1kuorg/basics#41). It needs no account.

import type { Requester } from "./http.ts";

export const health = (request: Requester) => ({
  check: () => request<{ ok: true }>("GET", "/health"),
});
