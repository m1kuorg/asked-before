// API keys: list, create (the key is shown once), and revoke
// (m1kuorg/basics#48). All of them need a session, so a key can't make or
// revoke keys, and the shared guest has none (m1kuorg/basics#73):
// authed(..., { sessionOnly: true, notGuest: true }). Another account's key is a 404.

import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { createKey, listKeys, revokeKey } from "../store/keys";

const NewKey = z.strictObject({
  name: z
    .string({ error: "A key needs a name." })
    .trim()
    .min(1, "A key needs a name.")
    .max(60, "A key's name can have at most 60 characters."),
});

const ownAccountOnly = { sessionOnly: true, notGuest: true };

export const keys = defineRoutes({
  "/api/v1/keys": {
    GET: authed(async (_req, { db, auth }) => Response.json({ keys: await listKeys(db, auth.userId) }), ownAccountOnly),
    POST: authed(async (req, { db, auth }) => {
      const { name } = await readJson(req, NewKey);
      return Response.json(await createKey(db, auth.userId, name), { status: 201 });
    }, ownAccountOnly),
  },
  "/api/v1/keys/:keyId": {
    DELETE: authed(async (_req, { db, params, auth }) => {
      if (!(await revokeKey(db, auth.userId, params.keyId))) throw new HttpError(404, "There's no such API key.");
      return new Response(null, { status: 204 });
    }, ownAccountOnly),
  },
});
