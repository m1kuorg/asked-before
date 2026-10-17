// What every route shares. A handler throws HttpError to answer with a
// status and { error }; readJson checks a body against a zod schema, and
// readPage a list's limit and cursor.
// serve() wraps every handler the server has: it turns a thrown error into
// its answer, adds the security headers, and logs the method, path,
// status, and duration, never anything from a body.

import type { BunRequest, Server } from "bun";
import { z } from "zod";
import { config } from "./config";

/** An answer other than 2xx. Its message is shown to the caller, so it never holds phrasing text. */
export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Handler<P extends string = string> = (
  req: BunRequest<P>,
  server: Server<undefined>,
) => Response | Promise<Response>;

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** An area's routes: full paths, each with a handler per method. */
export type Routes<R extends string> = { [P in R]: Partial<Record<Method, Handler<P>>> };

/** Types an area's routes, so that each handler's req.params follows its path. */
export const defineRoutes = <R extends string>(routes: Routes<R>) => routes;

/** Routes composed from several areas, whose handlers each take their own path's params. */
export type RouteTable = Record<string, Partial<Record<Method, (req: any, server: Server<undefined>) => Response | Promise<Response>>>>;

/** The parsed body, or a 400 with the schema's first message. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const body: unknown = await req.json().catch(() => undefined);
  if (body === undefined) throw new HttpError(400, "The body should be JSON.");
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "The body isn't valid.");
  return result.data;
}

const LIMIT = "limit is a number from 1 to 100.";
const Page = z.object({
  limit: z.coerce.number({ error: LIMIT }).int(LIMIT).min(1, LIMIT).max(100, LIMIT).default(50),
  cursor: z.string().min(1, "cursor is the next value of the page before.").optional(),
});

/** A list's page from the query: `limit`, 1 to 100 and 50 by default, and `cursor`, the page before's `next`; or a 400. */
export function readPage(req: Request): z.infer<typeof Page> {
  const query = Page.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!query.success) throw new HttpError(400, query.error.issues[0]?.message ?? "The query isn't valid.");
  return query.data;
}

// Only the app's own origin, for every kind of content. fflate inflates a
// large zip entry in a worker made from a blob: URL, which the page itself
// creates (app-notes/unzip-in-browser.md, Workers and CSP).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  ...(config.https ? { "strict-transport-security": "max-age=31536000" } : {}),
};

/** Adds the security headers, and keeps API answers out of every cache. */
export function secure(response: Response, pathname: string): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  if (pathname.startsWith("/api/")) response.headers.set("cache-control", "no-store");
  return response;
}

/** An HttpError keeps its status; anything else is a 500 that says nothing more. */
export function answerError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "The server failed." }, { status: 500 });
}

export const serve =
  <R extends Request>(handler: (req: R, server: Server<undefined>) => Response | Promise<Response>) =>
  async (req: R, server: Server<undefined>): Promise<Response> => {
    const started = performance.now();
    let response: Response;
    try {
      response = await handler(req, server);
    } catch (error) {
      response = answerError(error);
    }
    const { pathname } = new URL(req.url);
    console.log(`${req.method} ${pathname} ${response.status} ${Math.round(performance.now() - started)}ms`);
    return secure(response, pathname);
  };

/** Wraps every handler in a route table with serve(). */
export function serveAll(routes: RouteTable) {
  return Object.fromEntries(
    Object.entries(routes).map(([path, route]) => [
      path,
      Object.fromEntries(Object.entries(route).map(([method, handler]) => [method, serve(handler)])),
    ]),
  );
}
