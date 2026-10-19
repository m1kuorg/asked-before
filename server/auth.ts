// Who is calling. authed() wraps every handler that needs an account: a
// Bearer API key when one is sent, and the cookie is then ignored; or else
// the session cookie, whose mutating requests must also pass sameOrigin().
// A route only a session may use says so, and a key gets 403 there; so
// does a route the shared guest may not use (settings: the account and its
// keys, m1kuorg/basics#73), and a guest's session gets 403 there. The
// session cookie is read here, and its Set-Cookie line made here for the
// handler to answer with.

import type { Account } from "@asked-before/sdk";
import type { Config } from "./config";
import { HttpError, type Context, type Handler } from "./http";
import { useKey } from "./store/keys";
import { createSession, findSession, SESSION_DAYS } from "./store/sessions";
import { GUEST_ID } from "./store/users";

export type Auth =
  | { via: "session"; userId: string; sessionId: string }
  | { via: "key"; userId: string; keyId: string };

/** With an https public URL the cookie is Secure and __Host- prefixed. */
const cookieName = (config: Config) => (config.https ? "__Host-session" : "session");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function authed<P extends string>(
  handler: (req: Request, ctx: Context<P> & { auth: Auth }) => Response | Promise<Response>,
  { sessionOnly = false, notGuest = false } = {},
): Handler<P> {
  return async (req, ctx) => {
    const auth = await authenticate(req, ctx);
    if (sessionOnly && auth.via === "key") throw new HttpError(403, "An API key can't do this. Log in to Asked Before to do it.");
    if (notGuest && auth.userId === GUEST_ID) throw new HttpError(403, "A guest can't do this. Sign up for an account of your own to do it.");
    return handler(req, { ...ctx, auth });
  };
}

async function authenticate(req: Request, { db, config }: Pick<Context, "db" | "config">): Promise<Auth> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)/i);
  if (bearer) {
    // An API key, ab_<id>_<secret>: a revoked or made-up one is a 401.
    const key = await useKey(db, bearer[1]!);
    if (!key) throw new HttpError(401, "That API key isn't valid.");
    return { via: "key", userId: key.userId, keyId: key.keyId };
  }
  const session = await findSession(db, sessionToken(req, config));
  if (!session) throw new HttpError(401, "Log in first.");
  if (!SAFE_METHODS.has(req.method)) sameOrigin(req, config);
  return { via: "session", userId: session.userId, sessionId: session.id };
}

/**
 * A request that changes something on the page's behalf must come from the
 * app's own origin (PUBLIC_URL's, or else the one it was sent to), and send
 * JSON, which a form on another site can't. A DELETE may have no body.
 */
export function sameOrigin(req: Request, config: Config): void {
  const origin = config.publicUrl?.origin ?? new URL(req.url).origin;
  if (req.headers.get("origin") !== origin) throw new HttpError(403, "This request didn't come from the Asked Before page.");
  const type = req.headers.get("content-type");
  const json = type !== null && /^application\/json\s*(;|$)/i.test(type);
  if (!json && !(req.method === "DELETE" && type === null)) throw new HttpError(403, "This request needs a JSON body.");
}

/** The session cookie's token, if the request sent one. */
function sessionToken(req: Request, config: Config): string | null {
  const name = cookieName(config);
  for (const pair of (req.headers.get("cookie") ?? "").split(";")) {
    const at = pair.indexOf("=");
    if (at > 0 && pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim() || null;
  }
  return null;
}

/** The Set-Cookie line for the session cookie, holding `token` for `maxAge` seconds. */
const sessionCookie = (config: Config, token: string, maxAge: number) =>
  [`${cookieName(config)}=${token}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax", ...(config.https ? ["Secure"] : [])].join("; ");

/**
 * Starts a session for the account, ending the one the browser had, while
 * the account still has `passwordHash` (store/sessions.ts). The account, and
 * the Set-Cookie line to answer with; or null when the account is gone or
 * its password changed meanwhile.
 */
export async function startSession(
  req: Request,
  { db, config }: Pick<Context, "db" | "config">,
  login: { userId: string; passwordHash: string },
): Promise<{ account: Account; setCookie: string } | null> {
  const started = await createSession(db, { ...login, earlier: sessionToken(req, config) });
  return started && { account: started.account, setCookie: sessionCookie(config, started.token, SESSION_DAYS * 24 * 60 * 60) };
}

/** The Set-Cookie line that clears the session cookie. */
export const clearSessionCookie = (config: Config) => sessionCookie(config, "", 0);
