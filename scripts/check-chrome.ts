// Checks the web chrome and the privacy page end to end, on a fresh copy of
// the app: every page's head names its description, canonical link, Open
// Graph and Twitter card, theme colour, colour scheme, icons, and manifest,
// each URL on the production address in wrangler.jsonc (scripts/build-pages.ts
// writes it, whatever address serves the page), with noindex on the app
// and the not-found page only; every icon, banner, the manifest, robots.txt,
// and sitemap.xml answers 200 with its content type; each PNG is the size
// its head, the manifest, and public/provenance.json say; the manifest's
// icons exist; robots.txt keeps crawlers out of /app and /api/ only, and
// the sitemap lists the public pages, each of which answers; the SVG
// favicon turns light on a dark tab; each page says it needs JavaScript
// without it; /privacy draws one h1 and its ten sections, with the model,
// the content security policy, the cookie, and the landing's table as the
// code holds them, and its rail, "In short", right of the sections, each
// fact linking to one; the landing's footer, the docs' index, and the
// sign-up page link to it, and the docs have no rail; and no page logs a
// console error or a policy violation. No model request is made. It exits 1 if any check fails,
// naming the step.
// Run: bun run check:chrome [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { SESSION_DAYS } from "../server/store/sessions";
import { MODEL } from "../server/model";
import { CONTENT_SECURITY_POLICY } from "../server/security";
import config from "../wrangler.jsonc";
import { BANNERS, bannerAlt } from "./build-og";
import { startApp } from "./lib/app";
import type { Provenance } from "./lib/provenance";
import { token } from "./lib/tokens";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-chrome");
const ROOT = join(import.meta.dir, "..");
const PUBLIC_URL = config.vars.PUBLIC_URL;
const production = (path: string) => new URL(path, PUBLIC_URL).href;

const failures: string[] = [];
let current = "";
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

/** Each page, by where it's served: its canonical path (none for the not-found page, which answers any path), its banner, and its theme colour. */
const PAGES = [
  { what: "the landing page", path: "/", canonical: "/", banner: "home.png", theme: token("plum-field"), noindex: false, status: 200 },
  { what: "the docs", path: "/docs", canonical: "/docs", banner: "docs.png", theme: token("background"), noindex: false, status: 200 },
  { what: "the privacy page", path: "/privacy", canonical: "/privacy", banner: "privacy.png", theme: token("background"), noindex: false, status: 200 },
  { what: "log in", path: "/login", canonical: "/login", banner: "app.png", theme: token("plum-field"), noindex: false, status: 200 },
  { what: "sign up", path: "/signup", canonical: "/signup", banner: "app.png", theme: token("plum-field"), noindex: false, status: 200 },
  { what: "the app", path: "/app", canonical: "/app", banner: "app.png", theme: token("background"), noindex: true, status: 200 },
  { what: "a page that isn't there", path: "/no-such-page", canonical: null, banner: "home.png", theme: token("plum-field"), noindex: true, status: 404 },
];

const ICONS: { path: string; type: RegExp; size?: number }[] = [
  { path: "/favicon.svg", type: /^image\/svg\+xml/ },
  { path: "/favicon.ico", type: /^image\/(x-icon|vnd\.microsoft\.icon)$/ },
  { path: "/apple-touch-icon.png", type: /^image\/png$/, size: 180 },
  { path: "/icon-192.png", type: /^image\/png$/, size: 192 },
  { path: "/icon-512.png", type: /^image\/png$/, size: 512 },
  { path: "/icon-maskable-512.png", type: /^image\/png$/, size: 512 },
  { path: "/site.webmanifest", type: /^application\/manifest\+json/ },
  { path: "/robots.txt", type: /^text\/plain/ },
  { path: "/sitemap.xml", type: /^(application|text)\/xml/ },
  ...BANNERS.map(({ file }) => ({ path: `/og/${file}`, type: /^image\/png$/ })),
];

/** The privacy page's sections, as the brief names them. */
const PRIVACY_SECTIONS = ["What leaves your computer", "What the model sees", "What's stored", "The one cookie", "No analytics", "The logs", "The guest workspace", "API keys", "Your data", "Backups"];
const NEEDS_JS = "Asked Before needs JavaScript to show this page.";

