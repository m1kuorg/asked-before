// The styles check's kit (scripts/check-styles.ts): pages at the 1080p frame,
// with a learner logged in or not, and `shoot`, which saves a screenshot of
// a state and checks it against docs/DESIGN.md: the type floor, where
// vermilion appears (in the markup and in the pixels), radius and shadow,
// every color against the inks and the one ramp, contrast, at most one
// plate, and no sideways scroll. Each surface's states live in their own
// module under scripts/styles/; see that folder's modules for the shape.

import type { Client } from "@asked-before/sdk";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import type { App } from "./app";
import type { ModelStub } from "./model-stub";

export const FRAME = { width: 1920, height: 1080 };
/** An app path no screen claims, logged in: the app's page and stylesheets, ready for sample markup. */
export const SAMPLE_PATH = "/app/sample";
export const VERMILION = "rgb(180, 45, 22)";
export const GRAY_800 = "rgb(55, 56, 57)";

/** Every color a page may use: the inks and the one neutral ramp. */
const INKS: Record<string, string> = {
  "rgb(232, 235, 237)": "Proof Gray",
  "rgb(255, 255, 255)": "Block White",
  "rgb(26, 26, 26)": "Iron Black",
  "rgb(195, 200, 204)": "Rule Gray",
  [VERMILION]: "Rubric Vermilion",
  "rgb(213, 217, 220)": "gray-200",
  "rgb(96, 98, 99)": "gray-600",
  [GRAY_800]: "gray-800",
};

export type PageOptions = {
  /** Log the page in as the check's learner. */
  loggedIn?: boolean;
  /** Let a sample bundle run in the page; the app's own pages keep their security policy. */
  bypassCSP?: boolean;
  reducedMotion?: boolean;
  viewport?: { width: number; height: number };
};

export type Kit = {
  app: App;
  /** The app's model stand-in: it sorts as the answer key does, and a module queues its own answers to anything else. */
  model: ModelStub;
  browser: Browser;
  /** The learner every logged-in page belongs to, and an SDK client on their session. */
  learner: { name: string; email: string; password: string; client: Client; cookie: () => string };
  /** A new page, in a context of its own, with the faces loaded once it opens something. */
  page: (options?: PageOptions) => Promise<Page>;
  /** Goes to an app path and waits for the fonts and for the selector, when given. */
  open: (page: Page, path: string, selector?: string) => Promise<void>;
  /** Saves `<name>.png`, measures the page as it stands, and checks it against the rules. */
  shoot: (page: Page, name: string, options?: { fullPage?: boolean }) => Promise<void>;
  check: (ok: boolean, what: string) => void;
  /** Where the screenshots go. */
  out: string;
};

/** One surface's states: it drives pages into each state and calls kit.shoot. */
export type Surface = (kit: Kit) => Promise<void>;

export type Result = { name: string; body: number; label: number };

export function makeKit({
  app,
  model,
  browser,
  learner,
  out,
  check,
  results,
}: {
  app: App;
  model: ModelStub;
  browser: Browser;
  learner: Kit["learner"];
  out: string;
  check: Kit["check"];
  results: Result[];
}): Kit {
  const contexts: BrowserContext[] = [];
  let scratch: Page | undefined;

  const page = async ({ loggedIn = false, bypassCSP = false, reducedMotion = false, viewport = FRAME }: PageOptions = {}) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, bypassCSP, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    contexts.push(context);
    if (loggedIn) {
      // The learner's one session, shared by every logged-in page, so the check spends a single log-in.
      const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
      await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
    }
    return context.newPage();
  };

  const open = async (target: Page, path: string, selector?: string) => {
    await target.goto(new URL(path, app.url).href);
    if (selector) await target.locator(selector).first().waitFor();
    await target.evaluate(() => document.fonts.ready.then(() => undefined));
  };

  const shoot = async (target: Page, name: string, { fullPage = false } = {}) => {
    scratch ??= await (await browser.newContext()).newPage();
    const png = await target.screenshot({ path: join(out, `${name}.png`), fullPage });
    const measured = await target.evaluate(audit);
    const pixels = await strayVermilion(scratch, png, measured.allowedRects);
    results.push(report(check, name, measured, pixels));
  };

  return { app, model, browser, learner, page, open, shoot, check, out };
}

