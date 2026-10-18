// API keys: list, create (the key is shown once), and revoke
// (m1kuorg/basics#48). All of them need a session, so a key can't make or
// revoke keys: authed(..., { sessionOnly: true }). Another account's key is a 404.

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

const sessionOnly = { sessionOnly: true };

export const keys = defineRoutes({
  "/api/v1/keys": {
    GET: authed((_req, auth) => Response.json({ keys: listKeys(auth.userId) }), sessionOnly),
    POST: authed(async (req, auth) => {
      const { name } = await readJson(req, NewKey);
      return Response.json(createKey(auth.userId, name), { status: 201 });
    }, sessionOnly),
  },
  "/api/v1/keys/:keyId": {
    DELETE: authed((req, auth) => {
      if (!revokeKey(auth.userId, req.params.keyId)) throw new HttpError(404, "There's no such API key.");
      return new Response(null, { status: 204 });
    }, sessionOnly),
  },
});
