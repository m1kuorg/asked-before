// The pages. Each HTML file in PAGES is bundled once at startup by Bun's
// bundler, with the scripts, styles, and fonts it links, and served from
// memory, so its answers carry the security headers like every other
// (Bun's own HTML routes can't take headers). The demo exports are served
// as files; the answer key and the known answers never are.

import { join } from "node:path";
import type { Handler, RouteTable } from "./http";

const ROOT = join(import.meta.dir, "..");

/** Each page's path, and its HTML file. */
const PAGES: Record<string, string> = {
  "/": "public/index.html",
};

const build = await Bun.build({ entrypoints: Object.values(PAGES).map((file) => join(ROOT, file)), publicPath: "/assets/" });
if (!build.success) throw new AggregateError(build.logs, "The pages didn't build.");

/** Every built file by name: the pages' HTML, and the hashed assets they link under /assets/. */
const built = new Map(build.outputs.map((output) => [output.path.replace(/^\.\//, ""), output]));

const page =
  (file: string): Handler =>
  () =>
    new Response(built.get(file.split("/").pop()!), { headers: { "cache-control": "no-cache" } });

const asset: Handler = (req) => {
  const output = built.get(new URL(req.url).pathname.slice("/assets/".length));
  if (!output || output.path.endsWith(".html")) return notFound(req);
  return new Response(output, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
};

const demoFile = (name: string) => () => new Response(Bun.file(join(ROOT, "demo", name)));

export const pageRoutes: RouteTable = {
  ...Object.fromEntries(Object.entries(PAGES).map(([path, file]) => [path, { GET: page(file) }])),
  "/assets/*": { GET: asset },
  "/demo/export.json": { GET: demoFile("export.json") },
  "/demo/no-repeats.json": { GET: demoFile("no-repeats.json") },
};

/** The answer for a path nothing else routes. */
export const notFound = (_req: Request) => new Response("Not found", { status: 404 });
