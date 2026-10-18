// Account: update the name and email, and change the password
// (m1kuorg/basics#48). Both need a session: authed(..., { sessionOnly: true }).
// Changing the password needs the current one, and ends every other session.
// Downloading your data and deleting the account (m1kuorg/basics#49) come
// back on Workers with m1kuorg/basics#63.

import type { Account } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { hashPassword, verifyPassword } from "../passwords";
import { changePasswordHash, passwordHashOf, updateAccount } from "../store/users";
import { AccountName, Email, MAX_PASSWORD, NewPassword } from "./auth";

const Change = z
  .strictObject({ name: AccountName.optional(), email: Email.optional() })
  .refine((change) => change.name !== undefined || change.email !== undefined, "Send a new name or email.");

const PasswordChange = z.strictObject({
  currentPassword: z.string({ error: "Your current password is needed." }).max(MAX_PASSWORD, "That isn't your current password."),
  newPassword: NewPassword("A new password"),
});

const sessionOnly = { sessionOnly: true };
const NOT_CURRENT = "That isn't your current password.";

export const account = defineRoutes({
  "/api/v1/account": {
    PATCH: authed(async (req, { db, auth }) => {
      const change = await readJson(req, Change);
      const updated = await updateAccount(db, auth.userId, change);
      if (!updated) throw new HttpError(409, "That email already has an account.");
      return Response.json(updated satisfies Account);
    }, sessionOnly),
  },
  "/api/v1/account/password": {
    POST: authed(async (req, { db, auth }) => {
      const { currentPassword, newPassword } = await readJson(req, PasswordChange);
      const hash = await passwordHashOf(db, auth.userId);
      if (!hash || !verifyPassword(currentPassword, hash)) throw new HttpError(403, NOT_CURRENT);
      const changed = await changePasswordHash(db, auth.userId, { from: hash, to: hashPassword(newPassword), keepSessionId: auth.via === "session" ? auth.sessionId : null });
      if (!changed) throw new HttpError(403, NOT_CURRENT);
      return new Response(null, { status: 204 });
    }, sessionOnly),
  },
});