/** A PNG's width and height, from its header; null when it isn't a PNG. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, i) => bytes[i] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** An .ico's layers, as their widths and heights; null when it isn't an icon file. */
function icoSizes(bytes: Uint8Array): string[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) return null;
  return Array.from({ length: view.getUint16(4, true) }, (_, i) => `${bytes[6 + i * 16] || 256}x${bytes[7 + i * 16] || 256}`);
}

/** A page's head as served: its title, its meta tags by name or property, its links, and what its noscript says. */
function readHead(html: string) {
  let title = "";
  const meta = new Map<string, string>();
  const links: { rel: string; href: string; type: string | null; sizes: string | null }[] = [];
  new HTMLRewriter()
    .on("head > title", { text: (chunk) => void (title += chunk.text) })
    .on("meta", {
      element: (tag) => {
        const key = tag.getAttribute("property") ?? tag.getAttribute("name");
        if (key) meta.set(key, tag.getAttribute("content") ?? "");
      },
    })
    .on("link", {
      element: (tag) => void links.push({ rel: tag.getAttribute("rel") ?? "", href: tag.getAttribute("href") ?? "", type: tag.getAttribute("type"), sizes: tag.getAttribute("sizes") }),
    })
    .transform(html);
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? null;
  return { title, meta, links, noscript };
}

