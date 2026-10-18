// Shelves: list, create, get, rename, and delete (m1kuorg/basics#41).
// Another account's shelf is a 404. Renaming or deleting one needs a
// session: an API key only reads shelves and makes them.

import type { Shelf } from "@asked-before/sdk";
import { z } from "zod";
import { authed } from "../auth";
import { defineRoutes, HttpError, readJson } from "../http";
import { createShelf, deleteShelf, getShelf, listShelves, renameShelf } from "../store/shelves";

const ShelfName = z
  .string({ error: "A shelf needs a name." })
  .trim()
  .min(1, "A shelf needs a name.")
  .max(80, "A shelf's name can have at most 80 characters.");

const NewShelf = z.strictObject({ name: ShelfName, demo: z.boolean({ error: "demo is true or false." }).optional() });
const Rename = z.strictObject({ name: ShelfName });

const found = (shelf: Shelf | null): Shelf => {
  if (!shelf) throw new HttpError(404, "There's no such shelf.");
  return shelf;
};

export const shelves = defineRoutes({
  "/api/v1/shelves": {
    GET: authed((_req, auth) => Response.json({ shelves: listShelves(auth.userId) })),
    POST: authed(async (req, auth) => {
      const { name, demo = false } = await readJson(req, NewShelf);
      return Response.json(createShelf(auth.userId, name, demo), { status: 201 });
    }),
  },

  "/api/v1/shelves/:shelfId": {
    GET: authed((req, auth) => Response.json(found(getShelf(auth.userId, req.params.shelfId)))),
    PATCH: authed(
      async (req, auth) => {
        const { name } = await readJson(req, Rename);
        return Response.json(found(renameShelf(auth.userId, req.params.shelfId, name)));
      },
      { sessionOnly: true },
    ),
    DELETE: authed(
      (req, auth) => {
        if (!deleteShelf(auth.userId, req.params.shelfId)) throw new HttpError(404, "There's no such shelf.");
        return new Response(null, { status: 204 });
      },
      { sessionOnly: true },
    ),
  },
});
