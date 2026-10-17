// The card stack's states (public/styles/stack.css; m1kuorg/basics#45 owns
// this module and retargets it to the real project page). Until then they're
// sample markup in the proof of concept's shapes, built from the demo
// export's real cards as the answer key groups them, set into the app page:
// the stack, a returned card, the waiting and error states, and the old load
// screen; then the faces, the key drop, focus, pressing, widths, a narrow
// screen, and reduced motion.

import { join } from "node:path";
import type { Page } from "playwright";
import { buildCards } from "../../src/cards";
import { parseExport } from "../../src/parser";
import type { Card } from "../../src/types";
import { PRIVACY_LINE } from "../../src/parts/library";
import { FRAME, GRAY_800, SAMPLE_PATH, VERMILION, type Kit } from "../lib/styles";

const ROOT = join(import.meta.dir, "..", "..");
const messages = parseExport(await Bun.file(join(ROOT, "demo/export.json")).text());
const answerKey: { skills: { name: string; messageIds: string[] }[] } = await Bun.file(join(ROOT, "demo/answer-key.json")).json();
const cards = buildCards({ skills: answerKey.skills }, messages);
const A = cards[0]!;
const RETURNED_ON = "2026-10-16";

const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const letter = (i: number) => String.fromCharCode(65 + i);

