// Builds the pages into dist/, the Worker's static assets (wrangler.jsonc),
// once before `wrangler dev` or a deploy: `bun run build:pages`. Bun's
// bundler bundles each HTML file under public/ with the React entry and the
// stylesheet it links, compiling Tailwind (scripts/tailwind-plugin.ts) and
// running the pages' macros (the landing's demo cards, the SDK's quickstart)
// as it goes. The pages share one chunk of React and the components
// (splitting), and React is its production build. The HTML lands at
// dist/<page>.html, which the static assets serve at /<page>, and the hashed
// assets it links under dist/assets/. The not-found page is dist/404.html,
// which the static assets answer for any path they don't hold. The fonts stay
// files at /fonts/, copied as they are: Bun would inline them as data: URIs,
// which the CSP's font-src 'self' blocks. Beside them, only the demo export
// is copied; the answer key and the known answers never are. The icons, the
// manifest, and the link-embed banners (scripts/build-icons.ts and
// scripts/build-og.ts draw them into public/) are copied as they are too, to
// the same paths. Each page's canonical link, og:url, og:image, and
// twitter:image are written root-relative in public/*.html and made
// absolute here, on PUBLIC_URL in wrangler.jsonc, the deployed app's
// address: a link preview needs the whole URL. So the pages carry the
// production address wherever they're served, the checks' localhost
// included. Then the files the static assets read: _redirects, which answers
// every path under /app with the app's page, and _headers, the security
// headers from server/security.ts; and robots.txt and sitemap.xml, for
// crawlers, on PUBLIC_URL too.

import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { SECURITY_HEADERS } from "../server/security";
import type { BunPlugin } from "bun";
import config from "../wrangler.jsonc";
import { tailwind } from "./tailwind-plugin";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
/** Where the pages go: dist/, or the folder given, as the checks give theirs. */
const DIST = process.argv[2] ?? join(ROOT, "dist");

/** The pages, by their file under public/; each is served at its name without .html, and index.html at /. */
const PAGES = ["index.html", "docs.html", "privacy.html", "login.html", "signup.html", "app.html"];
const NOT_FOUND_PAGE = "not-found.html";
/** The app's page, which needs a session: robots.txt keeps crawlers out of it, and the sitemap leaves it out. */
const APP_PAGE = "app.html";
/** The files beside the pages, served at /<name> as they are in public/. */
const ICONS = ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "site.webmanifest"];

/** The deployed app's address, which every absolute URL in the pages, the robots file, and the sitemap start with. */
const PUBLIC_URL = new URL(config.vars.PUBLIC_URL);
const absolute = (path: string) => new URL(path, PUBLIC_URL).href;
/** "/" for index.html, "/docs" for docs.html. */
const pathOf = (page: string) => (page === "index.html" ? "/" : `/${page.replace(/\.html$/, "")}`);

/**
 * The pages' <link rel="preload"> of a font names /fonts/ too: leave it as written, or Bun can't resolve it (`external`
 * covers only the stylesheet's url()). The icon and manifest <link>s likewise: Bun hands those over as a path on this
 * computer, so they're given back root-relative, as public/*.html writes them.
 */
const fontsAsTheyAre: BunPlugin = {
  name: "fonts-as-they-are",
  setup(build) {
    build.onResolve({ filter: /\/fonts\/[^/]+\.woff2$/ }, ({ path }) => ({ path, external: true }));
    const icons = new RegExp(`/(${ICONS.map((file) => file.replaceAll(".", "\\.")).join("|")})$`);
    build.onResolve({ filter: icons }, ({ path }) => ({ path: path.slice(path.lastIndexOf("/")), external: true }));
  },
};

/** A page's canonical link and its og:url, og:image, and twitter:image, made absolute on PUBLIC_URL. */
const onPublicUrl = new HTMLRewriter()
  .on('link[rel="canonical"]', {
    element: (link) => void link.setAttribute("href", absolute(link.getAttribute("href")!)),
  })
  .on('meta[property="og:url"], meta[property="og:image"], meta[name="twitter:image"]', {
    element: (meta) => void meta.setAttribute("content", absolute(meta.getAttribute("content")!)),
  });

const build = await Bun.build({
  entrypoints: [...PAGES, NOT_FOUND_PAGE].map((file) => join(PUBLIC, file)),
  root: PUBLIC,
  publicPath: "/assets/",
  plugins: [tailwind(ROOT), fontsAsTheyAre],
  // The stylesheet's url("/fonts/...") stays a link to the copied files.
  external: ["/fonts/*"],
  splitting: true,
  minify: true,
  // Without it Bun bundles React's development build.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!build.success) throw new AggregateError(build.logs, "The pages didn't build.");

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "assets"), { recursive: true });
for (const output of build.outputs) {
  const path = output.path.replace(/^\.\//, "");
  const target = path === NOT_FOUND_PAGE ? "404.html" : path.endsWith(".html") ? path : join("assets", path);
  await Bun.write(join(DIST, target), path.endsWith(".html") ? onPublicUrl.transform(await output.text()) : output);
}
await cp(join(PUBLIC, "fonts"), join(DIST, "fonts"), { recursive: true });
for (const file of ICONS) await cp(join(PUBLIC, file), join(DIST, file));
await cp(join(PUBLIC, "og"), join(DIST, "og"), { recursive: true });
// The landing's photograph, served at /images/ the way the fonts are, with its credit record.
await cp(join(PUBLIC, "images"), join(DIST, "images"), { recursive: true });
await mkdir(join(DIST, "demo"));
await cp(join(ROOT, "demo", "export.json"), join(DIST, "demo", "export.json"));

await Bun.write(join(DIST, "_redirects"), "/app/* /app 200\n");
const headers = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`);
await Bun.write(join(DIST, "_headers"), ["/*", ...headers, "/assets/*", "  cache-control: public, max-age=31536000, immutable", ""].join("\n"));
// "Disallow: /app" covers /app/... and would cover /apple-touch-icon.png, so the icon is let through by its longer rule.
await Bun.write(
  join(DIST, "robots.txt"),
  ["User-agent: *", "Disallow: /app", "Disallow: /api/", "Allow: /apple-touch-icon.png", "", `Sitemap: ${absolute("/sitemap.xml")}`, ""].join("\n"),
);
const listed = PAGES.filter((page) => page !== APP_PAGE).map((page) => `  <url><loc>${absolute(pathOf(page))}</loc></url>`);
await Bun.write(
  join(DIST, "sitemap.xml"),
  ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...listed, "</urlset>", ""].join("\n"),
);

console.log(`Built ${build.outputs.length} files into ${DIST}.`);
