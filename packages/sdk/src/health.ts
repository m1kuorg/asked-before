// Health: the liveness check (m1kuorg/basics#41). It needs no account.

import type { Request } from "./http";

export const health = (request: Request) => ({
  check: () => request<{ ok: true }>("GET", "/health"),
});
