// Serves the page, the demo exports, and the three model routes. The answer
// key and the known answers are never served. Logs carry only the method,
// path, status, and duration, never message text.

import { join } from "node:path";
import index from "./public/index.html";
import { ModelError } from "./server/model";
import { check } from "./server/routes/check";
import { group } from "./server/routes/group";
import { rep } from "./server/routes/rep";

type Handler = (request: Request) => Promise<Response>;

const demoFile = (name: string) => () => new Response(Bun.file(join(import.meta.dir, "demo", name)));

/** Logs the call, and answers a thrown ModelError with 502 and anything else with 500. */
const route =
  (handler: Handler): Handler =>
  async (request) => {
    const started = performance.now();
    const response = await handler(request).catch((error: unknown) =>
      error instanceof ModelError
        ? Response.json({ error: error.message }, { status: 502 })
        : Response.json({ error: "The server failed." }, { status: 500 }),
    );
    const ms = Math.round(performance.now() - started);
    console.log(`${request.method} ${new URL(request.url).pathname} ${response.status} ${ms}ms`);
    return response;
  };

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/": index,
    "/demo/export.json": demoFile("export.json"),
    "/demo/no-repeats.json": demoFile("no-repeats.json"),
    "/api/group": { POST: route(group) },
    "/api/rep": { POST: route(rep) },
    "/api/check": { POST: route(check) },
  },
  fetch: () => new Response("Not found", { status: 404 }),
  error: () => Response.json({ error: "The server failed." }, { status: 500 }),
});

console.log(`Asked Before is on ${server.url}`);
