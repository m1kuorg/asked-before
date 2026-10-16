// Checks public/styles.css (m1kuorg/basics#33) on the running app. It starts the
// server on PORT (default 3133) and opens the page at 1920×1080. For each state
// #33 lists, it swaps #app for sample markup in the screens' own shapes, built
// from the demo export's real cards, and takes a screenshot. It then measures the
// type floor, where vermilion appears, radius and shadow, the colors against the
// one ramp, overflow, the key drop, and reduced motion. It exits 1 on any failure.
// The sample markup lives only here; nothing is written to public/. It then
// walks the real screens with the model routes stubbed through page.route.
// It prints selectors, never message text.
// Run: PORT=3133 bun run scripts/check-styles.ts [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page, type Route } from "playwright";
import { buildCards } from "../src/cards";
import { parseExport } from "../src/parser";
import type { Card, RepRequest } from "../src/types";

const ROOT = join(import.meta.dir, "..");
const PORT = Number(process.env.PORT ?? 3133);
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-styles");
const FRAME = { width: 1920, height: 1080 };

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

// The demo's real cards, grouped by the answer key. The same grouping stubs the group route on the real screens.

const messages = parseExport(await Bun.file(join(ROOT, "demo/export.json")).text());
const answerKey: { skills: { name: string; messageIds: string[] }[] } = await Bun.file(
  join(ROOT, "demo/answer-key.json"),
).json();
const cards = buildCards({ skills: answerKey.skills }, messages);
const RETURNED_ON = "2026-10-16";

// Sample markup, in the shapes #26, #28, and #29 recorded in .orchestration/seams.md.

const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const letter = (i: number) => String.fromCharCode(65 + i);

function margin(privacy: string, { returned = false, keys = true } = {}) {
  const items = cards
    .map((card, i) => {
      const state = i === 0 && returned ? " is-returned" : "";
      const isCurrent = i === 0 ? ' aria-current="true"' : "";
      return `<li><button class="margin-key${state}"${isCurrent}><b>${letter(i)}</b><span>${esc(card.skill)}</span><span>${card.count}</span></button></li>`;
    })
    .join("");
  const list = keys ? `<h2>Keys, most borrowed first</h2><ol>${items}</ol>` : "";
  return `<aside class="margin">${list}<p class="privacy-line">${esc(privacy)}</p></aside>`;
}

function rails(card: Card) {
  const years = new Map<string, Card["borrows"]>();
  for (const borrow of card.borrows) {
    const year = borrow.date.slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), borrow]);
  }
  return [...years]
    .map(([year, borrows]) => {
      const rows = borrows
        .map(
          (b) =>
            `<li><span class="phrasing">${esc(b.text)}</span><span class="rail-key" aria-hidden="true"></span><span class="stamp"><time datetime="${b.date}">${b.date}</time></span></li>`,
        )
        .join("");
      return `<ol class="rail" aria-label="Borrowed in ${year}">${rows}</ol>`;
    })
    .join("");
}

/** Card A in the block, as the stack first shows it. */
function stackBlock(card: Card, returned = false) {
  const key = letter(0);
  const endRule = returned ? `<p class="end-rule">Returned <time>${RETURNED_ON}</time></p>` : "";
  return `<section class="block"><h1 class="skill">${esc(card.skill)}</h1><p>Key ${key}: borrowed ${card.count} times, ${card.firstMonth} to ${card.lastMonth}</p><p class="plate"><b>${card.count}</b><span>times borrowed, ${returned ? "returned" : "not returned"}</span></p>${rails(card)}${endRule}<button>Open key ${key}</button></section>`;
}

