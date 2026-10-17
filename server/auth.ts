// Who is calling. authed() wraps every handler that needs an account: a
// Bearer API key when one is sent, and the cookie is then ignored; or else
// the session cookie, whose mutating requests must also pass sameOrigin().
// A route only a session may use says so, and a key gets 403 there. The
// session cookie is set and cleared here too.

import type { BunRequest, CookieMap } from "bun";
import { config } from "./config";
import { HttpError, type Handler } from "./http";
import { createSession, findSession, SESSION_DAYS } from "./store/sessions";

export type Auth =
  | { via: "session"; userId: string; sessionId: string }
  | { via: "key"; userId: string; keyId: string };

/** With an https public URL the cookie is Secure and __Host- prefixed. */
const SESSION_COOKIE = config.https ? "__Host-session" : "session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** A routed request, whatever its path: Bun gives these their cookies. */
type WithCookies = Request & { readonly cookies: CookieMap };

export function authed<P extends string>(
  handler: (req: BunRequest<P>, auth: Auth) => Response | Promise<Response>,
  { sessionOnly = false } = {},
): Handler<P> {
  return (req) => {
    const auth = authenticate(req);
    if (sessionOnly && auth.via === "key") throw new HttpError(403, "An API key can't do this. Log in to Asked Before to do it.");
    return handler(req, auth);
  };
}

function authenticate(req: WithCookies): Auth {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return authenticateKey(header.slice("Bearer ".length).trim());
  const session = findSession(req.cookies.get(SESSION_COOKIE));
  if (!session) throw new HttpError(401, "Log in first.");
  if (!SAFE_METHODS.has(req.method)) sameOrigin(req);
  return { via: "session", userId: session.userId, sessionId: session.id };
}

/** A stub until m1kuorg/basics#48 builds API keys: every key is refused. */
function authenticateKey(token: string): Auth {
  throw new HttpError(401, "That API key isn't valid.");
}

/**
 * A request that changes something on the page's behalf must come from the
 * app's own origin (PUBLIC_URL's, or else the one it was sent to), and send
 * JSON, which a form on another site can't. A DELETE may have no body.
 */
export function sameOrigin(req: Request): void {
  const origin = config.publicUrl?.origin ?? new URL(req.url).origin;
  if (req.headers.get("origin") !== origin) throw new HttpError(403, "This request didn't come from the Asked Before page.");
  const type = req.headers.get("content-type");
  const json = type !== null && /^application\/json\s*(;|$)/i.test(type);
  if (!json && !(req.method === "DELETE" && type === null)) throw new HttpError(403, "This request needs a JSON body.");
}

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: "lax", secure: config.https, path: "/", maxAge }) as const;

/** Starts a session for the account and sets its cookie on the answer. */
export function startSession(req: WithCookies, userId: string): void {
  req.cookies.set(SESSION_COOKIE, createSession(userId), cookieOptions(SESSION_DAYS * 24 * 60 * 60));
}

export function clearSessionCookie(req: WithCookies): void {
  req.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}
