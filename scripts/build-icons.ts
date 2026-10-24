// Draws the site's icons from the mark (src/components/mark.tsx: three pink
// asks on a track and the plum-black tick where it was proven), in the
// colours of the tokens in src/styles/globals.css, and writes them into
// public/, where scripts/build-pages.ts copies them from. Run by hand after
// the mark or a token changes, and commit what it writes:
//
//   public/favicon.svg           the mark redrawn on a 16px grid, transparent; a
//                                prefers-color-scheme: dark block lightens the
//                                track and turns the tick white on a dark tab bar
//   public/favicon.ico           that drawing, light, at 16, 32, and 48
//   public/apple-touch-icon.png  180, the mark on the plum field, square (iOS rounds it)
//   public/icon-192.png, icon-512.png
//                                the mark on a plum rounded square, for the manifest
//   public/icon-maskable-512.png the plum field to the edges, the mark inside the
//                                maskable safe zone (a circle 80% of the width across)
//   public/site.webmanifest      the app's name, /app, standalone, and the icons
//
// Each raster's provenance goes into public/provenance.json (scripts/lib/provenance.ts), beside the
// banners scripts/build-og.ts makes. Playwright's Chromium draws the PNGs;
// ImageMagick (`magick`) packs the .ico.
// Run: bun scripts/build-icons.ts

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { recordProvenance } from "./lib/provenance";
import { token } from "./lib/tokens";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
const MADE_BY = "scripts/build-icons.ts";

/** The colour tokens the icons use, from globals.css, so they can't drift from the page. */
const T = Object.fromEntries(["ask", "track", "primary", "background", "plum-field", "muted-on-dark"].map((name) => [name, token(name)]));

/**
 * The favicon: the mark on a 16px grid, so it holds at 16 and 32 device
 * pixels. The asks touch as they do in the mark, a pixel clear of the tick;
 * the track shows only around them, as in the mark.
 */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <style>
    .track { fill: ${T.track}; }
    .ask { fill: ${T.ask}; }
    .tick { fill: ${T.primary}; }
    @media (prefers-color-scheme: dark) {
      .track { fill: ${T["muted-on-dark"]}; }
      .tick { fill: ${T.background}; }
    }
  </style>
  <rect class="track" x="0" y="7" width="16" height="2" rx="1" />
  <circle class="ask" cx="2" cy="8" r="2" />
  <circle class="ask" cx="6" cy="8" r="2" />
  <circle class="ask" cx="10" cy="8" r="2" />
  <rect class="tick" x="13" y="1.5" width="2" height="13" rx="1" />
</svg>
`;

/**
 * The mark as mark.tsx draws it, on its 24-unit grid, for the larger icons:
 * on plum the tick is white, and the track the grey that sits on the plum grounds.
 */
const MARK = `<line x1="2" y1="12" x2="22" y2="12" stroke="${T["muted-on-dark"]}" stroke-width="2" stroke-linecap="round" />
  <circle cx="5.5" cy="12" r="2.5" fill="${T.ask}" />
  <circle cx="10.5" cy="12" r="2.5" fill="${T.ask}" />
  <circle cx="15.5" cy="12" r="2.5" fill="${T.ask}" />
  <line x1="20.5" y1="5.5" x2="20.5" y2="18.5" stroke="${T.background}" stroke-width="2" stroke-linecap="round" />`;
/** The mark's ink spans x 1 to 23 and y 4.5 to 19.5 of its grid: 22 units wide, centred on (12, 12). */
const MARK_WIDTH = 22;

/** The mark on a plum square `size` across, `width` of it wide, centred; `radius` rounds the square, leaving the corners clear. */
function onPlum(size: number, width: number, radius = 0): string {
  const scale = width / MARK_WIDTH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${T["plum-field"]}" />
  <g transform="translate(${size / 2 - 12 * scale} ${size / 2 - 12 * scale}) scale(${scale})">
  ${MARK}
  </g>
</svg>`;
}