const A = cards[0]!;
const repHead = `<h1 class="skill">${esc(A.skill)}</h1><div class="plate"><b>${A.count}</b> <span>times borrowed</span></div>`;
const repMargin = `<aside class="margin"><p>Key A: borrowed ${A.count} times, ${A.firstMonth} to ${A.lastMonth}.</p><p>Answer without AI. A pass stamps the card returned.</p></aside>`;
const lesson = `<section class="lesson"><h2>The lesson</h2><p>A commit you haven't pushed can be taken back by moving your branch back one commit.</p><p>git reset --soft HEAD~1 keeps the changes staged, --mixed keeps them unstaged, and --hard throws them away.</p><p>Once a commit is pushed, use git revert, which adds a new commit instead of rewriting history.</p></section>`;
const problem = `<section class="problem"><h2>A fresh problem</h2><p>You committed two files to main, then saw that one of them holds a password. Nothing is pushed yet. Take the commit back, keep both files' changes in your working tree, and leave main where it was before the commit.</p></section>`;
const answerBox = (answer: string, locked: boolean) =>
  `<form class="answer-box"><label>Your answer, without AI<textarea${locked ? " disabled" : ""}>${esc(answer)}</textarea></label><button type="submit"${locked ? " disabled" : ""}>Check my answer</button></form>`;

