// Account: update the name and email, change the password
// (m1kuorg/basics#48), download all your data, and delete the account
// (m1kuorg/basics#49). All of them need a session: authed(..., { sessionOnly: true }).
// Changing the password needs the current one, and ends every other session.
// The download is the account and everything in it, as the API shows it.
// Deleting the account needs its password, deletes everything in it, and
// ends every session, this one included.

import type { Account, AccountData } from "@asked-before/sdk";
import { z } from "zod";
import { authed, clearSessionCookie } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { accountData } from "../store/account-data";
import { deleteOtherSessions } from "../store/sessions";
import { deleteUser, passwordHashOf, setPasswordHash, updateAccount } from "../store/users";
import { AccountName, Email, MAX_PASSWORD, NewPassword } from "./auth";

const Change = z
  .strictObject({ name: AccountName.optional(), email: Email.optional() })
  .refine((change) => change.name !== undefined || change.email !== undefined, "Send a new name or email.");

const PasswordChange = z.strictObject({
  currentPassword: z.string({ error: "Your current password is needed." }).max(MAX_PASSWORD, "That isn't your current password."),
  newPassword: NewPassword("A new password"),
});

const Deletion = z.strictObject({
  password: z.string({ error: "Your password is needed." }).min(1, "Your password is needed.").max(MAX_PASSWORD, "That isn't your password."),
});

const sessionOnly = { sessionOnly: true };

export const account = defineRoutes({
  "/api/v1/account": {
    PATCH: authed(async (req, auth) => {
      const change = await readJson(req, Change);
      const updated = updateAccount(auth.userId, change);
      if (!updated) throw new HttpError(409, "That email already has an account.");
      return Response.json(updated satisfies Account);
    }, sessionOnly),
    DELETE: authed(async (req, auth) => {
      const { password } = await readJson(req, Deletion);
      const hash = passwordHashOf(auth.userId);
      if (!hash || !(await Bun.password.verify(password, hash))) throw new HttpError(403, "That isn't your password.");
      deleteUser(auth.userId);
      clearSessionCookie(req);
      return new Response(null, { status: 204 });
    }, sessionOnly),
  },
  "/api/v1/account/password": {
    POST: authed(async (req, auth) => {
      const { currentPassword, newPassword } = await readJson(req, PasswordChange);
      const hash = passwordHashOf(auth.userId);
      if (!hash || !(await Bun.password.verify(currentPassword, hash))) throw new HttpError(403, "That isn't your current password.");
      setPasswordHash(auth.userId, await Bun.password.hash(newPassword));
      if (auth.via === "session") deleteOtherSessions(auth.userId, auth.sessionId);
      return new Response(null, { status: 204 });
    }, sessionOnly),
  },
  "/api/v1/account/export": {
    GET: authed((_req, auth) => {
      const data = accountData(auth.userId);
      if (!data) throw new HttpError(401, "Log in first.");
      return Response.json(data satisfies AccountData);
    }, sessionOnly),
  },
});
