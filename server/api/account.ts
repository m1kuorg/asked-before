// Account: update the name and email, change the password
// (m1kuorg/basics#48), download all your data, and delete the account
// (m1kuorg/basics#49). All of them need a session, and none is the shared
// guest's (m1kuorg/basics#73): authed(..., { sessionOnly: true, notGuest: true }).
// Each takes the keys the SDK derives from a password, never the password
// (ADR 0006). The email salts the key, so a new email needs the key the
// current one salts, and the key the new one does, and ends every other
// session, as changing the password does, which needs the current one's
// key. Checking a key is throttled per account (store/throttle.ts).
// The download is the account and everything in it, as the API shows it,
// read in one batch (store/account-data.ts) and written out a piece at a
// time. Deleting the account needs its password's key, deletes everything
// in it, and ends every session, this one included.

import type { Account, AccountData } from "@asked-before/sdk";
import { z } from "zod";
import { authed, clearSessionCookie } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { hashKey, PasswordKey, verifyKey } from "../passwords";
import { accountData } from "../store/account-data";
import { throttle } from "../store/throttle";
import { changeEmail, changePasswordHash, deleteUser, passwordHashOf, renameAccount } from "../store/users";
import { AccountName, Email } from "./auth";

const Change = z
  .strictObject({
    name: AccountName.optional(),
    email: Email.optional(),
    currentPasswordKey: PasswordKey("currentPasswordKey").optional(),
    newPasswordKey: PasswordKey("newPasswordKey").optional(),
  })
  .refine((change) => change.name !== undefined || change.email !== undefined, "Send a new name or email.")
  .refine((change) => change.email === undefined || (change.currentPasswordKey !== undefined && change.newPasswordKey !== undefined), "Changing the email needs your password.");

const PasswordChange = z.strictObject({
  currentPasswordKey: PasswordKey("currentPasswordKey"),
  newPasswordKey: PasswordKey("newPasswordKey"),
});

const Deletion = z.strictObject({ passwordKey: PasswordKey("passwordKey") });

const ownAccountOnly = { sessionOnly: true, notGuest: true };

/** The throttle's caller for checking an account's password key (store/throttle.ts): the account, whichever address it's from. */
const keyChecks = (userId: string) => `account:${userId}`;
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
      const { name, email, currentPasswordKey, newPasswordKey } = await readJson(req, Change);
      if (email === undefined) {
        const renamed = await renameAccount(db, auth.userId, name!);
        if (!renamed) throw new HttpError(401, "Log in first.");
        return Response.json(renamed satisfies Account);
      }
      await throttle(db, keyChecks(auth.userId));
      const hash = await passwordHashOf(db, auth.userId);
      if (!hash || !verifyKey(currentPasswordKey!, hash)) throw new HttpError(403, NOT_YOURS);
      // Moved only while the hash is the one just checked, so a password changed meanwhile moves nothing.
      const moved = await changeEmail(db, auth.userId, { name, email, from: hash, to: hashKey(newPasswordKey!), keepSessionId: auth.via === "session" ? auth.sessionId : null });
      if (moved === "taken") throw new HttpError(409, "That email already has an account.");
      if (moved === "changed") throw new HttpError(403, NOT_YOURS);
      return Response.json(moved satisfies Account);
    }, ownAccountOnly),
    DELETE: authed(async (req, { db, auth, config }) => {
      const { passwordKey } = await readJson(req, Deletion);
      await throttle(db, keyChecks(auth.userId));
      const hash = await passwordHashOf(db, auth.userId);
      if (!hash || !verifyKey(passwordKey, hash)) throw new HttpError(403, NOT_YOURS);
      // Deleted only while the hash is the one just checked, so a password changed meanwhile deletes nothing.
      if (!(await deleteUser(db, auth.userId, hash))) throw new HttpError(403, NOT_YOURS);
      return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(config) } });
    }, ownAccountOnly),
  },
  "/api/v1/account/password": {
    POST: authed(async (req, { db, auth }) => {
      const { currentPasswordKey, newPasswordKey } = await readJson(req, PasswordChange);
      await throttle(db, keyChecks(auth.userId));
      const hash = await passwordHashOf(db, auth.userId);
      if (!hash || !verifyKey(currentPasswordKey, hash)) throw new HttpError(403, NOT_CURRENT);
      const changed = await changePasswordHash(db, auth.userId, { from: hash, to: hashKey(newPasswordKey), keepSessionId: auth.via === "session" ? auth.sessionId : null });
      if (!changed) throw new HttpError(403, NOT_CURRENT);
      return new Response(null, { status: 204 });
    }, ownAccountOnly),
  },
  "/api/v1/account/export": {
    GET: authed(async (_req, { db, auth }) => {
      const data = await accountData(db, auth.userId);
      if (!data) throw new HttpError(401, "Log in first.");
      return streamJson(data);
    }, ownAccountOnly),
  },
});