function screens(privacy: string) {
  return {
    stack: margin(privacy) + stackBlock(A),
    "rep-failed": `${repMargin}<main class="block">${repHead}<div><section class="verdict is-failed"><h2>Still borrowed</h2><p>git revert HEAD keeps the bad commit in history and adds a second one that undoes it. This problem asks for the commit to be gone before you push, with your changes kept.</p></section>${lesson}${problem}${answerBox("", false)}</div></main>`,
    returned: margin(privacy, { returned: true }) + stackBlock(A, true),
    waiting: `${margin(privacy, { keys: false })}<section class="block"><p class="is-waiting" role="status">Sorting your messages into cards…</p></section>`,
    "waiting-rep": `${repMargin}<main class="block">${repHead}<div>${lesson}${problem}${answerBox("git reset HEAD~1, then commit the file without the password", true)}<p class="is-waiting" role="status">Checking your answer…</p></div></main>`,
    error: `${margin(privacy, { keys: false })}<section class="block"><p class="error" role="alert">The model's reply didn't hold up: one message was in two groups. Nothing was made into a card.</p><button class="retry">Try again</button></section>`,
    load: `<section class="block"><h1>The demo chat export</h1><p class="plate"><b>${messages.length}</b><span>of your own messages</span></p><p>A made-up export. Only your own messages are kept; the chatbot's answers are dropped.</p><p class="privacy-line">${esc(privacy)}</p><button>Load the demo export</button></section>`,
  };
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

  const result: Audit = { texts: [], vermilion: [], shapes: [], colors: [], plates: 0, overflow: false, allowedRects: [] };
  const colors = new Set<string>();
  const all = [...document.querySelectorAll("body *")];

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
    if (el.closest("nav, .demo-label, .privacy-line, button, label, .margin, .plate, .end-rule, .verdict .stamp")) return "label";
    return "body";
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent!.trim();
    const el = node.parentElement!;
    if (!text || el.closest("script, style")) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (range.getClientRects().length === 0) continue;
    result.texts.push({ role: roleOf(el), size: parseFloat(getComputedStyle(el).fontSize), contrast: contrastOf(el), where: describe(el) });
  }
  for (const textarea of document.querySelectorAll("textarea")) {
    result.texts.push({ role: "body", size: parseFloat(getComputedStyle(textarea).fontSize), contrast: contrastOf(textarea), where: "textarea" });
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

const VERMILION = "rgb(180, 45, 22)";
const GRAY_800 = "rgb(55, 56, 57)";
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

// Tabs from the keyboard until the "Open key …" button has focus, so :focus-visible applies.
async function tabToOpenKey(page: Page) {
  for (let i = 0; i < 12 && !(await page.evaluate(() => document.activeElement?.textContent?.startsWith("Open key"))); i++) {
    await page.keyboard.press("Tab");
  }
}

// Renders one state into #app and lets the key drop settle.
async function render(page: Page, html: string) {
  await page.evaluate((markup) => {
    document.querySelector("#app")!.innerHTML = markup;
  }, html);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
}

async function shoot(page: Page, scratch: Page, name: string, fullPage = false) {
  const png = await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  const measured = await page.evaluate(audit);
  const pixels = await strayVermilion(scratch, png, measured.allowedRects);
  return { name, measured, pixels };
}

function report({ name, measured, pixels }: Awaited<ReturnType<typeof shoot>>) {
  const min = (roles: string[]) =>
    Math.min(...measured.texts.filter((t) => roles.includes(t.role)).map((t) => t.size), Infinity);
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

// Run.

if (await fetch(BASE).then(() => true, () => false)) {
  console.error(`Something is already on port ${PORT}; set PORT to a free one.`);
  process.exit(1);
}
await mkdir(OUT, { recursive: true });
const server = Bun.spawn(["bun", "run", "server.ts"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdout: "ignore",
  stderr: "inherit",
});
const browser = await chromium.launch();

try {
  for (let tries = 0; ; tries++) {
    const up = await fetch(BASE).then((r) => r.ok).catch(() => false);
    if (up) break;
    if (tries > 50) throw new Error(`The server didn't answer on ${BASE}.`);
    await Bun.sleep(100);
  }

  const open = async (context: BrowserContext) => {
    const page = await context.newPage();
    await page.goto(BASE);
    await page.waitForSelector(".privacy-line");
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const page = await open(context);
  const scratch = await context.newPage();
  const privacy = await page.textContent(".privacy-line");
  check((await page.locator("nav .demo-label").count()) === 1, "the page entry's nav carries .demo-label");
  const html = screens(privacy!);

  // Fonts: the self-hosted faces load, render, and set figures at one width.
  await render(page, html.stack);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => `${f.family} ${f.style} ${f.status}`);
    const canvas = new OffscreenCanvas(10, 10).getContext("2d")!;
    canvas.font = '400 20px "Hanken Grotesk"';
    const digits = new Set([..."0123456789"].map((d) => canvas.measureText(d).width.toFixed(3)));
    return { faces, digits: digits.size };
  });
  check(
    fonts.faces.length === 2 && fonts.faces.every((f) => f.endsWith("loaded")),
    `both Hanken Grotesk faces load from public/fonts (${fonts.faces.join(", ")})`,
  );
  check(fonts.digits === 1, "figures are tabular: every digit has one advance width");
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  for (const selector of [".phrasing", ".rail .stamp", ".skill", ".plate b", ".margin-key span"]) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts: used } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    check(
      used.length > 0 && used.every((f) => f.familyName === "Hanken Grotesk" && f.isCustomFont),
      `${selector} renders in the self-hosted Hanken Grotesk (${used.map((f) => f.familyName).join(", ")})`,
    );
  }

  // Motion: one drop per key, along one axis, damped with no overshoot, in date order, settled in under a second.
  const motion = await page.evaluate((markup) => {
    document.querySelector("#app")!.innerHTML = markup;
    const keys = [...document.querySelectorAll(".rail-key")];
    const drops = document.getAnimations().map((a) => {
      const effect = a.effect as KeyframeEffect;
      const frames = effect.getKeyframes();
      const timing = effect.getComputedTiming();
      const props = new Set(frames.flatMap((f) => Object.keys(f)).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)));
      const easing = String(frames[0]?.easing ?? "");
      const stops = [...easing.matchAll(/(-?[\d.]+)(?:\s+[\d.]+%)*\s*[,)]/g)].map((m) => Number(m[1]));
      return {
        key: keys.indexOf(effect.target as Element),
        pseudo: effect.pseudoElement,
        props: [...props],
        from: String(frames[0]?.translate ?? ""),
        easing,
        stops,
        delay: Number(timing.delay),
        end: Number(timing.endTime),
      };
    });
    return { keys: keys.length, drops };
  }, html.stack);
  const drops = motion.drops.sort((a, b) => a.key - b.key);
  check(drops.length === motion.keys && motion.keys === A.count, `one drop per key: ${drops.length} drops, ${motion.keys} keys`);
  check(drops.every((d) => d.pseudo === "::before" && d.props.length === 1 && d.props[0] === "translate" && /^0px\s/.test(d.from)), `each drop moves the key on one axis only (translate ${drops[0]?.from} to its detent)`);
  check(drops.every((d) => d.stops.length > 2 && d.stops.every((s, i) => s >= 0 && s <= 1 && (i === 0 || s >= d.stops[i - 1]!))), `the easing is damped with no overshoot (${drops[0]?.stops.length} stops, max ${Math.max(...(drops[0]?.stops ?? [0]))})`);
  check(drops.every((d, i) => i === 0 || d.delay > drops[i - 1]!.delay), `keys drop in date order across the year cut (delays ${drops.map((d) => d.delay).join(", ")}ms)`);
  const settle = Math.max(...drops.map((d) => d.end));
  check(settle <= 1000, `every key is seated within a second (${settle}ms)`);
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 300;
    }
  });
  await page.screenshot({ path: join(OUT, "drop.png") });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const seated = await page.evaluate(() =>
    [...document.querySelectorAll(".rail-key")].every((k) => getComputedStyle(k, "::before").translate === "none"),
  );
  check(seated, "after the drop every key sits in its detent");

  // Every state #33 lists, plus load, disabled, and pressed.
  const results = [report(await shoot(page, scratch, "stack"))];
  const keyLetters = await page.evaluate(() =>
    [...document.querySelectorAll(".margin-key > :first-child")].map((b) => getComputedStyle(b).color),
  );
  check(keyLetters.length === 5 && keyLetters.every((c) => c === VERMILION), "the five margin key letters are vermilion");

  for (const name of ["rep-failed", "returned", "waiting", "waiting-rep", "error", "load"] as const) {
    await render(page, html[name]);
    if (name === "returned") {
      const animations = await page.evaluate(() => document.getAnimations().length);
      check(animations === 0, "a returned card's keys are already seated, with no drop");
      const strike = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector(".margin-key.is-returned")!);
        return `${cs.textDecorationLine} ${cs.textDecorationColor} ${cs.textDecorationThickness}`;
      });
      check(strike === "line-through rgb(26, 26, 26) 2px", `the returned margin key is struck in iron black (${strike})`);
    }
    results.push(report(await shoot(page, scratch, name)));
  }

  // A focused control, from the keyboard, and a focused answer box.
  await render(page, html.stack);
  await tabToOpenKey(page);
  const bracket = await page.evaluate(() => {
    const button = document.activeElement!;
    const [before, after] = [getComputedStyle(button, "::before"), getComputedStyle(button, "::after")];
    return { matches: button.matches(":focus-visible"), before: `${before.borderLeftWidth} ${before.borderLeftStyle}`, after: `${after.borderRightWidth} ${after.borderRightStyle}` };
  });
  check(bracket.matches && bracket.before === "2px solid" && bracket.after === "2px solid", `a focused button is bracketed (${JSON.stringify(bracket)})`);
  results.push(report(await shoot(page, scratch, "focus")));
  await render(page, html["rep-failed"]);
  await page.locator("textarea").focus();
  await page.keyboard.type("git revert HEAD");
  results.push(report(await shoot(page, scratch, "focus-answer")));

  await render(page, html.stack);
  const openKey = page.getByRole("button", { name: "Open key A" });
  await openKey.hover();
  await page.mouse.down();
  const pressed = await openKey.evaluate((b) => getComputedStyle(b).backgroundColor);
  check(pressed === GRAY_800, `a pressed button fills one ramp step down (${pressed})`);
  results.push(report(await shoot(page, scratch, "pressed")));
  await page.mouse.up();

  // Widths: the block keeps its measure, and narrow screens move the rail outboard.
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 1080 });
    await render(page, html.stack);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `no sideways scroll at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await render(page, html.stack);
  results.push(report(await shoot(page, scratch, "narrow", true)));
  const outboard = await page.evaluate(() => {
    const rail = document.querySelector(".rail")!.getBoundingClientRect();
    const key = document.querySelector(".rail-key")!.getBoundingClientRect();
    const phrasing = document.querySelector(".phrasing")!.getBoundingClientRect();
    return key.right <= phrasing.left && key.left - rail.left < 40;
  });
  check(outboard, "on a narrow screen the rail sits outboard of the text, a channel of keys");
  await page.setViewportSize(FRAME);

  // The real screens (#26, #28, #29), with the model routes stubbed here and never in the app.
  const app = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const live = await app.newPage();
  const liveScratch = await app.newPage();
  let releaseGroup = () => {};
  let groupHeld = new Promise<void>((resolve) => (releaseGroup = resolve));
  let groupFails = true;
  await live.route("**/api/group", async (route: Route) => {
    await groupHeld;
    if (groupFails) return route.fulfill({ status: 502, json: { error: "The model's reply was cut off." } });
    return route.fulfill({ json: { skills: answerKey.skills } });
  });
  await live.route("**/api/rep", (route: Route) => {
    const body = route.request().postDataJSON() as RepRequest;
    return route.fulfill({
      json: body.withLesson
        ? { lesson: "A commit you haven't pushed can be taken back by moving your branch back one commit.\ngit reset --soft HEAD~1 keeps the changes staged, --mixed keeps them unstaged, and --hard throws them away.", problem: "You committed a file with a password in it a minute ago and haven't pushed. Take that commit back but keep the work." }
        : { problem: "You made a commit on the wrong local branch and haven't pushed. Take it back without losing the edits." },
    });
  });
  let checks = 0;
  await live.route("**/api/check", (route: Route) =>
    route.fulfill({
      json:
        checks++ === 0
          ? { verdict: "fail", reason: "git revert adds a second commit that undoes the first, so the password stays in history." }
          : { verdict: "pass", reason: "A soft reset moves the branch back one commit and keeps the edits staged." },
    }),
  );
  const settleDrops = () => live.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await live.goto(BASE);
  await live.getByRole("button", { name: "Load the demo export" }).waitFor();
  await live.evaluate(() => document.fonts.ready);
  results.push(report(await shoot(live, liveScratch, "app-load")));
  await live.getByRole("button", { name: "Load the demo export" }).click();
  await live.locator(".block .is-waiting").waitFor();
  results.push(report(await shoot(live, liveScratch, "app-waiting")));
  releaseGroup();
  await live.locator(".block .error").waitFor();
  results.push(report(await shoot(live, liveScratch, "app-error")));
  groupFails = false;
  await live.getByRole("button", { name: "Try again" }).click();
  await live.locator(".rail-key").nth(A.count - 1).waitFor();
  await settleDrops();
  results.push(report(await shoot(live, liveScratch, "app-stack")));
  await tabToOpenKey(live);
  results.push(report(await shoot(live, liveScratch, "app-focus")));
  await live.getByRole("button", { name: "Open key A" }).click();
  await live.locator(".problem").waitFor();
  await live.locator("textarea").fill("git revert HEAD");
  await live.getByRole("button", { name: "Check my answer" }).click();
  await live.locator(".verdict.is-failed ~ .problem").waitFor();
  results.push(report(await shoot(live, liveScratch, "app-rep-failed")));
  await live.locator("textarea").fill("git reset --soft HEAD~1, then commit again without the password");
  await live.getByRole("button", { name: "Check my answer" }).click();
  await live.getByRole("button", { name: "Back to the stack" }).waitFor();
  results.push(report(await shoot(live, liveScratch, "app-rep-passed")));
  await live.getByRole("button", { name: "Back to the stack" }).click();
  await live.locator(".end-rule").waitFor();
  check((await live.evaluate(() => document.getAnimations().length)) === 0, "app: the returned card's keys are seated, with no drop");
  results.push(report(await shoot(live, liveScratch, "app-returned")));

  // Reduced motion: the keys are simply in place on the first frame.
  const still = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const stillPage = await open(still);
  const first = await stillPage.evaluate((markup) => {
    document.querySelector("#app")!.innerHTML = markup;
    return {
      animations: document.getAnimations().length,
      inPlace: [...document.querySelectorAll(".rail-key")].every((k) => {
        const name = getComputedStyle(k, "::before").animationName;
        const detent = k.getBoundingClientRect();
        return name === "none" && detent.height > 0;
      }),
    };
  }, html.stack);
  check(first.animations === 0 && first.inPlace, `reduced motion: no animations and every key in place on the first frame (${first.animations} running)`);
  await stillPage.screenshot({ path: join(OUT, "reduced-motion.png") });

  console.log(`\n${"state".padEnd(16)}smallest body  smallest label`);
  for (const r of results) console.log(`${r.name.padEnd(16)}${`${r.body}px`.padEnd(15)}${r.label}px`);
  console.log(`\nscreenshots in ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
