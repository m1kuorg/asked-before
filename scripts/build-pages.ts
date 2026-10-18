// Builds the pages into dist/, the Worker's static assets (wrangler.jsonc),
// once before `wrangler dev` or a deploy: `bun run build:pages`. Bun's
// bundler bundles each HTML file under public/ with the scripts, styles, and
// fonts it links, running the pages' macros (the landing card, the SDK's
// quickstart) as it goes. The HTML lands at dist/<page>.html, which the
// static assets serve at /<page>, and the hashed assets it links under
// dist/assets/. The not-found page is dist/404.html, which the static assets
// answer for any path they don't hold. Beside them, only the demo export is
// copied; the answer key and the known answers never are. Then two files the
// static assets read: _redirects, which answers every path under /app with
// the app's page, and _headers, the security headers from server/security.ts.

import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { SECURITY_HEADERS } from "../server/security";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
/** Where the pages go: dist/, or the folder given, as the checks give theirs. */
const DIST = process.argv[2] ?? join(ROOT, "dist");

/** The pages, by their file under public/; each is served at its name without .html, and index.html at /. */
const PAGES = ["index.html", "docs.html", "login.html", "signup.html", "app.html"];
const NOT_FOUND_PAGE = "not-found.html";

const build = await Bun.build({
  entrypoints: [...PAGES, NOT_FOUND_PAGE].map((file) => join(PUBLIC, file)),
  root: PUBLIC,
  publicPath: "/assets/",
});
if (!build.success) throw new AggregateError(build.logs, "The pages didn't build.");

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "assets"), { recursive: true });
for (const output of build.outputs) {
  const path = output.path.replace(/^\.\//, "");
  const target = path === NOT_FOUND_PAGE ? "404.html" : path.endsWith(".html") ? path : join("assets", path);
  await Bun.write(join(DIST, target), output);
}
await mkdir(join(DIST, "demo"));
await cp(join(ROOT, "demo", "export.json"), join(DIST, "demo", "export.json"));

await Bun.write(join(DIST, "_redirects"), "/app/* /app 200\n");
const headers = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`);
await Bun.write(join(DIST, "_headers"), ["/*", ...headers, "/assets/*", "  cache-control: public, max-age=31536000, immutable", ""].join("\n"));

console.log(`Built ${build.outputs.length} files into ${DIST}.`);