// Measurements, run in the page. Self-contained, because Playwright sends the function's source.

type Audit = {
  texts: { role: string; size: number; contrast: number; where: string }[];
  vermilion: { where: string; prop: string; allowed: boolean }[];
  shapes: string[];
  colors: string[];
  plates: number;
  overflow: boolean;
  allowedRects: { x: number; y: number; w: number; h: number }[];
};

function audit(): Audit {
  const VERMILION = "rgb(180, 45, 22)";
  const describe = (el: Element, pseudo = "") =>
    `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}${pseudo}`;
  const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
  const luminance = (value: string) => {
    const [r, g, b] = rgb(value).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const opaque = (value: string) => value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
  const backgroundOf = (el: Element | null): string => {
    for (let e = el; e; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      if (opaque(bg)) return bg;
    }
    return "rgb(255, 255, 255)";
  };
  const contrastOf = (el: Element) => {
    const [fg, bg] = [luminance(getComputedStyle(el).color), luminance(backgroundOf(el))];
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  };
  // Read by assistive technology only: never drawn, so never measured.
  const hidden = (el: Element) => el.closest(".visually-hidden") !== null;

  const result: Audit = { texts: [], vermilion: [], shapes: [], colors: [], plates: 0, overflow: false, allowedRects: [] };
  const colors = new Set<string>();
  const all = [...document.querySelectorAll("body *")].filter((el) => !hidden(el));

  for (const el of all) {
    for (const pseudo of ["", "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo || null);
      if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
      if (cs.display === "none") continue;
      const where = describe(el, pseudo);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      const used: [string, string][] = [];
      if (ownText && !pseudo) used.push(["color", cs.color]);
      if (opaque(cs.backgroundColor)) used.push(["background-color", cs.backgroundColor]);
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const width = parseFloat(cs[`border${side}Width`]);
        if (width > 0 && cs[`border${side}Style`] !== "none") used.push([`border-${side.toLowerCase()}-color`, cs[`border${side}Color`]]);
      }
      if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) used.push(["outline-color", cs.outlineColor]);
      if (cs.textDecorationLine !== "none") used.push(["text-decoration-color", cs.textDecorationColor]);
      for (const [prop, value] of used) {
        // A fully transparent border or outline draws nothing, so it brings no ink.
        if (!opaque(value)) continue;
        colors.add(value);
        if (value === VERMILION) {
          const allowed = el.matches(".rail-key") || (prop === "color" && el.matches(".margin-key > :first-child"));
          result.vermilion.push({ where, prop, allowed });
        }
      }
      for (const corner of ["TopLeft", "TopRight", "BottomLeft", "BottomRight"] as const) {
        if (cs[`border${corner}Radius`] !== "0px") result.shapes.push(`${where} border-radius ${cs[`border${corner}Radius`]}`);
      }
      if (cs.boxShadow !== "none") result.shapes.push(`${where} box-shadow ${cs.boxShadow}`);
      if (cs.textShadow !== "none") result.shapes.push(`${where} text-shadow ${cs.textShadow}`);
      if (cs.filter.includes("drop-shadow")) result.shapes.push(`${where} filter ${cs.filter}`);
      if (!pseudo && el.matches("button, textarea, input, select") && cs.appearance !== "none")
        result.shapes.push(`${where} appearance ${cs.appearance}`);
    }
  }

  const roleOf = (el: Element) => {
    if (el.closest(".plate > :first-child")) return "count";
    if (el.closest("h1, .skill")) return "display";
    if (el.closest(".margin h2, .margin h3")) return "apparatus";
    if (el.closest("nav, .demo-label, .privacy-line, button, .button, label, th, figcaption, .field-hint, .margin, .plate, .end-rule, .verdict .stamp")) return "label";
    return "body";
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent!.trim();
    const el = node.parentElement!;
    if (!text || el.closest("script, style") || hidden(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (range.getClientRects().length === 0) continue;
    result.texts.push({ role: roleOf(el), size: parseFloat(getComputedStyle(el).fontSize), contrast: contrastOf(el), where: describe(el) });
  }
  for (const field of document.querySelectorAll("textarea, input:not([type=file], [type=checkbox], [type=radio])")) {
    result.texts.push({ role: "body", size: parseFloat(getComputedStyle(field).fontSize), contrast: contrastOf(field), where: describe(field) });
  }

  for (const el of document.querySelectorAll(".rail-key, .margin-key > :first-child")) {
    const r = el.getBoundingClientRect();
    result.allowedRects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
  }
  result.colors = [...colors];
  result.plates = document.querySelectorAll(".plate").length;
  result.overflow = document.documentElement.scrollWidth > window.innerWidth;
  return result;
}

// Counts strongly red pixels in a screenshot that fall outside the rail keys and the margin key letters.
async function strayVermilion(scratch: Page, png: Buffer, rects: Audit["allowedRects"]) {
  return scratch.evaluate(
    async ({ data, rects }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data: px, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const inside = (x: number, y: number) =>
        rects.some((r) => x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y - 1 && y <= r.y + r.h + 1);
      let red = 0;
      let stray = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [r, g, b] = [px[i]!, px[i + 1]!, px[i + 2]!];
          if (r > 100 && r - g > 60 && r - b > 60) {
            red++;
            if (!inside(x, y)) stray++;
          }
        }
      }
      return { red, stray };
    },
    { data: png.toString("base64"), rects },
  );
}

