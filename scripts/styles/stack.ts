// The card stack's states (public/styles/stack.css; m1kuorg/basics#45), on
// the real project page: the demo export uploaded into a demo project and
// sorted as the answer key sorts it (check:styles's model stand-in), so the
// stack holds cards A to E. Its states: card A as the stack first shows it,
// mid-drop; card A returned and card B borrowed again, from the API's own
// answers with their status rewritten here, never in the app (real reps would
// need the model, so faking them keeps this check fast); the waiting and error
// states, with the cards' request held and answered here, and no plate,
// since the count is what they wait for; a card that fails to come, keeping
// the plate of its count; the unsorted phrasings; and the upload history
// with a delete being confirmed, then failing under the plate. Then the
// faces, the key drop, focus, pressing, widths, a narrow screen, and reduced
// motion.

import type { Card, CardDetail } from "@asked-before/sdk";
import { join } from "node:path";
import type { Page, Route } from "playwright";
import { key, phrasings, sortEnds, upload } from "../lib/answer-key";
import { FRAME, GRAY_800, VERMILION, type Kit } from "../lib/styles";

const A = key.skills[0]!;

/** Lets every key drop settle. */
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

// Tabs from the keyboard until the "Open key …" link has focus, so :focus-visible applies.
async function tabToOpenKey(page: Page) {
  for (let i = 0; i < 30 && !(await page.evaluate(() => document.activeElement?.textContent?.startsWith("Open key"))); i++) {
    await page.keyboard.press("Tab");
  }
}

