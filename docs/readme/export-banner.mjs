// Renders the README banner from the landing page's opening chapter: "Asked
// before?" on the plum field, over the ASCII field that rebuilds the 1958
// exam-hall photograph from the demo's phrasings (src/pages/landing/
// chapters.tsx, HeroChapter). The fixed header is hidden, and reduced motion
// gives the field's one still frame. The viewport is 1600×800, so the
// chapter's lead fits beside the title at the banner's 2:1.
//
// Re-run from the repository root, after `bun install`, against the live app
// or a local `bun run dev`:
//   bun docs/readme/export-banner.mjs [https://asked-before.m1kuorg.workers.dev/]
//
// Writes docs/readme/banner.png, 2560×1280. Needs Playwright's bundled Chromium
// (bunx playwright install chromium). It stops if the page fails or the field never draws.
import { join } from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] ?? "https://asked-before.m1kuorg.workers.dev/";
const out = join(import.meta.dir, "banner.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1.6, reducedMotion: "reduce" });
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`${url} answered ${response?.status()}`);
  await page.evaluate(() => document.querySelectorAll("header").forEach((header) => (header.style.display = "none")));
  await page.evaluate(() => document.fonts.ready);
  // The field draws once its photograph has loaded and its chapter is measured: wait for ink on its canvas.
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("section canvas");
      if (!canvas?.width) return false;
      const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) return true;
      return false;
    },
    undefined,
    { timeout: 15000, polling: 250 },
  );
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
