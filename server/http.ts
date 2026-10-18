// What every route shares. A handler throws HttpError to answer with a
// status and { error }; readJson checks a body against a zod schema, and
// readPage a list's limit and cursor.
// answer() is the Worker's whole fetch (worker/index.ts): it routes the API,
// turns any thrown error into JSON (never Cloudflare's error page), adds the
// security headers, and logs the method, path, status, and duration, never
// anything from a body and never an error itself.

import { z } from "zod";
import { readConfig, type Config, type Env } from "./config";
import { SECURITY_HEADERS } from "./security";
import type { Db } from "./store/db";

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

/** The `:name` segments of a route's path. */
type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}` ? Name | ParamNames<`/${Rest}`> : P extends `${string}:${infer Name}` ? Name : never;

/** A route's params, decoded, by name. */
export type Params<P extends string> = { [K in ParamNames<P>]: string };

/** What a handler gets beside its request, bound for that request alone. */
export type Context<P extends string = string> = {
  params: Params<P>;
  /** The Worker's bindings, for the model's key and the sort's Durable Object. */
  env: Env;
  /** The database, for the store's functions; nothing outside server/store/ queries it. */
  db: Db;
  config: Config;
};

export type Handler<P extends string = string> = (req: Request, ctx: Context<P>) => Response | Promise<Response>;

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** An area's routes: full paths, each with a handler per method. */
export type Routes<R extends string> = { [P in R]: Partial<Record<Method, Handler<P>>> };

/** Types an area's routes, so that each handler's params follow its path. */
export const defineRoutes = <R extends string>(routes: Routes<R>) => routes;

/** Routes composed from several areas, whose handlers each take their own path's params. */
export type RouteTable = Record<string, Partial<Record<Method, (req: Request, ctx: any) => Response | Promise<Response>>>>;

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

/**
 * A new answer with the security headers, keeping API answers out of every
 * cache. It's a copy, since a redirect's or a static asset's headers can't
 * be changed.
 */
function secure(response: Response, pathname: string): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  if (pathname.startsWith("/api/")) secured.headers.set("cache-control", "no-store");
  return secured;
}

/** An HttpError keeps its status; anything else is a 500 that says nothing more. */
function answerError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "The server failed." }, { status: 500 });
}

/** The route a path matches, with its params, or null. A param that isn't valid percent-encoding matches nothing. */
function match(routes: RouteTable, pathname: string): { methods: RouteTable[string]; params: Record<string, string> } | null {
  const parts = pathname.split("/");
  for (const [path, methods] of Object.entries(routes)) {
    const pattern = path.split("/");
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((segment, i) => {
      const part = parts[i]!;
      if (!segment.startsWith(":")) return segment === part;
      try {
        params[segment.slice(1)] = decodeURIComponent(part);
      } catch {
        return false;
      }
      return part !== "";
    });
    if (matches) return { methods, params };
  }
  return null;
}

async function route(req: Request, env: Env, routes: RouteTable, pathname: string): Promise<Response> {
  const found = match(routes, pathname);
  const handler = found?.methods[req.method as Method];
  if (!found || !handler) throw new HttpError(404, "There's no such endpoint.");
  const ctx: Context = { params: found.params, env, db: env.DB, config: readConfig(env) };
  return await handler(req, ctx);
}

/**
 * The Worker's answer to any request it gets, which is only ever under /api/:
 * the static assets answer every other path, a page or the not-found page,
 * before the Worker (wrangler.jsonc). Never a thrown error, and always with
 * the security headers.
 */
export async function answer(req: Request, env: Env, routes: RouteTable): Promise<Response> {
  const started = performance.now();
  const { pathname } = new URL(req.url);
  let response: Response;
  try {
    response = await route(req, env, routes, pathname);
  } catch (error) {
    response = answerError(error);
  }
  console.log(`${req.method} ${pathname} ${response.status} ${Math.round(performance.now() - started)}ms`);
  return secure(response, pathname);
}
