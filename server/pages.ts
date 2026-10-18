// The pages. Each HTML file in PAGES is bundled once at startup by Bun's
// bundler, with the scripts, styles, and fonts it links, and served from
// memory, so its answers carry the security headers like every other
// (Bun's own HTML routes can't take headers). The public pages are the
// landing page, the docs, log in, and sign up; the app is one page at /app
// that routes every path under it on the client (src/app/router.ts), and
// sends a logged-out visitor to log in and back. A path nothing routes gets
// the not-found page. The demo export is served as a file; the answer key
// and the known answers never are.

import { join } from "node:path";
import type { Handler, RouteTable } from "./http";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");

/** Each page's path, and its HTML file under public/. */
const PAGES: Record<string, string> = {
  "/": "index.html",
  "/docs": "docs.html",
  "/login": "login.html",
  "/signup": "signup.html",
  "/app": "app.html",
  "/app/*": "app.html",
};

/** The page for any path nothing else routes, answered with a 404. */
const NOT_FOUND_PAGE = "not-found.html";

const build = await Bun.build({
  entrypoints: [...new Set([...Object.values(PAGES), NOT_FOUND_PAGE])].map((file) => join(PUBLIC, file)),
  root: PUBLIC,
  publicPath: "/assets/",
});
if (!build.success) throw new AggregateError(build.logs, "The pages didn't build.");

/** Every built file by its path: the pages' HTML as under public/, and the hashed assets they link under /assets/. */
const built = new Map(build.outputs.map((output) => [output.path.replace(/^\.\//, ""), output]));

const page =
  (file: string): Handler =>
  () =>
    new Response(built.get(file), { headers: { "cache-control": "no-cache" } });

const asset: Handler = (req) => {
  const output = built.get(new URL(req.url).pathname.slice("/assets/".length));
  if (!output || output.path.endsWith(".html")) return notFound(req);
  return new Response(output, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
};

const demoExport: Handler = () => new Response(Bun.file(join(ROOT, "demo", "export.json")));

export const pageRoutes: RouteTable = {
  ...Object.fromEntries(Object.entries(PAGES).map(([path, file]) => [path, { GET: page(file) }])),
  "/assets/*": { GET: asset },
  "/demo/export.json": { GET: demoExport },
};

/** The answer for a path nothing else routes. */
export const notFound = (_req: Request) =>
  new Response(built.get(NOT_FOUND_PAGE), { status: 404, headers: { "cache-control": "no-cache" } });