/** Whether robots.txt lets a crawler fetch `path`: the longest matching rule wins, and Allow wins a tie (RFC 9309). */
function allowed(robots: string, path: string): boolean {
  const rules = robots
    .split("\n")
    .map((line) => line.match(/^(Allow|Disallow):\s*(\S*)/i))
    .filter((m): m is RegExpMatchArray => m !== null && m[2] !== "")
    .map((m) => ({ allow: m[1]!.toLowerCase() === "allow", prefix: m[2]! }))
    .filter((rule) => path.startsWith(rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

await mkdir(OUT, { recursive: true });
const app = await startApp();
const browser = await chromium.launch();
const fetched = new Map<string, Uint8Array>();
const get = async (path: string) => {
  const response = await fetch(new URL(path, app.url));
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { response, bytes, text: new TextDecoder().decode(bytes) };
};

try {
  await step("1. Every page's head carries the chrome, on the production address", async () => {
    check(PUBLIC_URL.startsWith("https://") && !app.url.startsWith(PUBLIC_URL), `the pages are served at ${app.url}, and must name ${PUBLIC_URL}`);
    for (const page of PAGES) {
      const { response, text } = await get(page.path);
      const { title, meta, links, noscript } = readHead(text);
      const say = `${page.what} (${page.path})`;
      const banner = BANNERS.find((b) => b.file === page.banner)!;
      const image = production(`/og/${page.banner}`);
      const link = (rel: string) => links.filter((l) => l.rel === rel);
      const wrong: string[] = [];
      const want = (ok: boolean, what: string) => ok || wrong.push(what);
      want(response.status === page.status, `status ${response.status}`);
      want(title.length > 0, "a title");
      want((meta.get("description") ?? "").length > 40, "a description");
      if (page.canonical) {
        want(link("canonical")[0]?.href === production(page.canonical) && link("canonical").length === 1, `canonical ${link("canonical")[0]?.href}`);
        want(meta.get("og:url") === production(page.canonical), `og:url ${meta.get("og:url")}`);
      } else {
        want(link("canonical").length === 0 && !meta.has("og:url"), "no canonical or og:url of its own");
      }
      want(meta.get("og:type") === "website", "og:type");
      want(meta.get("og:site_name") === "Asked Before", "og:site_name");
      want(meta.get("og:title") === title && meta.get("twitter:title") === title, "og:title and twitter:title as the title");
      want(meta.get("og:description") === meta.get("description") && meta.get("twitter:description") === meta.get("description"), "og:description and twitter:description as the description");
      want(meta.get("og:image") === image && meta.get("twitter:image") === image, `og:image and twitter:image ${meta.get("og:image")}`);
      want(meta.get("og:image:type") === "image/png" && meta.get("og:image:width") === "1200" && meta.get("og:image:height") === "630", "og:image's type, width, and height");
      const alt = bannerAlt(banner.title, banner.line);
      want(meta.get("og:image:alt") === alt && meta.get("twitter:image:alt") === alt, "og:image:alt and twitter:image:alt saying what the banner shows");
      want(meta.get("twitter:card") === "summary_large_image", "twitter:card");
      want(meta.get("theme-color") === page.theme, `theme-color ${meta.get("theme-color")}, not ${page.theme}`);
      want(meta.get("color-scheme") === "light", "color-scheme");
      want((meta.get("robots") === "noindex") === page.noindex, page.noindex ? "noindex" : "no noindex");
      want(link("icon").some((l) => l.href === "/favicon.ico" && l.sizes === "32x32"), "the .ico icon link");
      want(link("icon").some((l) => l.href === "/favicon.svg" && l.type === "image/svg+xml"), "the SVG icon link");
      want(link("apple-touch-icon")[0]?.href === "/apple-touch-icon.png", "the apple-touch-icon link");
      want(link("manifest")[0]?.href === "/site.webmanifest", "the manifest link");
      want(noscript?.includes(NEEDS_JS) === true && !/<a\b/.test(noscript ?? ""), "a <noscript> line that needs JavaScript, linking nothing");
      want(/<div id="app"><\/div>/.test(text), 'the literal empty <div id="app">');
      check(wrong.length === 0, `${say}: ${wrong.length ? `missing or wrong: ${wrong.join("; ")}` : "every tag, on the production address"}`);
    }
  });

  await step("2. Every icon, banner, the manifest, robots.txt, and sitemap.xml answers with its type", async () => {
    for (const { path, type, size } of ICONS) {
      const { response, bytes } = await get(path);
      fetched.set(path, bytes);
      const got = response.headers.get("content-type") ?? "";
      const png = path.endsWith(".png") ? pngSize(bytes) : null;
      const sized = size === undefined || (png?.width === size && png.height === size);
      check(response.status === 200 && type.test(got) && sized, `${path}: ${response.status} ${got}${png ? `, ${png.width}x${png.height}` : ""}`);
    }
    for (const { file } of BANNERS) {
      const png = pngSize(fetched.get(`/og/${file}`)!);
      check(png?.width === 1200 && png.height === 630, `/og/${file} is the 1200x630 its pages' heads say: ${png?.width}x${png?.height}`);
    }
    const ico = icoSizes(fetched.get("/favicon.ico")!);
    check(ico?.join(", ") === "16x16, 32x32, 48x48", `/favicon.ico holds 16, 32, and 48: ${ico?.join(", ")}`);
    for (const path of ["/provenance.json", "/og/provenance.json"]) check((await get(path)).response.status === 404, `${path} isn't served`);
  });

  await step("3. Each drawn raster's provenance is recorded, and matches the file served", async () => {
    const records = (await Bun.file(join(ROOT, "public", "provenance.json")).json()) as Provenance[];
    for (const [path, bytes] of fetched) {
      if (!/\.(png|ico)$/.test(path)) continue;
      const record = records.find((r) => r.file === `public${path}`);
      const png = pngSize(bytes);
      const matches = record && record.bytes === bytes.length && (!png || (record.width === png.width && record.height === png.height)) && record.from.length > 0 && record.madeBy.startsWith("scripts/");
      check(Boolean(matches), `${path}: ${record ? `${record.width}x${record.height}, ${record.bytes} bytes, by ${record.madeBy}` : "no record"}`);
    }
  });

  await step("4. The manifest parses, names the app, and its icons exist at their sizes", async () => {
    const manifest = JSON.parse(new TextDecoder().decode(fetched.get("/site.webmanifest")!)) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      theme_color?: string;
      background_color?: string;
      icons?: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    check(manifest.name === "Asked Before" && manifest.short_name === "Asked Before", `name and short_name: ${manifest.name}, ${manifest.short_name}`);
    check(manifest.start_url === "/app" && manifest.display === "standalone", `start_url ${manifest.start_url}, display ${manifest.display}`);
    check(manifest.theme_color === token("background") && manifest.background_color === token("background"), `theme and background colours from the tokens: ${manifest.theme_color}, ${manifest.background_color}`);
    for (const icon of manifest.icons ?? []) {
      const { response, bytes } = await get(icon.src);
      const png = pngSize(bytes);
      check(response.status === 200 && `${png?.width}x${png?.height}` === icon.sizes && icon.type === "image/png", `${icon.src} (${icon.purpose ?? "any"}): ${response.status}, ${png?.width}x${png?.height}`);
    }
    check((manifest.icons ?? []).some((icon) => icon.purpose === "maskable") && (manifest.icons ?? []).some((icon) => icon.sizes === "192x192"), "it has a 192px icon and a maskable one");
  });

  await step("5. robots.txt keeps crawlers out of /app and /api/ only, and the sitemap lists the public pages", async () => {
    const robots = new TextDecoder().decode(fetched.get("/robots.txt")!);
    for (const [path, ok] of [
      ["/", true],
      ["/docs", true],
      ["/privacy", true],
      ["/login", true],
      ["/signup", true],
      ["/og/home.png", true],
      ["/apple-touch-icon.png", true],
      ["/app", false],
      ["/app/desk", false],
      ["/api/v1/health", false],
    ] as const) {
      check(allowed(robots, path) === ok, `${path} is ${ok ? "allowed" : "disallowed"}`);
    }
    check(robots.includes(`Sitemap: ${production("/sitemap.xml")}`), `it points at ${production("/sitemap.xml")}`);
    const sitemap = new TextDecoder().decode(fetched.get("/sitemap.xml")!);
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    const want = ["/", "/docs", "/privacy", "/login", "/signup"].map(production);
    check(sitemap.startsWith("<?xml") && JSON.stringify(locs) === JSON.stringify(want), `the sitemap lists ${locs.join(", ")}`);
    for (const loc of locs) {
      const { pathname } = new URL(loc);
      check((await fetch(new URL(pathname, app.url))).status === 200, `${pathname} answers 200`);
    }
  });

  await step("6. The SVG favicon, as served, turns light on a dark tab", async () => {
    const shots: Buffer[] = [];
    for (const colorScheme of ["light", "dark"] as const) {
      const tab = await browser.newPage({ viewport: { width: 64, height: 64 }, colorScheme });
      await tab.setContent(`<body style="margin:0;background:#202124"><img src="${app.url}/favicon.svg" width="64" height="64"></body>`);
      await tab.locator("img").evaluate((img: HTMLImageElement) => img.decode());
      shots.push(await tab.screenshot());
      await tab.close();
    }
    const svg = new TextDecoder().decode(fetched.get("/favicon.svg")!);
    check(svg.includes("@media (prefers-color-scheme: dark)"), "it carries a prefers-color-scheme: dark block");
    check(!shots[0]!.equals(shots[1]!), "and it draws differently in a dark scheme, under the page's security policy");
  });

  await step("7. Without JavaScript, each page says it needs it; /docs needs it too, so the line links nothing", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const tab = await context.newPage();
    for (const { path } of PAGES) {
      await tab.goto(new URL(path, app.url).href);
      check(await tab.getByText(NEEDS_JS, { exact: true }).isVisible(), `${path} shows "${NEEDS_JS}"`);
    }
    await tab.goto(`${app.url}/docs`);
    check((await tab.getByRole("heading", { level: 1 }).count()) === 0, "/docs draws nothing to read without it");
    await context.close();
  });

  const consoleErrors: string[] = [];
  const missing = PAGES.find((page) => page.status === 404)!.path;
  const watch = (page: Page) => {
    page.on("console", (message) => {
      // The not-found page's own 404, which Chromium reports for the document itself, is the page working.
      const itsOwn404 = new URL(message.location().url || page.url()).pathname === missing && /status of 404/.test(message.text());
      if (message.type() === "error" && !itsOwn404) consoleErrors.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`${page.url()}: ${error.message}`));
  };

  await step("8. /privacy draws one h1 and its ten sections, from the code's own facts", async () => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    watch(page);
    await page.goto(`${app.url}/privacy`);
    const main = page.getByRole("main");
    await main.getByRole("heading", { level: 1 }).waitFor();
    const h1s = await page.getByRole("heading", { level: 1 }).allTextContents();
    check(h1s.length === 1 && h1s[0] === "Privacy", `one h1: ${h1s.join(", ")}`);
    const regions: Record<string, string> = {};
    for (const title of PRIVACY_SECTIONS) {
      const region = main.getByRole("region", { name: title, exact: true });
      regions[title] = (await region.count()) === 1 ? ((await region.textContent()) ?? "") : "";
      check(regions[title]!.length > 100, `the section "${title}"`);
    }
    const index = page.getByRole("navigation", { name: "Contents" });
    const anchors = await index.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    check(anchors.filter((href) => href?.startsWith("#")).length === PRIVACY_SECTIONS.length && anchors.includes("/docs"), `the index links each section, then the docs: ${anchors.join(" ")}`);
    check(regions["What the model sees"]!.includes(MODEL), `it names the model server/model.ts asks, ${MODEL}`);
    const rail = main.getByRole("complementary", { name: "In short" });
    const facts = await rail.getByRole("link").evaluateAll((links) => links.map((a) => ({ href: a.getAttribute("href") ?? "", to: document.getElementById(a.getAttribute("href")?.slice(1) ?? "")?.tagName })));
    check(facts.length >= 5 && facts.every(({ to }) => to === "SECTION"), `"In short" links each fact to its section: ${facts.map(({ href }) => href).join(" ")}`);
    const [railBox, sectionBox] = [await rail.boundingBox(), await main.getByRole("region", { name: PRIVACY_SECTIONS[0], exact: true }).boundingBox()];
    check(Boolean(railBox && sectionBox && railBox.x >= sectionBox.x + sectionBox.width), "and sits right of the sections at 1440px");
    const csp = ((await main.locator(".privacy-csp code").textContent()) ?? "").replace(/;\n/g, "; ");
    check(csp === CONTENT_SECURITY_POLICY, "it shows the content security policy server/security.ts sends");
    const auth = await Bun.file(join(ROOT, "server", "auth.ts")).text();
    const [, https, plain] = auth.match(/config\.https \? "([^"]+)" : "([^"]+)"/) ?? [];
    check(Boolean(https && plain) && regions["The one cookie"]!.includes(https!) && regions["The one cookie"]!.includes(plain!), `it names the cookie as server/auth.ts does: ${https}, or ${plain} without https`);
    check(regions["The one cookie"]!.includes(`${SESSION_DAYS} days`), `and its ${SESSION_DAYS} days`);
    const http = await Bun.file(join(ROOT, "server", "http.ts")).text();
    const logged = [...http.matchAll(/console\.(log|info|warn|error)\(([^;]+)\);/g)].map((m) => m[2]!);
    const shown = (await main.locator(".privacy-log code").textContent()) ?? "";
    check(
      logged.length === 1 && /^`\$\{req\.method\} \$\{pathname\} \$\{response\.status\} \$\{[^}]+\}ms`$/.test(logged[0]!) && shown === "<method> <path> <status> <duration>ms",
      `its log line, "${shown}", is the one line server/http.ts logs`,
    );
    const rows = async (cells: string) =>
      page.locator(cells).evaluateAll((trs) => trs.map((tr) => [...tr.children].map((cell) => (cell.textContent ?? "").replace(/^(Leaves your computer|The model sees it): /, "").trim()).join(" | ")));
    const privacyRows = await rows(".privacy-leaves tbody tr");
    await page.screenshot({ path: join(OUT, "privacy.png") });
    await page.screenshot({ path: join(OUT, "privacy-full.png"), fullPage: true });
    await page.goto(app.url);
    const landingRows = await rows("section[aria-labelledby='proof-title'] tbody tr");
    check(privacyRows.length === 7 && JSON.stringify(privacyRows) === JSON.stringify(landingRows), `its table is the landing's, row for row (${privacyRows.length} rows)`);
  });

  await step("9. The landing's footer, the docs' index, and the sign-up page link to /privacy", async () => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    watch(page);
    const hrefs = async (where: ReturnType<Page["getByRole"]>) => where.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    await page.goto(app.url);
    check((await hrefs(page.getByRole("contentinfo"))).includes("/privacy"), "the landing's footer");
    await page.goto(`${app.url}/docs`);
    await page.getByRole("navigation", { name: "Contents" }).waitFor();
    check((await hrefs(page.getByRole("navigation", { name: "Contents" }))).includes("/privacy"), "the docs' index");
    check((await page.getByRole("complementary").count()) === 0, "and the docs have no rail");
    await page.goto(`${app.url}/signup`);
    await page.getByRole("main").getByRole("button", { name: "Sign up", exact: true }).waitFor();
    const fine = page.getByRole("main").getByRole("link", { name: "Privacy", exact: true });
    check((await fine.getAttribute("href")) === "/privacy", "the sign-up page's fine print");
  });

  await step("10. No page logs a console error or a policy violation", async () => {
    const guest = app.browser();
    await guest.client.auth.signInAsGuest();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const [name, value] = guest.cookie().split("=") as [string, string];
    await context.addCookies([{ name, value, url: app.url }]);
    const page = await context.newPage();
    watch(page);
    for (const { path } of PAGES) {
      await page.goto(new URL(path, app.url).href, { waitUntil: "networkidle" });
      await page.screenshot({ path: join(OUT, `${path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "landing"}.png`) });
    }
    check(consoleErrors.length === 0, `none on ${PAGES.length} pages${consoleErrors.length ? `: ${consoleErrors.slice(0, 4).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