function margin({ returned = false, keys = true } = {}) {
  const items = cards
    .map((card, i) => {
      const state = i === 0 && returned ? " is-returned" : "";
      const isCurrent = i === 0 ? ' aria-current="true"' : "";
      return `<li><button class="margin-key${state}"${isCurrent}><b>${letter(i)}</b><span>${esc(card.skill)}</span><span>${card.count}</span></button></li>`;
    })
    .join("");
  const list = keys ? `<h2>Keys, most borrowed first</h2><ol>${items}</ol>` : "";
  return `<aside class="margin">${list}<p class="privacy-line">${esc(PRIVACY_LINE)}</p></aside>`;
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

const STATES = {
  stack: margin() + stackBlock(A),
  returned: margin({ returned: true }) + stackBlock(A, true),
  waiting: `${margin({ keys: false })}<section class="block"><p class="is-waiting" role="status">Sorting your messages into cards…</p></section>`,
  error: `${margin({ keys: false })}<section class="block"><p class="error" role="alert">The model's reply didn't hold up: one message was in two groups. Nothing was made into a card.</p><button class="retry">Try again</button></section>`,
  load: `<section class="block"><h1>The demo chat export</h1><p class="plate"><b>${messages.length}</b><span>of your own messages</span></p><p>A made-up export. Only your own messages are kept; the chatbot's answers are dropped.</p><p class="privacy-line">${esc(PRIVACY_LINE)}</p><button>Load the demo export</button></section>`,
};

// Tabs from the keyboard until the "Open key …" button has focus, so :focus-visible applies.
async function tabToOpenKey(page: Page) {
  for (let i = 0; i < 20 && !(await page.evaluate(() => document.activeElement?.textContent?.startsWith("Open key"))); i++) {
    await page.keyboard.press("Tab");
  }
}

export default async function stack(kit: Kit) {
  const { check } = kit;
  const page = await kit.page({ loggedIn: true });
  await kit.open(page, SAMPLE_PATH, ".block h1");

  // Fonts: the self-hosted faces load, render, and set figures at one width.
  await kit.render(page, STATES.stack);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => `${f.family} ${f.style} ${f.status}`);
    const canvas = new OffscreenCanvas(10, 10).getContext("2d")!;
    canvas.font = '400 20px "Hanken Grotesk"';
    const digits = new Set([..."0123456789"].map((d) => canvas.measureText(d).width.toFixed(3)));
    return { faces, digits: digits.size };
  });
  check(fonts.faces.length === 2 && fonts.faces.every((f) => f.endsWith("loaded")), `both Hanken Grotesk faces load from public/fonts (${fonts.faces.join(", ")})`);
  check(fonts.digits === 1, "figures are tabular: every digit has one advance width");
  const cdp = await page.context().newCDPSession(page);
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
        stops,
        delay: Number(timing.delay),
        end: Number(timing.endTime),
      };
    });
    return { keys: keys.length, drops };
  }, STATES.stack);
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
  await page.screenshot({ path: join(kit.out, "stack-drop.png") });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const seated = await page.evaluate(() => [...document.querySelectorAll(".rail-key")].every((k) => getComputedStyle(k, "::before").translate === "none"));
  check(seated, "after the drop every key sits in its detent");

  // Each state.
  await kit.shoot(page, "stack");
  const keyLetters = await page.evaluate(() => [...document.querySelectorAll(".margin-key > :first-child")].map((b) => getComputedStyle(b).color));
  check(keyLetters.length === 5 && keyLetters.every((c) => c === VERMILION), "the five margin key letters are vermilion");
  for (const name of ["returned", "waiting", "error", "load"] as const) {
    await kit.render(page, STATES[name]);
    if (name === "returned") {
      check((await page.evaluate(() => document.getAnimations().length)) === 0, "a returned card's keys are already seated, with no drop");
      const strike = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector(".margin-key.is-returned")!);
        return `${cs.textDecorationLine} ${cs.textDecorationColor} ${cs.textDecorationThickness}`;
      });
      check(strike === "line-through rgb(26, 26, 26) 2px", `the returned margin key is struck in iron black (${strike})`);
    }
    await kit.shoot(page, `stack-${name}`);
  }

  // A focused control, from the keyboard, and a pressed one.
  await kit.render(page, STATES.stack);
  await tabToOpenKey(page);
  const bracket = await page.evaluate(() => {
    const button = document.activeElement!;
    const [before, after] = [getComputedStyle(button, "::before"), getComputedStyle(button, "::after")];
    return { matches: button.matches(":focus-visible"), before: `${before.borderLeftWidth} ${before.borderLeftStyle}`, after: `${after.borderRightWidth} ${after.borderRightStyle}` };
  });
  check(bracket.matches && bracket.before === "2px solid" && bracket.after === "2px solid", `a focused button is bracketed (${JSON.stringify(bracket)})`);
  await kit.shoot(page, "stack-focus");
  await kit.render(page, STATES.stack);
  const openKey = page.getByRole("button", { name: "Open key A" });
  await openKey.hover();
  await page.mouse.down();
  const pressed = await openKey.evaluate((b) => getComputedStyle(b).backgroundColor);
  check(pressed === GRAY_800, `a pressed button fills one ramp step down (${pressed})`);
  await kit.shoot(page, "stack-pressed");
  await page.mouse.up();

  // Widths: the block keeps its measure, and narrow screens move the rail outboard.
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 1080 });
    await kit.render(page, STATES.stack);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `no sideways scroll at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await kit.render(page, STATES.stack);
  await kit.shoot(page, "stack-narrow", { fullPage: true });
  const outboard = await page.evaluate(() => {
    const rail = document.querySelector(".rail")!.getBoundingClientRect();
    const key = document.querySelector(".rail-key")!.getBoundingClientRect();
    const phrasing = document.querySelector(".phrasing")!.getBoundingClientRect();
    return key.right <= phrasing.left && key.left - rail.left < 40;
  });
  check(outboard, "on a narrow screen the rail sits outboard of the text, a channel of keys");
  await page.setViewportSize(FRAME);

  // Reduced motion: the keys are simply in place on the first frame.
  const still = await kit.page({ loggedIn: true, reducedMotion: true });
  await kit.open(still, SAMPLE_PATH, ".block h1");
  const first = await still.evaluate((markup) => {
    document.querySelector("#app")!.innerHTML = markup;
    return {
      animations: document.getAnimations().length,
      inPlace: [...document.querySelectorAll(".rail-key")].every((k) => getComputedStyle(k, "::before").animationName === "none" && k.getBoundingClientRect().height > 0),
    };
  }, STATES.stack);
  check(first.animations === 0 && first.inPlace, `reduced motion: no animations and every key in place on the first frame (${first.animations} running)`);
  await still.screenshot({ path: join(kit.out, "stack-reduced-motion.png") });
}
