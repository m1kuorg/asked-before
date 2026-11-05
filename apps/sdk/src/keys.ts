// API keys: list, create (shown once), and revoke (m1kuorg/basics#48). A key
// lets a script or an agent reach the account's shelves as a Bearer token:
// pass it to createClient({ baseUrl, apiKey }). Managing keys needs a session,
// so a key can't make, list, or revoke keys.

import { path, type Requester } from "./http.ts";

export type ApiKey = {
  id: string;
  name: string;
  /** The key's start, ab_<id>, which says which key it is without its secret. */
  prefix: string;
  createdAt: string;
  /** When it was last used, to the minute, or null before its first use. */
  lastUsedAt: string | null;
};

export type NewApiKey = { name: string };

/** A key just made: the only answer that carries the whole key, ab_<id>_<secret>. */
export type CreatedApiKey = ApiKey & { key: string };

export const keys = (request: Requester) => ({
  list: () => request<{ keys: ApiKey[] }>("GET", "/keys").then((body) => body.keys),
  create: (input: NewApiKey) => request<CreatedApiKey>("POST", "/keys", input),
  revoke: (keyId: string) => request<void>("DELETE", path`/keys/${keyId}`),
});
