// How the SDK calls the API: one request function per client, which sends
// JSON to /api/v1, adds the API key when there is one, and turns a non-2xx
// answer into an ApiError carrying the status and the server's { error }.

export type ClientOptions = {
  /** The server, such as "https://asked-before.example". Leave it out in the page, which calls its own origin. */
  baseUrl?: string;
  /** An API key, ab_<id>_<secret>. Leave it out in the page, which sends its session cookie instead. */
  apiKey?: string;
  /** The fetch to send through. Defaults to the global fetch. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

/** A failed request: the HTTP status, and the server's message. */
export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Calls one endpoint, given its path under /api/v1. A 204 resolves to undefined. */
export type Request = <T>(method: Method, path: string, body?: unknown) => Promise<T>;

export function requester({ baseUrl = "", apiKey, fetch: send = globalThis.fetch.bind(globalThis) }: ClientOptions): Request {
  const root = `${baseUrl.replace(/\/+$/, "")}/api/v1`;
  return async <T>(method: Method, path: string, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    // POST and PATCH always send JSON, as the server requires of the page; GET and DELETE only when given a body.
    const payload = body !== undefined || method === "POST" || method === "PATCH" ? JSON.stringify(body ?? {}) : undefined;
    if (payload !== undefined) headers["content-type"] = "application/json";

    const response = await send(`${root}${path}`, { method, headers, body: payload });
    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (data as { error?: unknown } | null)?.error;
      throw new ApiError(response.status, typeof error === "string" ? error : `The request failed (${response.status}).`);
    }
    return data as T;
  };
}

/** A path with every interpolated value encoded as one segment: path`/projects/${id}`. */
export const path = (strings: TemplateStringsArray, ...values: string[]) =>
  String.raw({ raw: strings }, ...values.map(encodeURIComponent));
