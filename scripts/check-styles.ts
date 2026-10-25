// Checks every page's quality on a fresh copy of the app, in a real browser,
// at 1440×900 and 390×844. It seeds a learner (signed up, with a shelf, the
// demo export uploaded and sorted onto it, and one cold rep passed) and the
// shared guest, then visits every public page (the landing page, log in,
// sign up, the docs, privacy, and a 404) logged out, as the learner, and as
// the guest, and every app screen as the learner and as the guest: Home,
// Shelves, a shelf's three views, the upload page, a card, Connect your AI,
// the Playground, Settings' three areas, and the in-app not-found screen.
// Each page is scrolled through, so every entrance has run, and saved as a
// full-page screenshot; then it must have no sideways scroll, exactly one
// h1, Schibsted Grotesk loaded, no text under 12px, every visible text's
// colour at 4.5:1 or more against its effective background (3:1 for large
// text: 24px and up, or 18.66px and up when bold), and no console errors,
// failed requests, or CSP violations.
// The app's model is a stand-in that sorts as the demo export's answer key
// does, and answers the one cold rep and its check as queued, so no model
// key is needed. It exits 1 naming each failure.
// Run: bun run check:styles [screenshot dir]

import type { Client } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { keySorter, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";
import { known, repReply, verdictReply } from "./lib/reps";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-styles");
const LEARNER = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const FONT = "Schibsted Grotesk";

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();
const failures: string[] = [];

/** The paths a visitor, the learner, and the guest each open: app screens first, so the public pages see the signed-in hint they set. */
type Visit = { name: string; path: string };
const PUBLIC: Visit[] = [
  { name: "landing", path: "/" },
  { name: "log-in", path: "/login" },
  { name: "sign-up", path: "/signup" },
  { name: "docs", path: "/docs" },
  { name: "privacy", path: "/privacy" },
  { name: "not-found", path: "/no-such-page" },
];
const NOT_FOUND_PATH = "/no-such-page";

/** A workspace's app screens, from its first shelf and that shelf's first card. */
async function screensOf(client: Client): Promise<Visit[]> {
  const [shelf] = await client.shelves.list();
  if (!shelf) throw new Error("the workspace has no shelf");
  const [card] = await client.cards.list(shelf.id);
  if (!card) throw new Error(`${shelf.name} has no card`);
  const shelfPath = `/app/shelves/${encodeURIComponent(shelf.id)}`;
  return [
    { name: "home", path: "/app/desk" },
    { name: "search", path: "/app/search?q=git" },
    { name: "analysis", path: "/app/analysis" },
    { name: "roadmap", path: "/app/roadmap" },
    { name: "shelves", path: "/app/shelves" },
    { name: "shelf-cards", path: shelfPath },
    { name: "shelf-not-on-a-card", path: `${shelfPath}?view=once` },
    { name: "shelf-uploads", path: `${shelfPath}?view=uploads` },
    { name: "upload", path: `${shelfPath}/upload` },
    { name: "card", path: `/app/cards/${encodeURIComponent(card.id)}` },
    { name: "connect", path: "/app/connect" },
    { name: "playground", path: "/app/playground" },
    { name: "settings", path: "/app/settings" },
    { name: "settings-keys", path: "/app/settings/keys" },
    { name: "settings-data", path: "/app/settings/data" },
    { name: "app-not-found", path: "/app/no-such-screen" },
  ];
}

// What the page measures, in the page. Self-contained, since Playwright sends the function's source.

type Measured = {
  /** How many pieces of text it read, the smallest size among them, and the contrast nearest its floor. */
  texts: number;
  smallest: number;
  closest: string;
  h1s: number;
  overflow: number;
  font: { checked: boolean; loaded: boolean };
  small: string[];
  contrast: string[];
};

function measure(font: string): Measured {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const paint = canvas.getContext("2d", { willReadFrequently: true })!;
  type RGBA = [number, number, number, number];
  const parsed = new Map<string, RGBA>();
  /** Any CSS colour as sRGB 0 to 255 and alpha 0 to 1: rgb() read as is, anything else (oklch, color-mix) drawn and read back. */
  const rgba = (css: string): RGBA => {
    const hit = parsed.get(css);
    if (hit) return hit;
    let color: RGBA;
    const plain = css.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
    if (plain) color = [Number(plain[1]), Number(plain[2]), Number(plain[3]), plain[4] === undefined ? 1 : Number(plain[4])];
    else {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = "rgba(0, 0, 0, 0)";
      paint.fillStyle = css;
      paint.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
      color = [r!, g!, b!, a! / 255];
    }
    parsed.set(css, color);
    return color;
  };
  const over = (top: RGBA, under: RGBA): RGBA => [0, 1, 2].map((i) => top[i]! * top[3] + under[i]! * (1 - top[3])).concat(1) as RGBA;
  const luminance = ([r, g, b]: RGBA) => {
    const [R, G, B] = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R! + 0.7152 * G! + 0.0722 * B!;
  };
  const ratio = (a: RGBA, b: RGBA) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const hex = (c: RGBA) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const describe = (el: Element) => {
    const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => c && !c.includes("[")).slice(0, 3) : [];
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${classes.map((c) => `.${c}`).join("")}`;
  };

  /** Drawn for assistive technology only (sr-only and the like): clipped to nothing, so never seen. */
  const clippedAway = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.clipPath === "inset(50%)" || cs.clip === "rect(0px, 0px, 0px, 0px)") return true;
      const box = e.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1 && cs.overflow !== "visible") return true;
    }
    return false;
  };

  /**
   * The colour under `el`'s text: up its ancestors to the first opaque background, translucent ones laid over it.
   * An ancestor taken out of the flow (absolute or fixed) may sit over something that isn't its parent, so from
   * there it reads what's painted beneath the text at its centre instead. Null when a background image is in the way.
   */
  const backdrop = (el: Element, at: () => { x: number; y: number }): { color: RGBA; fade: number } | null => {
    const layers: RGBA[] = [];
    let fade = 1;
    const walked = new Set<Element>();
    const take = (e: Element) => {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return "image";
      const bg = rgba(cs.backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      return bg[3] >= 1 ? "opaque" : "clear";
    };
    let e: Element | null = el;
    for (; e; e = e.parentElement) {
      walked.add(e);
      const taken = take(e);
      if (taken === "image") return null;
      if (taken === "opaque") break;
      if (layers.length === 0) fade *= Number(getComputedStyle(e).opacity);
      const { position } = getComputedStyle(e);
      if (position === "absolute" || position === "fixed") {
        const { x, y } = at();
        const stack = document.elementsFromPoint(x, y);
        const from = stack.findIndex((under) => walked.has(under));
        let found = false;
        for (const under of stack.slice(Math.max(from, 0))) {
          if (walked.has(under)) continue;
          const beneath = take(under);
          if (beneath === "image") return null;
          if (beneath === "opaque") {
            found = true;
            break;
          }
        }
        if (!found) layers.push([255, 255, 255, 1]);
        break;
      }
    }
    if (!e) layers.push([255, 255, 255, 1]);
    let color = layers.at(-1)!;
    for (const layer of layers.slice(0, -1).reverse()) color = over(layer, color);
    return { color, fade };
  };

  const small = new Map<string, number>();
  const contrast = new Map<string, number>();
  let texts = 0;
  let smallest = Infinity;
  let closest = { margin: Infinity, line: "none measured" };
  const note = (map: Map<string, number>, line: string) => map.set(line, (map.get(line) ?? 0) + 1);

  /** Checks one piece of text drawn in `el` with `colorCss`, whose box's centre is where `at` says. */
  const audit = (el: Element, colorCss: string, at: () => { x: number; y: number }, sample: string) => {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight);
    const where = `${describe(el)} "${sample.slice(0, 24)}"`;
    texts++;
    smallest = Math.min(smallest, size);
    if (size < 11.995) note(small, `${where} at ${size}px`);
    // An inactive control is exempt from contrast (WCAG 1.4.3), and is drawn faded on purpose.
    if (el.closest(":disabled, [aria-disabled=true]")) return;
    const under = backdrop(el, at);
    if (!under) {
      note(contrast, `${where}: on a background image, so its contrast can't be read`);
      return;
    }
    const [r, g, b, a] = rgba(colorCss);
    const fg = over([r, g, b, a * under.fade], under.color);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, under.color);
    if (got / need < closest.margin) closest = { margin: got / need, line: `${got.toFixed(2)}:1 of ${need}:1` };
    if (got < need) note(contrast, `${where}: ${got.toFixed(2)}:1, under ${need}:1 (${hex(fg)} on ${hex(under.color)}, ${size}px ${weight})`);
  };

  /** Where a box's centre is on screen, scrolled into view first unless it's pinned in place, where scrolling would move what's under it. */
  const centre = (el: Element, box: () => DOMRect) => () => {
    let pinned = false;
    for (let e: Element | null = el; e && !pinned; e = e.parentElement) pinned = getComputedStyle(e).position === "fixed";
    if (!pinned) el.scrollIntoView({ block: "center", inline: "center" });
    const { left, top, width, height } = box();
    return { x: left + width / 2, y: top + height / 2 };
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent!.trim();
    const el = node.parentElement;
    if (!text || !el || el.closest("script, style, noscript, template")) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || clippedAway(el)) continue;
    // SVG text is drawn in its fill.
    audit(el, el instanceof SVGElement ? cs.fill : cs.color, centre(el, () => range.getClientRects()[0]!), text);
  }
  for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input:not([type=hidden], [type=checkbox], [type=radio], [type=file])")) {
    const box = field.getBoundingClientRect();
    // Its value, or else its placeholder: either is text on the page.
    const shown = field.value || field.placeholder;
    if (!shown || box.width === 0 || getComputedStyle(field).visibility !== "visible" || clippedAway(field)) continue;
    audit(field, getComputedStyle(field, field.value ? null : "::placeholder").color, centre(field, () => field.getBoundingClientRect()), shown);
  }
  scrollTo(0, 0);

  const lines = (map: Map<string, number>) => [...map].map(([line, n]) => (n > 1 ? `${line} ×${n}` : line));
  const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, "") === font);
  return {
    texts,
    smallest,
    closest: closest.line,
    h1s: document.querySelectorAll("h1").length,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    font: { checked: document.fonts.check(`16px "${font}"`), loaded: faces.some((face) => face.status === "loaded") },
    small: lines(small),
    contrast: lines(contrast),
  };
}

