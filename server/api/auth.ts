// Auth: sign up, log in, log out, and the current account
// (m1kuorg/basics#41). Signing up and logging in must come from the page's
// own origin, and are then throttled per IP address, so another site's
// forged request can't use up a visitor's tries. Both take the key the SDK
// derives from the password, never the password itself (ADR 0006), so the
// password's rules are the SDK's. A wrong email and a wrong password get
// the same answer, in about the same time, so neither says whether an
// account exists.

import type { Account, Session } from "@asked-before/sdk";
import { z } from "zod";
import { authed, clearSessionCookie, sameOrigin, startSession } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { hashKey, PasswordKey, verifyKey } from "../passwords";
import { deleteSession } from "../store/sessions";
import { throttle } from "../store/throttle";
import { createUser, findLogin, getAccount } from "../store/users";

/** The app's home, the Desk, where signing up or logging in goes when `next` is missing or outside the app. */
const APP_HOME = "/app/desk";

/** An email, trimmed and lowercased; changing it in settings checks it the same way. */
export const Email = z
  .string({ error: "An email is needed." })
  .trim()
  .toLowerCase()
  .max(254, "That email is too long.")
  .regex(/^[^\s@]+@[^\s@]+$/, "That doesn't look like an email address.");

export const AccountName = z.string({ error: "A name is needed." }).trim().min(1, "A name is needed.").max(100, "A name can have at most 100 characters.");

const SignUp = z.strictObject({
  name: AccountName,
  email: Email,
  passwordKey: PasswordKey("passwordKey"),
  next: z.string().optional(),
});

const LogIn = z.strictObject({
  email: z.string({ error: "An email is needed." }).trim().toLowerCase(),
  passwordKey: PasswordKey("passwordKey"),
  next: z.string().optional(),
});

const WRONG_LOGIN = "Wrong email or password.";

/** `next` when it's a path inside the app, or else the app's home. */
function appPath(next: string | undefined): string {
  if (next === undefined || !next.startsWith("/")) return APP_HOME;
  const base = "http://app.invalid";
  const url = URL.parse(next, base);
  const inside = url?.origin === base && url.pathname.startsWith("/app/");
  return inside ? url.pathname + url.search + url.hash : APP_HOME;
}

/** The caller's address, as Cloudflare saw it, for the throttle. */
const callerAddress = (req: Request) => req.headers.get("cf-connecting-ip") ?? "unknown";

export const auth = defineRoutes({
  "/api/v1/auth/signup": {
    async POST(req, ctx) {
      sameOrigin(req, ctx.config);
      await throttle(ctx.db, callerAddress(req));
      const { name, email, passwordKey, next } = await readJson(req, SignUp);
      const passwordHash = hashKey(passwordKey);
      const created = await createUser(ctx.db, { name, email, passwordHash });
      if (!created) throw new HttpError(409, "That email already has an account. Log in instead.");
      const session = await startSession(req, ctx, { userId: created.id, passwordHash });
      if (!session) throw new HttpError(401, "Log in first.");
      return Response.json({ account: session.account, next: appPath(next) } satisfies Session, {
        status: 201,
        headers: { "set-cookie": session.setCookie },
      });
    },
  },

  "/api/v1/auth/login": {
    async POST(req, ctx) {
      sameOrigin(req, ctx.config);
      await throttle(ctx.db, callerAddress(req));
      const { email, passwordKey, next } = await readJson(req, LogIn);
      const login = await findLogin(ctx.db, email);
      const matches = verifyKey(passwordKey, login?.passwordHash ?? null);
      const session = login && matches ? await startSession(req, ctx, { userId: login.id, passwordHash: login.passwordHash }) : null;
      if (!session) throw new HttpError(401, WRONG_LOGIN);
      return Response.json({ account: session.account, next: appPath(next) } satisfies Session, { headers: { "set-cookie": session.setCookie } });
    },
  },

  "/api/v1/auth/logout": {
    POST: authed(
      async (_req, { db, config, auth }) => {
        if (auth.via === "session") await deleteSession(db, auth.sessionId);
        return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(config) } });
      },
      { sessionOnly: true },
    ),
  },

  "/api/v1/auth/me": {
    GET: authed(async (_req, { db, auth }) => {
      const account = await getAccount(db, auth.userId);
      if (!account) throw new HttpError(401, "Log in first.");
      return Response.json(account satisfies Account);
    }),
  },
});
