// Auth: sign up, log in, log out, and the current account
// (m1kuorg/basics#41). Signing up and logging in must come from the page's
// own origin, and are then throttled per network (an IPv4 address, or an
// IPv6 /64), so another site's forged request can't use up a visitor's
// tries; and one network makes at most NETWORK_DAILY_SIGNUPS accounts a UTC
// day, so fresh accounts can't spend the app's daily caps
// (m1kuorg/basics#69). Both take the key the SDK derives from the password,
// never the password itself (ADR 0006), so the password's rules are the
// SDK's. A wrong email and a wrong password get the same answer, in about
// the same time, so neither says whether an account exists.

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

/**
 * The caller's network, as Cloudflare saw it, for the throttle: an IPv4
 * address as it is, written in IPv6 too ("::ffff:192.0.2.1"), and an IPv6
 * one as its /64, written as "2001:db8:1:2::/64", since one connection is
 * usually given a whole /64 and could take a fresh address from it for
 * every try.
 */
function callerNetwork(req: Request): string {
  const address = req.headers.get("cf-connecting-ip") ?? "unknown";
  const ipv4 = address.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  if (ipv4) return ipv4;
  if (!address.includes(":")) return address;
  const [head, tail, extra] = address.toLowerCase().split("::");
  // An IPv4 address written at the end fills the last two groups.
  const groups = (part: string | undefined) => (part ? part.split(":").flatMap((group) => (group.includes(".") ? ["0", "0"] : [group])) : []);
  const left = groups(head);
  const right = groups(tail);
  const all = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  const prefix = all.slice(0, 4).map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : NaN));
  if (extra !== undefined || all.length !== 8 || prefix.some(Number.isNaN)) return address;
  return `${prefix.map((group) => group.toString(16)).join(":")}::/64`;
}

export const auth = defineRoutes({
  "/api/v1/auth/signup": {
    async POST(req, ctx) {
      sameOrigin(req, ctx.config);
      const network = callerNetwork(req);
      await throttle(ctx.db, network);
      const { name, email, passwordKey, next } = await readJson(req, SignUp);
      const passwordHash = hashKey(passwordKey);
      const cap = ctx.config.dailySignups;
      const created = await createUser(ctx.db, { name, email, passwordHash }, { network, cap });
      if (created === "taken") throw new HttpError(409, "That email already has an account. Log in instead.");
      if (created === "capped") {
        throw new HttpError(429, `Asked Before makes at most ${cap} ${cap === 1 ? "account" : "accounts"} a day from one internet connection, and this one has made today's. More open at midnight UTC.`);
      }
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
      await throttle(ctx.db, callerNetwork(req));
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