/** The maskable icon's mark: its box's half-diagonal stays inside the safe zone's radius, 40% of the width. */
const MASKABLE_WIDTH = 300;
{
  const half = Math.hypot(MASKABLE_WIDTH / 2, ((MASKABLE_WIDTH / MARK_WIDTH) * 15) / 2);
  if (half > 0.4 * 512) throw new Error(`The maskable mark reaches ${half.toFixed(0)}px from the centre, past the safe zone's ${0.4 * 512}px.`);
}

const RASTERS: { file: string; size: number; svg: string; what: string }[] = [
  { file: "apple-touch-icon.png", size: 180, svg: onPlum(180, 112), what: "The mark on the plum field, square, for iOS to round." },
  { file: "icon-192.png", size: 192, svg: onPlum(192, 120, 42), what: "The mark on a plum rounded square, the manifest's 192px icon." },
  { file: "icon-512.png", size: 512, svg: onPlum(512, 320, 112), what: "The mark on a plum rounded square, the manifest's 512px icon." },
  { file: "icon-maskable-512.png", size: 512, svg: onPlum(512, MASKABLE_WIDTH), what: "The plum field to every edge, the mark inside the maskable safe zone." },
];
const ICO_SIZES = [16, 32, 48];

const MANIFEST = {
  name: "Asked Before",
  short_name: "Asked Before",
  description: "Turn a question you keep asking into one you can answer without AI.",
  start_url: "/app",
  display: "standalone",
  // The app's own ground and top bar are the page white.
  theme_color: T.background,
  background_color: T.background,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

const browser = await chromium.launch();
const scratch = await mkdtemp(join(tmpdir(), "asked-before-icons-"));
try {
  /** The SVG drawn at `size` pixels square, as a PNG with a clear background. */
  const draw = async (svg: string, size: number): Promise<Buffer> => {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1, colorScheme: "light" });
    const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    return png;
  };

  await Bun.write(join(PUBLIC, "favicon.svg"), FAVICON);

  const made: { file: string; width: number; height: number; what: string; from: string[] }[] = [];
  for (const { file, size, svg, what } of RASTERS) {
    await Bun.write(join(PUBLIC, file), await draw(svg, size));
    made.push({ file, width: size, height: size, what, from: ["src/components/mark.tsx", "src/styles/globals.css"] });
  }

  const layers = [];
  for (const size of ICO_SIZES) {
    const layer = join(scratch, `favicon-${size}.png`);
    await Bun.write(layer, await draw(FAVICON, size));
    layers.push(layer);
  }
  const pack = Bun.spawn(["magick", ...layers, join(PUBLIC, "favicon.ico")], { stderr: "pipe" });
  if ((await pack.exited) !== 0) throw new Error(`ImageMagick couldn't pack favicon.ico: ${await new Response(pack.stderr).text()}`);
  made.push({ file: "favicon.ico", width: 48, height: 48, what: `public/favicon.svg as it draws in a light tab, at ${ICO_SIZES.join(", ")}px, for browsers that ask for /favicon.ico.`, from: ["public/favicon.svg"] });

  await Bun.write(join(PUBLIC, "site.webmanifest"), `${JSON.stringify(MANIFEST, null, 2)}\n`);

  await recordProvenance(
    MADE_BY,
    await Promise.all(
      made.map(async ({ file, width, height, what, from }) => ({
        file: `public/${file}`,
        media: file.endsWith(".ico") ? "icon" : "image",
        width,
        height,
        ...(file.endsWith(".ico") ? { sizes: ICO_SIZES } : {}),
        what,
        from,
        madeBy: MADE_BY,
        bytes: Bun.file(join(PUBLIC, file)).size,
      })),
    ),
  );
  console.log(`Drew favicon.svg, ${made.map((m) => m.file).join(", ")}, and site.webmanifest into public/.`);
} finally {
  await browser.close();
  await rm(scratch, { recursive: true, force: true });
}