function report(check: Kit["check"], name: string, measured: Audit, pixels: { red: number; stray: number }): Result {
  const min = (roles: string[]) => Math.min(...measured.texts.filter((t) => roles.includes(t.role)).map((t) => t.size), Infinity);
  const body = min(["body", "display", "count"]);
  const label = min(["label", "apparatus"]);
  const lowContrast = measured.texts.filter((t) => t.contrast < 4.5);
  const badVermilion = measured.vermilion.filter((v) => !v.allowed);
  const oneOffs = measured.colors.filter((c) => !(c in INKS));
  check(body >= 20, `${name}: body text at least 20px (smallest ${body}px)`);
  check(label === Infinity || label >= 14, `${name}: labels and apparatus at least 14px (smallest ${label}px)`);
  check(badVermilion.length === 0, `${name}: vermilion only on .rail-key and margin key letters${badVermilion.length ? ` (also ${badVermilion.map((v) => `${v.where} ${v.prop}`).join(", ")})` : ""}`);
  check(pixels.stray === 0, `${name}: no vermilion pixels outside keys and letters (${pixels.red} red, ${pixels.stray} stray)`);
  check(measured.shapes.length === 0, `${name}: no radius, shadow, or native appearance${measured.shapes.length ? ` (${measured.shapes.slice(0, 3).join("; ")})` : ""}`);
  check(oneOffs.length === 0, `${name}: every color is an ink or a ramp step${oneOffs.length ? ` (also ${oneOffs.join(", ")})` : ""}`);
  check(lowContrast.length === 0, `${name}: text contrast at least 4.5:1${lowContrast.length ? ` (${lowContrast.map((t) => `${t.where} ${t.contrast.toFixed(2)}`).join(", ")})` : ""}`);
  check(measured.plates <= 1, `${name}: at most one plate (${measured.plates})`);
  check(!measured.overflow, `${name}: no sideways scroll`);
  return { name, body, label };
}
