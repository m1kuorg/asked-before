// Account: update the name and email, change the password
// (m1kuorg/basics#48), export all data, and delete the account
// (m1kuorg/basics#49). All of them need a session: authed(..., { sessionOnly: true }).
// Changing the password needs the current one, and ends every other session.
// Stubs answer 501 until their ticket lands.

import type { Account } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, notBuilt, readJson } from "../http";
import { deleteOtherSessions } from "../store/sessions";
import { passwordHashOf, setPasswordHash, updateAccount } from "../store/users";
import { Email, Name } from "./auth";

const Change = z
  .strictObject({ name: Name.optional(), email: Email.optional() })
  .refine((change) => change.name !== undefined || change.email !== undefined, "Send a new name or email.");

const NewPassword = z.strictObject({
  currentPassword: z.string({ error: "Your current password is needed." }).max(200, "That isn't your current password."),
  newPassword: z
    .string({ error: "A new password is needed." })
    .min(10, "A new password needs at least 10 characters.")
    .max(200, "A new password can have at most 200 characters."),
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
    DELETE: notBuilt("m1kuorg/basics#49"),
  },
  "/api/v1/account/password": {
    POST: authed(async (req, auth) => {
      const { currentPassword, newPassword } = await readJson(req, NewPassword);
      const hash = passwordHashOf(auth.userId);
      if (!hash || !(await Bun.password.verify(currentPassword, hash))) throw new HttpError(403, "That isn't your current password.");
      setPasswordHash(auth.userId, await Bun.password.hash(newPassword));
      if (auth.via === "session") deleteOtherSessions(auth.userId, auth.sessionId);
      return new Response(null, { status: 204 });
    }, sessionOnly),
  },
  "/api/v1/account/export": { GET: notBuilt("m1kuorg/basics#49") },
});
