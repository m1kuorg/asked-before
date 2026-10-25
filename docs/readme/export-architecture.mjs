// Exports the README architecture diagram in the Asked Before design system.
//
// Archify (https://github.com/tt-a1i/archify) renders docs/readme/architecture.json into a standalone
// HTML viewer. This script restyles that viewer with the docs/DESIGN.md colours and the bundled
// Schibsted Grotesk, then saves the viewer's own SVG export once per colour scheme.
//
// Re-run from the repository root, with archify 3.2.0 cloned to /tmp/archify
// (git clone --depth 1 --branch v3.2.0 https://github.com/tt-a1i/archify /tmp/archify):
//   node /tmp/archify/archify/bin/archify.mjs finalize architecture docs/readme/architecture.json /tmp/architecture.html --repo-root . --quality showcase --json
//   node docs/readme/export-architecture.mjs /tmp/architecture.html .
//
// Writes docs/readme/architecture-light.svg and architecture-dark.svg. Needs Playwright's bundled
// Chromium (bunx playwright install chromium).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const [input, repo] = process.argv.slice(2)
if (!input || !repo) throw new Error('usage: node export-architecture.mjs <archify.html> <repo root>')
const require = createRequire(path.join(path.resolve(repo), 'package.json'))
const { chromium } = require('playwright')
const font = fs.readFileSync(path.join(repo, 'public/fonts/SchibstedGrotesk-Variable.woff2')).toString('base64')

// docs/DESIGN.md: the landing's plum grounds for dark, the app's white ground for light.
// Pink marks Asked Before's own parts: it fills the clients, with plum-black ink on it as on the
// landing's pink buttons, and outlines the server. Cloudflare's services and the outside parts stay quiet.
const THEMES = {
  dark: {
    '--bg': '#0d060b', // plum-black
    '--mask': '#0d060b',
    '--grid': 'transparent',
    '--text': '#ffffff',
    '--text-muted': '#9a8f97', // muted-on-dark
    '--text-dim': '#9a8f97',
    '--text-faint': '#9a8f97',
    '--lane-stroke': '#470c35', // plum-field
    '--arrow': '#9a8f97',
    '--arrow-emphasis': '#ff488b', // pink
    '--ab-accent': '#ff488b',
    '--ab-server-fill': '#1b0e17', // plum-surface
    '--ab-service-fill': '#470c35', // plum-field carries white ink only
    '--ab-service-stroke': '#470c35',
    '--ab-outside-fill': '#1b0e17', // plum-surface
    '--ab-outside-stroke': '#9a8f97',
    '--ab-frame': '#9a8f97'
  },
  light: {
    '--bg': '#ffffff', // background
    '--mask': '#ffffff',
    '--grid': 'transparent',
    '--text': '#101421', // foreground
    '--text-muted': '#5d5562', // muted-foreground
    '--text-dim': '#5d5562',
    '--text-faint': '#5d5562',
    '--lane-stroke': '#ece4e9', // border
    '--arrow': '#5d5562',
    '--arrow-emphasis': '#c0185a', // ask-ink: pink as a line or text on white
    '--ab-accent': '#ff488b', // pink, on white only (the White Behind Pink Rule)
    '--ab-server-fill': '#ffffff',
    '--ab-service-fill': '#f7f2f5', // panel
    '--ab-service-stroke': '#d9cfd6', // edge
    '--ab-outside-fill': '#ffffff',
    '--ab-outside-stroke': '#d9cfd6',
    '--ab-frame': '#d9cfd6'
  }
}
const ON_ACCENT = '#0d060b' // plum-black: ink on pink
const decl = (vars) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
// Every selector starts with svg, :root, [data-theme or .c-, so the viewer copies it into its export.
// !important beats the node fills the viewer mixes from each kind's stroke colour.
const tokenCss = [
  `:root, [data-theme="dark"] { ${decl(THEMES.dark)} }`,
  `[data-theme="light"] { ${decl(THEMES.light)} }`,
  'svg .c-frontend { fill: var(--ab-accent) !important; stroke: var(--ab-accent) !important; }',
  'svg .c-backend { fill: var(--ab-server-fill) !important; stroke: var(--ab-accent) !important; stroke-width: 2px !important; }',
  'svg .c-cloud, svg .c-database { fill: var(--ab-service-fill) !important; stroke: var(--ab-service-stroke) !important; }',
  'svg .c-external { fill: var(--ab-outside-fill) !important; stroke: var(--ab-outside-stroke) !important; }',
  'svg [data-node-kind="frontend"] :is(.t-primary, .t-muted) { fill: ' + ON_ACCENT + '; }',
  'svg .s-frontend { color: ' + ON_ACCENT + '; }',
  'svg .s-backend { color: var(--ab-accent); }',
  'svg :is(.s-cloud, .s-database, .s-external) { color: var(--text-muted); }',
  'svg .c-region { fill: none !important; stroke: var(--ab-frame) !important; stroke-dasharray: 6 4 !important; }',
  'svg [data-graph-role="structural-frame-label-mask"] { fill: var(--bg) !important; stroke: var(--ab-frame) !important; }',
  'svg [data-boundary-label] { fill: var(--text-muted); }',
  // One step up from the viewer's sizes, which it measured for its mono: the sans is narrower, so it still fits.
  'svg text[font-size="8"] { font-size: 9px; } svg text[font-size="9"] { font-size: 10px; } svg text[font-size="11"] { font-size: 12.5px; }',
  "svg, svg text { font-family: 'Schibsted Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }"
].join('\n')
// Replaces the viewer's bundled JetBrains Mono: no text in the restyled diagram uses it.
const fontCss = `
@font-face { font-family: 'Schibsted Grotesk'; font-style: normal; font-weight: 400 900; font-display: block;
  src: url(data:font/woff2;base64,${font}) format('woff2'); }
`

let html = fs.readFileSync(input, 'utf8')
const fonts = /(<style id="archify-fonts">)[\s\S]*?(<\/style>)/
if (!fonts.test(html)) throw new Error('no #archify-fonts')
html = html.replace(fonts, (_, open, close) => open + fontCss + close)
html = html.replace('</head>', () => `<style id="asked-before-tokens">\n${tokenCss}\n</style>\n</head>`)
const styled = path.join(path.dirname(path.resolve(input)), 'styled.html')
fs.writeFileSync(styled, html)

const out = path.join(repo, 'docs/readme')
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`file://${styled}`)
  await page.evaluate(() => document.fonts.ready)
  for (const scheme of ['light', 'dark']) {
    // svg-light and svg-dark pin their theme: data-theme on the root and the resolved colours.
    await page.click('#btn-export')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`#export-menu [data-format="svg-${scheme}"]`)])
    const svg = fs.readFileSync(await dl.path(), 'utf8')
    if (!svg.includes('Schibsted Grotesk') || !svg.includes(`data-theme="${scheme}"`)) throw new Error(`unstyled ${scheme} export`)
    const file = path.join(out, `architecture-${scheme}.svg`)
    fs.writeFileSync(file, svg.replace(/[ \t]+$/gm, '').replace(/\n*$/, '\n'))
    console.log(`wrote ${path.relative(repo, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`)
  }
  await ctx.close()
} finally {
  await browser.close()
}
