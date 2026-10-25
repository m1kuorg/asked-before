// Renders the README banner, 1280×640, once per colour scheme, from banner.json:
// the favicon's mark (public/favicon.svg) and the name, a track of pink asks
// as the rule, the description, and a screenshot in a frame. The colours are
// docs/DESIGN.md's: white and ink for light, plum-black for dark.
//
// Re-run from the repository root, after `bun install`:
//   bun docs/readme/export-banner.mjs
//
// Writes docs/readme/banner-light.png and banner-dark.png with Playwright's Chromium.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const dir = join(import.meta.dir);
const config = JSON.parse(readFileSync(join(dir, "banner.json"), "utf8"));
const b64 = (file) => readFileSync(join(dir, file)).toString("base64");
const font = b64(config.font);
const screenshot = b64(config.screenshot);
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// public/favicon.svg's geometry: a track, three asks, and the tick that ends it.
const mark = (t) => `
  <svg viewBox="0 0 16 16" width="64" height="64" aria-hidden="true">
    <rect fill="${t.track}" x="0" y="7" width="16" height="2" rx="1" />
    <circle fill="${config.accent}" cx="2" cy="8" r="2" />
    <circle fill="${config.accent}" cx="6" cy="8" r="2" />
    <circle fill="${config.accent}" cx="10" cy="8" r="2" />
    <rect fill="${t.tick}" x="13" y="1.5" width="2" height="13" rx="1" />
  </svg>`;

// Nine asks along a track, as the og banners draw them, the way a card counts "asked 9 times".
const track = (t) => {
  const xs = [0, 46, 78, 126, 168, 196, 240, 286, 344];
  const dots = xs.map((x) => `<circle fill="${config.accent}" cx="${x + 6}" cy="6" r="6" />`).join("");
  return `<svg viewBox="0 0 360 12" width="360" height="12" aria-hidden="true">
    <rect fill="${t.track}" x="0" y="5" width="360" height="2" rx="1" />${dots}</svg>`;
};

const page = (t) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Schibsted Grotesk"; font-weight: 400 900; src: url(data:font/woff2;base64,${font}) format("woff2"); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 640px; overflow: hidden; background: ${t.ground}; color: ${t.ink};
    font-family: "Schibsted Grotesk", sans-serif; display: flex; align-items: center; padding: 0 0 0 72px; gap: 56px; }
  .text { width: 480px; flex: none; display: flex; flex-direction: column; gap: 28px; }
  .name { display: flex; align-items: center; gap: 20px; font-size: 60px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; }
  .desc { font-size: 24px; line-height: 1.4; letter-spacing: -0.01em; color: ${t.muted}; }
  .frame { flex: none; width: 600px; padding: 14px; background: ${t.frame}; border: 1px solid ${t.edge}; border-radius: 16px; }
  .frame img { display: block; width: 100%; border-radius: 6px; border: 1px solid ${t.edge}; }
</style></head><body>
  <div class="text">
    <div class="name">${mark(t)}${escape(config.name)}</div>
    ${track(t)}
    <p class="desc">${escape(config.description)}</p>
  </div>
  <div class="frame"><img src="data:image/png;base64,${screenshot}" alt=""></div>
</body></html>`;

const browser = await chromium.launch();
try {
  for (const [scheme, theme] of Object.entries(config.themes)) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 640 } });
    await tab.setContent(page(theme), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: join(dir, `banner-${scheme}.png`) });
    await tab.close();
    console.log(`wrote docs/readme/banner-${scheme}.png`);
  }
} finally {
  await browser.close();
}
