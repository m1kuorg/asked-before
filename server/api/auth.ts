// Auth: sign up, log in, log out, and the current account
// (m1kuorg/basics#41). Signing up and logging in must come from the page's
// own origin, and are then throttled per IP address, so another site's
// forged request can't use up a visitor's tries. A wrong email and a
// wrong password get the same answer, in about the same time, so neither
// says whether an account exists.

import type { Account, Session } from "@asked-before/sdk";
import { z } from "zod";
import { authed, clearSessionCookie, sameOrigin, startSession } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { deleteSession } from "../store/sessions";
import { createUser, findLogin, getAccount } from "../store/users";
import { throttle } from "../throttle";

/** The app's home, where signing up or logging in goes when `next` is missing or outside the app. */
const APP_HOME = "/app";

const Email = z
  .string({ error: "An email is needed." })
  .trim()
  .toLowerCase()
  .max(254, "That email is too long.")
  .regex(/^[^\s@]+@[^\s@]+$/, "That doesn't look like an email address.");

const SignUp = z.strictObject({
  name: z.string({ error: "A name is needed." }).trim().min(1, "A name is needed.").max(100, "A name can have at most 100 characters."),
  email: Email,
  password: z
    .string({ error: "A password is needed." })
    .min(10, "A password needs at least 10 characters.")
    .max(200, "A password can have at most 200 characters."),
  next: z.string().optional(),
});

const LogIn = z.strictObject({
  email: z.string({ error: "An email is needed." }).trim().toLowerCase(),
  password: z.string({ error: "A password is needed." }).max(200, "A password can have at most 200 characters."),
  next: z.string().optional(),
});

const WRONG_LOGIN = "Wrong email or password.";

/** Verified when the email has no account, so that logging in takes as long either way. */
const NO_ACCOUNT_HASH = await Bun.password.hash("no account has this password");

/** `next` when it's a path inside the app, or else the app's home. */
function appPath(next: string | undefined): string {
  if (next === undefined || !next.startsWith("/")) return APP_HOME;
  const base = "http://app.invalid";
  const url = URL.parse(next, base);
  const inside = url?.origin === base && (url.pathname === APP_HOME || url.pathname.startsWith(`${APP_HOME}/`));
  return inside ? url.pathname + url.search + url.hash : APP_HOME;
}

export const auth = defineRoutes({
  "/api/v1/auth/signup": {
    async POST(req, server) {
      sameOrigin(req);
      throttle(server.requestIP(req)?.address ?? "unknown");
      const { name, email, password, next } = await readJson(req, SignUp);
      const account = createUser({ name, email, passwordHash: await Bun.password.hash(password) });
      if (!account) throw new HttpError(409, "That email already has an account. Log in instead.");
      startSession(req, account.id);
      return Response.json({ account, next: appPath(next) } satisfies Session, { status: 201 });
    },
  },

  "/api/v1/auth/login": {
    async POST(req, server) {
      sameOrigin(req);
      throttle(server.requestIP(req)?.address ?? "unknown");
      const { email, password, next } = await readJson(req, LogIn);
      const login = findLogin(email);
      const matches = await Bun.password.verify(password, login?.passwordHash ?? NO_ACCOUNT_HASH);
      const account = login && matches ? getAccount(login.id) : null;
      if (!account) throw new HttpError(401, WRONG_LOGIN);
      startSession(req, account.id);
      return Response.json({ account, next: appPath(next) } satisfies Session);
    },
  },

  "/api/v1/auth/logout": {
    POST: authed(
      (req, auth) => {
        if (auth.via === "session") deleteSession(auth.sessionId);
        clearSessionCookie(req);
        return new Response(null, { status: 204 });
      },
      { sessionOnly: true },
    ),
  },

  "/api/v1/auth/me": {
    GET: authed((_req, auth) => {
      const account = getAccount(auth.userId);
      if (!account) throw new HttpError(401, "Log in first.");
      return Response.json(account satisfies Account);
    }),
  },
});