/** Opens one page, lets it settle, shoots it, and checks it; returns what it read and what failed. */
async function visit(context: BrowserContext, { path }: Visit, shot: string): Promise<{ read: string; problems: string[] }> {
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (message) => {
    // Chrome logs every non-2xx answer as a failed resource; the response listener below reports those, less the 404 page's own.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const expected = url.origin === app.url && url.pathname === NOT_FOUND_PATH && response.status() === 404;
    if (response.status() >= 400 && !expected) failed.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
  });
  page.on("requestfailed", (request) => failed.push(`${request.failure()?.errorText ?? "failed"} ${request.method()} ${new URL(request.url()).pathname}`));

  const problems: string[] = [];
  let read = "";
  try {
    await page.goto(new URL(path, app.url).href);
    await page.waitForLoadState("networkidle");
    // A screen is drawn once nothing on it waits for its data.
    await page.waitForFunction(() => document.querySelector("h1") !== null && document.querySelector("[data-slot=skeleton]") === null);
    // Scroll through, so every entrance that runs as its part arrives has run, then back to the top.
    await page.evaluate(async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.6) {
        scrollTo(0, y);
        await frame();
      }
      scrollTo(0, 0);
      await frame();
    });
    // Wait for the finite animations and transitions on the document's clock: an infinite one, or one driven by the scroll, would never finish.
    await page.evaluate(async () => {
      const finite = document.getAnimations().filter((a) => a.timeline instanceof DocumentTimeline && a.effect?.getTiming().iterations !== Infinity);
      await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), new Promise((resolve) => setTimeout(resolve, 5000))]);
      await document.fonts.ready;
    });
    await page.screenshot({ path: join(OUT, `${shot}.png`), fullPage: true });
    const m = await page.evaluate(measure, FONT);
    read = `${m.texts} texts, smallest ${m.smallest}px, lowest contrast ${m.closest}`;
    const csp = await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);

    if (m.overflow > 0) problems.push(`it scrolls sideways by ${m.overflow}px`);
    if (m.h1s !== 1) problems.push(`it has ${m.h1s} h1s, not one`);
    if (!m.font.checked || !m.font.loaded) problems.push(`${FONT} isn't loaded (check ${m.font.checked}, a loaded face ${m.font.loaded})`);
    for (const line of m.small) problems.push(`text under 12px: ${line}`);
    for (const line of m.contrast) problems.push(`low contrast: ${line}`);
    for (const line of csp) problems.push(`CSP violation: ${line}`);
  } catch (error) {
    problems.push(`threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  for (const error of errors) problems.push(`console error: ${error.split("\n")[0]}`);
  for (const request of failed) problems.push(`request failed: ${request}`);
  page.removeAllListeners();
  await page.close();
  return { read, problems };
}

/** A context at one viewport, logged in with `cookie` when given, that records the page's CSP violations. */
async function contextFor(viewport: { width: number; height: number }, cookie?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener("securitypolicyviolation", (event) => seen.push(`${event.violatedDirective} ${event.blockedURI || "inline"}`));
  });
  if (cookie) {
    const pairs = cookie.split("; ").map((pair) => pair.split("="));
    await context.addCookies(pairs.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  }
  return context;
}

try {
  // The learner: a shelf with the demo export sorted onto it as the answer key sorts it, and one cold rep passed on its top card.
  const learner = app.browser();
  await learner.client.auth.signUp(LEARNER);
  const work = await learner.client.shelves.create({ name: "Work" });
  const sorted = await sortEnds(learner.client, (await upload(learner.client, work.id, phrasings, "conversations.json")).id);
  if (sorted.status !== "sorted") throw new Error(`the demo export didn't sort: ${sorted.status}`);
  const [top] = await learner.client.cards.list(work.id);
  model.queue(repReply("A stand-in's problem: undo the last commit and keep its changes staged."), verdictReply("pass", "A stand-in's reason."));
  const { rep } = await learner.client.reps.start(top!.id);
  const checked = await learner.client.reps.check(rep.id, { answer: known.right });
  if (checked.rep.verdict !== "pass") throw new Error(`the stand-in's verdict wasn't a pass: ${checked.rep.verdict}`);

  // The guest: signing in restores the shared workspace's demo shelf, already sorted.
  const guest = app.browser();
  await guest.client.auth.signInAsGuest();

  const people = [
    { who: "visitor", cookie: undefined, visits: PUBLIC },
    { who: "learner", cookie: learner.cookie(), visits: [...(await screensOf(learner.client)), ...PUBLIC] },
    { who: "guest", cookie: guest.cookie(), visits: [...(await screensOf(guest.client)), ...PUBLIC] },
  ];

  for (const viewport of VIEWPORTS) {
    for (const { who, cookie, visits } of people) {
      const context = await contextFor(viewport, cookie);
      for (const page of visits) {
        const shot = `${who}-${page.name}-${viewport.width}`;
        const { read, problems } = await visit(context, page, shot);
        console.log(`${problems.length ? "FAIL" : "ok  "} ${shot.padEnd(34)}${read}`);
        for (const problem of problems) {
          console.log(`       ${problem}`);
          failures.push(`${shot}: ${problem}`);
        }
      }
      await context.close();
    }
  }
  console.log(`\nscreenshots in ${OUT}`);
} catch (error) {
  failures.push(`threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
