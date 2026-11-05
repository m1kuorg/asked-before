// The request the inputs make, and sending it. build() turns the draft into
// the path under /api/v1 (each id one encoded segment, an empty one left as
// its :param), the list's limit and cursor, the endpoint's other query
// parameters, and the body: every POST and
// PATCH sends JSON, {} when it's empty or reads none, since the server
// refuses a session's change without it (server/auth.ts). send() is a raw
// fetch on purpose, not the SDK: the playground's subject is the HTTP
// exchange, so a 401 shows in the response pane instead of the app's
// redirect to log in (src/lib/client.ts). As this session it sends the
// cookie, and the browser adds the page's Origin; with an API key it sends
// only the Bearer header, and the key stays in memory, in the draft.

import { sendsBody, type Entry, type Param } from "./endpoints";

export type SendAs = "session" | "key";

/** What the inputs hold, for every endpoint at once: picking another keeps them. */
export type Draft = {
  /** The path's ids, by :param. Shared across endpoints, so an id picked for one is there for the next. */
  ids: Partial<Record<Param, string>>;
  limit: string;
  cursor: string;
  /** The query fields typed, by name, shared across endpoints; one not typed in yet holds its example. */
  query: Record<string, string>;
  /** The JSON body typed for each endpoint, by its id; an endpoint not typed in yet shows its example. */
  bodies: Record<string, string>;
  sendAs: SendAs;
  /** A pasted API key, in memory only. */
  key: string;
};

export type Built = {
  method: Entry["method"];
  /** The path and query under the origin: /api/v1/shelves?limit=10. */
  url: string;
  /** The JSON sent, or none for a GET or DELETE. */
  body: string | undefined;
  /** The body as parsed, for the code tabs; undefined when it isn't valid JSON. */
  parsed: unknown;
  /** Why the typed body isn't JSON, or null. */
  bodyError: string | null;
  /** The :params still empty. */
  missing: Param[];
  /** The page's limit and cursor, as given. */
  page: { limit?: string; cursor?: string };
  /** The endpoint's other query parameters that aren't empty, by name. */
  query: Record<string, string>;
};

/** The open endpoint's query fields as the inputs show them: as typed, or their examples. */
export function queryOf(entry: Entry, typed: Draft["query"]): Record<string, string> {
  return Object.fromEntries((entry.query ?? []).map((field) => [field.name, typed[field.name] ?? field.example?.() ?? ""]));
}

/** `ids` are the draft's with the shelf filled in, and `body` is the open endpoint's, as typed or its example. */
export function build({ entry, ids, limit, cursor, query: asked, body }: Pick<Draft, "ids" | "limit" | "cursor" | "query"> & { entry: Entry; body: string }): Built {
  const missing = entry.params.filter((param) => !ids[param]?.trim());
  const path = entry.path.replace(/:(\w+)/g, (template, name: Param) => {
    const value = ids[name]?.trim();
    return value ? encodeURIComponent(value) : template;
  });
  const page: Built["page"] = {};
  if (entry.paged && limit.trim()) page.limit = limit.trim();
  if (entry.paged && cursor.trim()) page.cursor = cursor.trim();
  const query: Built["query"] = {};
  for (const field of entry.query ?? []) {
    const value = asked[field.name]?.trim();
    if (value) query[field.name] = value;
  }
  const search = new URLSearchParams({ ...query, ...page });
  const url = `/api/v1${path}${search.size ? `?${search}` : ""}`;

  const made = { method: entry.method, url, missing, page, query };
  if (!sendsBody(entry)) return { ...made, body: undefined, parsed: undefined, bodyError: null };
  if (entry.noBody || !body.trim()) return { ...made, body: "{}", parsed: {}, bodyError: null };
  try {
    const parsed: unknown = JSON.parse(body);
    return { ...made, body: JSON.stringify(parsed), parsed, bodyError: null };
  } catch (error) {
    return { ...made, body: body, parsed: undefined, bodyError: error instanceof Error ? error.message : String(error) };
  }
}

/** The example body an endpoint opens with, pretty, from the learner's own data. */
export function exampleBody(entry: Entry, shelfName: string | undefined): string {
  if (!sendsBody(entry) || entry.noBody) return "";
  return JSON.stringify(entry.body ? entry.body({ shelfName }) : {}, null, 2);
}

/** What came back: the status, how long it took, its size, and its body as text and, when it's JSON, parsed. */
export type Answer = { status: number; ms: number; bytes: number; text: string; json: unknown };

const encoder = new TextEncoder();

export async function send(built: Built, sendAs: SendAs, key: string, signal: AbortSignal): Promise<Answer> {
  const headers: Record<string, string> = {};
  if (sendAs === "key") headers.authorization = `Bearer ${key.trim()}`;
  if (built.body !== undefined) headers["content-type"] = "application/json";
  const started = performance.now();
  // A key's request carries no cookie, so the key alone says who's calling.
  const response = await fetch(built.url, { method: built.method, headers, body: built.body, credentials: sendAs === "key" ? "omit" : "same-origin", signal });
  const text = await response.text();
  const ms = performance.now() - started;
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, ms, bytes: encoder.encode(text).length, text, json };
}
