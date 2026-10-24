// Draws the link-embed banners, 1200x630 PNGs in public/og/, that a page's
// og:image and twitter:image name (public/*.html), from one HTML template in
// the landing's language: the plum field, Schibsted Grotesk from
// public/fonts at the landing's display settings (800, -0.05em, leading
// 0.88), the wordmark at the top left, and at the foot the page's title,
// the real ask strip, and one line. Only the title and the line change from
// page to page. The strip is card A's nine asks, "Undo a git commit", from
// the demo shelf the landing shows (src/pages/demo-card.ts), pink dots on a
// track on an axis from the month of its first ask to the month after its
// last, across the text's width as the landing sets it. Everything sits
// inside the middle 80% of the banner, since X, iMessage, and Slack crop
// and cover its edges. Playwright's Chromium draws them. Run by hand after
// the template, a title, or the demo changes, look at each PNG at 1200 and
// at 600 wide, and commit them; their provenance goes into
// public/provenance.json (scripts/lib/provenance.ts).
// Run: bun scripts/build-og.ts

import { join } from "node:path";
import { chromium } from "playwright";
import { demoCards } from "../src/pages/demo-card";
import { recordProvenance } from "./lib/provenance";
import { token } from "./lib/tokens";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "public", "og");
const FONT = join(ROOT, "public", "fonts", "SchibstedGrotesk-Variable.woff2");
const MADE_BY = "scripts/build-og.ts";
const W = 1200;
const H = 630;

/** Each banner: its file, its title (a line break where the display line breaks), the one line under it, and the alt text the pages give it. */
export const BANNERS = [
  {
    file: "home.png",
    title: ["Asked", "before?"],
    line: "Turn a question you keep asking into one you can answer without AI.",
  },
  {
    file: "docs.png",
    title: ["Docs"],
    line: "How to reach your cards from your own scripts and agents: the API, the SDK, the MCP server, and the Claude Code plugin.",
  },
  {
    file: "privacy.png",
    title: ["Privacy"],
    line: "What happens to your words: what leaves your computer, what the model sees, what's kept, and how to delete it.",
  },
  {
    file: "app.png",
    title: ["Prove it", "without AI"],
    line: "Upload a chat export, see the how-to questions you keep asking, and pass a cold rep on each one.",
  },
];

/** What every banner shows, for its og:image:alt: the title, then the strip and the line. */
export const bannerAlt = (title: string[], line: string) =>
  `“${title.join(" ")}” in large white type on a plum field, under the name Asked Before, over a pink ask strip of nine dots on a track, then “${line}”`;

/** Card A's asks as x positions across the banner's safe width, on an axis from the month of the first to the month after the last. */
function strip(): number[] {
  const asks = demoCards()[0]!.borrows.map((ask) => Date.parse(ask.at));
  const first = new Date(asks[0]!);
  const last = new Date(asks.at(-1)!);
  const from = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  const to = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1);
  const left = W * 0.1;
  const width = W * 0.8;
  return asks.map((at) => left + ((at - from) / (to - from)) * width);
}

const DOT = 10;

function page(title: string[], line: string, font: string): string {
  const dots = strip()
    .map((x) => `<circle cx="${x.toFixed(1)}" cy="${DOT + 2}" r="${DOT}" />`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family: "Schibsted Grotesk"; src: url("data:font/woff2;base64,${font}") format("woff2"); font-weight: 400 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; }
  .card {
    width: ${W}px; height: ${H}px; padding: ${H * 0.1}px ${W * 0.1}px;
    display: flex; flex-direction: column; justify-content: space-between;
    background: ${token("plum-field")}; color: #ffffff;
    font-family: "Schibsted Grotesk"; letter-spacing: -0.01em;
  }
  .name { font-size: 30px; font-weight: 600; line-height: 1; }
  .foot { display: flex; flex-direction: column; }
  h1 { font-size: 150px; font-weight: 800; letter-spacing: -0.05em; line-height: 0.88; margin-left: -0.05em; }
  h1 span { display: block; }
  .strip { display: block; width: ${W * 0.8}px; height: ${DOT * 2 + 4}px; margin-top: 32px; overflow: visible; }
  .strip line { stroke: ${token("muted-on-dark")}; stroke-width: 3; stroke-linecap: round; }
  .strip circle { fill: ${token("ask")}; stroke: ${token("plum-field")}; stroke-width: 3; }
  .line { margin-top: 24px; font-size: 28px; line-height: 1.3; text-wrap: balance; }
</style>
</head>
<body>
<main class="card">
  <p class="name">Asked Before</p>
  <div class="foot">
    <h1>${title.map((part) => `<span>${part}</span>`).join("")}</h1>
    <svg class="strip" viewBox="${W * 0.1} 0 ${W * 0.8} ${DOT * 2 + 4}"><line x1="${W * 0.1}" x2="${W * 0.9}" y1="${DOT + 2}" y2="${DOT + 2}" />${dots}</svg>
    <p class="line">${line}</p>
  </div>
</main>
</body>
</html>`;
}

if (import.meta.main) {
  const font = Buffer.from(await Bun.file(FONT).arrayBuffer()).toString("base64");
  const browser = await chromium.launch();
  try {
    const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    for (const { file, title, line } of BANNERS) {
      await tab.setContent(page(title, line, font));
      await tab.evaluate(() => document.fonts.ready);
      const loaded = await tab.evaluate(() => document.fonts.check('800 150px "Schibsted Grotesk"'));
      if (!loaded) throw new Error(`Schibsted Grotesk didn't load for ${file}.`);
      // Nothing that has to read may leave the middle 80%.
      const outside = await tab.evaluate(
        ({ w, h }) =>
          [...document.querySelectorAll(".name, h1 span, .strip circle, .line")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < w * 0.1 - 12 || r.right > w * 0.9 + 1 || r.top < h * 0.1 - 1 || r.bottom > h * 0.9 + 1;
          }).map((el) => el.textContent),
        { w: W, h: H },
      );
      if (outside.length) throw new Error(`${file}: ${outside.join(", ")} leaves the middle 80%.`);
      await tab.screenshot({ path: join(OUT, file), clip: { x: 0, y: 0, width: W, height: H } });
    }
  } finally {
    await browser.close();
  }
  await recordProvenance(
    MADE_BY,
    BANNERS.map(({ file, title, line }) => ({
      file: `public/og/${file}`,
      media: "image" as const,
      width: W,
      height: H,
      what: bannerAlt(title, line),
      from: ["scripts/build-og.ts", "public/fonts/SchibstedGrotesk-Variable.woff2", "src/styles/globals.css", "demo/sorted.json"],
      madeBy: MADE_BY,
      bytes: Bun.file(join(OUT, file)).size,
    })),
  );
  console.log(`Drew ${BANNERS.map((b) => `og/${b.file}`).join(", ")} into public/.`);
}
