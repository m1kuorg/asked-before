// Account: update the name and email, change the password
// (m1kuorg/basics#48), download all your data, and delete the account
// (m1kuorg/basics#49). All of them need a session: authed(..., { sessionOnly: true }).
// Changing the password needs the current one, and ends every other session.
// The download is the account and everything in it, as the API shows it,
// read in one batch (store/account-data.ts) and written out a piece at a
// time. Deleting the account needs its password, deletes everything in it,
// and ends every session, this one included.

import type { Account, AccountData } from "@asked-before/sdk";
import { z } from "zod";
import { authed, clearSessionCookie } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { hashPassword, verifyPassword } from "../passwords";
import { accountData } from "../store/account-data";
import { changePasswordHash, deleteUser, passwordHashOf, updateAccount } from "../store/users";
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
const NOT_CURRENT = "That isn't your current password.";
const NOT_YOURS = "That isn't your password.";

/** How much of the download's text is encoded and sent at once. */
const PIECE_CHARACTERS = 64 * 1024;

/**
 * The download's JSON in pieces: the account, then each shelf's uploads and
 * cards with its other fields, and each of its phrasings on its own. Joined,
 * they're the same JSON value as the whole.
 */
function* jsonPieces({ shelves, ...head }: AccountData): Generator<string> {
  yield `${JSON.stringify(head).slice(0, -1)},"shelves":[`;
  for (const [i, { phrasings, ...shelf }] of shelves.entries()) {
    yield `${i ? "," : ""}${JSON.stringify(shelf).slice(0, -1)},"phrasings":[`;
    for (const [j, phrasing] of phrasings.entries()) yield `${j ? "," : ""}${JSON.stringify(phrasing)}`;
    yield "]}";
  }
  yield "]}";
}

/**
 * The download as a JSON answer, encoded about 64 KB at a time as it's sent,
 * so the isolate's 128 MB never holds the whole text, or its bytes, beside
 * the rows it's made from.
 */
function streamJson(data: AccountData): Response {
  const pieces = jsonPieces(data);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      let text = "";
      let next = pieces.next();
      while (!next.done) {
        text += next.value;
        if (text.length >= PIECE_CHARACTERS) break;
        next = pieces.next();
      }
      if (text) controller.enqueue(encoder.encode(text));
      if (next.done) controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/json" } });
}

export const account = defineRoutes({
  "/api/v1/account": {
    PATCH: authed(async (req, { db, auth }) => {
      const change = await readJson(req, Change);
      const updated = await updateAccount(db, auth.userId, change);
      if (!updated) throw new HttpError(409, "That email already has an account.");
      return Response.json(updated satisfies Account);
    }, sessionOnly),
    DELETE: authed(async (req, { db, auth, config }) => {
      const { password } = await readJson(req, Deletion);
      const hash = await passwordHashOf(db, auth.userId);
      if (!hash || !verifyPassword(password, hash)) throw new HttpError(403, NOT_YOURS);
      // Deleted only while the hash is the one just checked, so a password changed meanwhile deletes nothing.
      if (!(await deleteUser(db, auth.userId, hash))) throw new HttpError(403, NOT_YOURS);
      return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(config) } });
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
  "/api/v1/account/export": {
    GET: authed(async (_req, { db, auth }) => {
      const data = await accountData(db, auth.userId);
      if (!data) throw new HttpError(401, "Log in first.");
      return streamJson(data);
    }, sessionOnly),
  },
});