export default async function stack(kit: Kit) {
  const { check, learner } = kit;
  const demo = await learner.client.projects.create({ name: "Demo", demo: true });
  const sorted = await sortEnds(learner.client, (await upload(learner.client, demo.id, phrasings, "demo-export.json")).id);
  check(sorted.status === "sorted", `the demo export is sorted into the demo project (${sorted.status})`);
  const at = `/app/projects/${demo.id}`;
  const page = await kit.page({ loggedIn: true });

  // Fonts: the self-hosted faces load, render, and set figures at one width.
  await kit.open(page, at, ".block .rail");
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
  for (const selector of [".phrasing", ".rail .stamp", ".skill", ".plate b", ".margin-key span", ".project-name"]) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts: used } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    check(
      used.length > 0 && used.every((f) => f.familyName === "Hanken Grotesk" && f.isCustomFont),
      `${selector} renders in the self-hosted Hanken Grotesk (${used.map((f) => f.familyName).join(", ")})`,
    );
  }
  await cdp.detach();

  // Motion: one drop per key, along one axis, damped with no overshoot, in date order, settled in under a second.
  // Card B is chosen, then card A again from the margin, and its drops are read as the block sets it.
  await page.locator(".margin .margin-key").nth(1).click();
  await page.locator(".block h1.skill", { hasText: key.skills[1]!.name }).waitFor();
  const motion = await page.evaluate(async (skill) => {
    document.querySelector<HTMLElement>(".margin .margin-key")!.click();
    // Card A's borrows are kept from the first time it was shown, so it's set within a few microtasks, before any key moves.
    for (let i = 0; i < 1000 && document.querySelector(".block h1.skill")?.textContent !== skill; i++) await Promise.resolve();
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
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 300;
    }
    return { keys: keys.length, drops };
  }, A.name);
  const drops = motion.drops.sort((a, b) => a.key - b.key);
  check(drops.length === motion.keys && motion.keys === A.count, `one drop per key: ${drops.length} drops, ${motion.keys} keys`);
  check(drops.every((d) => d.pseudo === "::before" && d.props.length === 1 && d.props[0] === "translate" && /^0px\s/.test(d.from)), `each drop moves the key on one axis only (translate ${drops[0]?.from} to its detent)`);
  check(drops.every((d) => d.stops.length > 2 && d.stops.every((s, i) => s >= 0 && s <= 1 && (i === 0 || s >= d.stops[i - 1]!))), `the easing is damped with no overshoot (${drops[0]?.stops.length} stops, max ${Math.max(...(drops[0]?.stops ?? [0]))})`);
  check(drops.every((d, i) => i === 0 || d.delay > drops[i - 1]!.delay), `keys drop in date order across the year cut (delays ${drops.map((d) => d.delay).join(", ")}ms)`);
  const settled = Math.max(...drops.map((d) => d.end));
  check(settled <= 1000, `every key is seated within a second (${settled}ms)`);
  await page.screenshot({ path: join(kit.out, "stack-drop.png") });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const seated = await page.evaluate(() => [...document.querySelectorAll(".rail-key")].every((k) => getComputedStyle(k, "::before").translate === "none"));
  check(seated, "after the drop every key sits in its detent");

  // The stack as it first shows.
  await kit.open(page, at, ".block .rail");
  await settle(page);
  await kit.shoot(page, "stack");
  const keyLetters = await page.evaluate(() => [...document.querySelectorAll(".margin-key > :first-child")].map((b) => getComputedStyle(b).color));
  check(keyLetters.length === 5 && keyLetters.every((c) => c === VERMILION), "the five margin key letters are vermilion");

  // Card A returned and card B borrowed again, as the API answers after real reps.
  const [cardA, cardB] = await learner.client.cards.list(demo.id);
  const status = (card: Card): Partial<Card> =>
    card.id === cardA!.id
      ? { status: "returned", returnedAt: "2026-10-16T12:00:00.000Z" }
      : card.id === cardB!.id
        ? { status: "borrowed_again", returnedAt: "2026-01-02T12:00:00.000Z" }
        : {};
  const list = async (route: Route) => {
    const { cards } = (await (await route.fetch()).json()) as { cards: Card[] };
    await route.fulfill({ json: { cards: cards.map((card) => ({ ...card, ...status(card) })) } });
  };
  const one = async (route: Route) => {
    const card = (await (await route.fetch()).json()) as CardDetail;
    await route.fulfill({ json: { ...card, ...status(card) } });
  };
  await page.route(`**/api/v1/projects/${demo.id}/cards`, list);
  await page.route("**/api/v1/cards/*", one);
  await kit.open(page, at, ".block .end-rule");
  check((await page.evaluate(() => document.getAnimations().length)) === 0, "a returned card's keys are already seated, with no drop");
  const strike = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".margin-key.is-returned")!);
    return `${cs.textDecorationLine} ${cs.textDecorationColor} ${cs.textDecorationThickness}`;
  });
  check(strike === "line-through rgb(26, 26, 26) 2px", `the returned margin key is struck in iron black (${strike})`);
  await kit.shoot(page, "stack-returned");
  await page.locator(".margin .margin-key").nth(1).click();
  await page.locator(".block h1.skill", { hasText: key.skills[1]!.name }).waitFor();
  await settle(page);
  const again = await page.evaluate(() => getComputedStyle(document.querySelector(".margin-key .key-status")!).textDecorationLine);
  check(again === "none", `a key borrowed again isn't struck (${again})`);
  await kit.shoot(page, "stack-borrowed-again");
  await page.unrouteAll();

  // Waiting, then a failure and its retry, with the cards' request held and answered here.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const fail = async (route: Route) => {
    await held;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route(`**/api/v1/projects/${demo.id}/cards`, fail);
  await kit.open(page, at, ".block .is-waiting");
  await kit.shoot(page, "stack-waiting", { plate: false });
  release();
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "stack-error", { plate: false });
  await page.unroute(`**/api/v1/projects/${demo.id}/cards`, fail);

  // A card that fails to come, chosen from the margin: the stack already counts its borrows, so the plate holds.
  const cardFails = (route: Route) => route.fulfill({ status: 500, json: { error: "The server failed." } });
  await page.route(`**/api/v1/cards/${cardB!.id}`, cardFails);
  await kit.open(page, at, ".block .rail");
  await page.locator(".margin .margin-key").nth(1).click();
  await page.locator(".block .error").waitFor();
  const kept = await page.locator(".block .plate b").allTextContents();
  check(kept.join() === String(cardB!.count), `a card that fails to come keeps its plate of ${cardB!.count} (${kept.join() || "none"})`);
  await kit.shoot(page, "stack-card-error", { plate: true });
  await page.unroute(`**/api/v1/cards/${cardB!.id}`, cardFails);

  // The project's other views.
  await kit.open(page, `${at}?view=unsorted`, ".block table.rows");
  await kit.shoot(page, "project-unsorted");
  await kit.open(page, `${at}?view=uploads`, ".block table.rows");
  await kit.shoot(page, "project-uploads");
  await page.getByRole("button", { name: /^Delete the upload of / }).click();
  await page.locator(".block .confirm").waitFor();
  await kit.shoot(page, "project-uploads-confirm");
  const deleteFails = (route: Route) => (route.request().method() === "DELETE" ? route.fulfill({ status: 500, json: { error: "The server failed." } }) : route.fallback());
  await page.route("**/api/v1/uploads/*", deleteFails);
  await page.locator(".block .confirm").getByRole("button", { name: "Delete the upload" }).click();
  await page.locator(".block .confirm .error").waitFor();
  await kit.shoot(page, "project-uploads-delete-failed", { plate: true });
  await page.unroute("**/api/v1/uploads/*", deleteFails);

  // A focused control, from the keyboard, and a pressed one.
  await kit.open(page, at, ".block .rail");
  await settle(page);
  await tabToOpenKey(page);
  const bracket = await page.evaluate(() => {
    const control = document.activeElement!;
    const [before, after] = [getComputedStyle(control, "::before"), getComputedStyle(control, "::after")];
    return { matches: control.matches(":focus-visible"), before: `${before.borderLeftWidth} ${before.borderLeftStyle}`, after: `${after.borderRightWidth} ${after.borderRightStyle}` };
  });
  check(bracket.matches && bracket.before === "2px solid" && bracket.after === "2px solid", `a focused button is bracketed (${JSON.stringify(bracket)})`);
  await kit.shoot(page, "stack-focus");
  const openKey = page.locator(".block").getByRole("link", { name: "Open key A" });
  await openKey.hover();
  await page.mouse.down();
  const pressed = await openKey.evaluate((b) => getComputedStyle(b).backgroundColor);
  check(pressed === GRAY_800, `a pressed button fills one ramp step down (${pressed})`);
  await kit.shoot(page, "stack-pressed");
  // Let go away from it, so the press isn't a click.
  await page.mouse.move(0, 0);
  await page.mouse.up();

  // Widths: the block keeps its measure, and narrow screens move the rail outboard.
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 1080 });
    await kit.open(page, at, ".block .rail");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `no sideways scroll at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, at, ".block .rail");
  await settle(page);
  await kit.shoot(page, "stack-narrow", { fullPage: true });
  const outboard = await page.evaluate(() => {
    const rail = document.querySelector(".rail")!.getBoundingClientRect();
    const key = document.querySelector(".rail-key")!.getBoundingClientRect();
    const phrasing = document.querySelector(".phrasing")!.getBoundingClientRect();
    return key.right <= phrasing.left && key.left - rail.left < 40;
  });
  check(outboard, "on a narrow screen the rail sits outboard of the text, a channel of keys");
  await kit.open(page, `${at}?view=uploads`, ".block table.rows");
  await kit.shoot(page, "project-uploads-narrow", { fullPage: true });
  await page.setViewportSize(FRAME);

  // Reduced motion: the keys are simply in place on the first frame.
  const still = await kit.page({ loggedIn: true, reducedMotion: true });
  await kit.open(still, at, ".block .rail");
  const first = await still.evaluate(() => ({
    animations: document.getAnimations().length,
    inPlace: [...document.querySelectorAll(".rail-key")].every((k) => getComputedStyle(k, "::before").animationName === "none" && k.getBoundingClientRect().height > 0),
  }));
  check(first.animations === 0 && first.inPlace, `reduced motion: no animations and every key in place on the first frame (${first.animations} running)`);
  await still.screenshot({ path: join(kit.out, "stack-reduced-motion.png") });
}
