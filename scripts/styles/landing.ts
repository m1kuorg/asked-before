// The landing page's states (public/styles/landing.css; m1kuorg/basics#52),
// on the real page, logged out: the first viewport with card A's keys
// seated, the whole page, the close's sign-up form refusing a weak password,
// and a narrow screen. It also checks the key drop runs in date order, the
// whole rail closes inside the 1080 frame, the plate overlaps only the
// block's padding, every side-note sits in the margin level with its section
// and clear of the next, nothing scrolls sideways at common desktop widths,
// and on a narrow screen the phrasings come before the card's side-note.

import type { Page } from "playwright";
import { FRAME, type Kit } from "../lib/styles";

const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

export default async function landing(kit: Kit) {
  const { check } = kit;
  const page = await kit.page();

  // The key drop: one per key, in date order across the year cut, settled within a second.
  await kit.open(page, "/", ".block .rail");
  const drops = await page.evaluate(() => {
    const keys = [...document.querySelectorAll(".rail-key")];
    const timings = document.getAnimations().map((a) => ({ key: keys.indexOf((a.effect as KeyframeEffect).target as Element), delay: Number(a.effect!.getComputedTiming().delay), end: Number(a.effect!.getComputedTiming().endTime) }));
    return { keys: keys.length, timings: timings.sort((a, b) => a.key - b.key) };
  });
  check(drops.timings.length === drops.keys && drops.keys === 9, `one drop for each of card A's ${drops.keys} keys (${drops.timings.length} drops)`);
  check(drops.timings.every((t, i) => i === 0 || t.delay > drops.timings[i - 1]!.delay), `keys drop in date order across the year cut (delays ${drops.timings.map((t) => t.delay).join(", ")}ms)`);
  check(Math.max(...drops.timings.map((t) => t.end)) <= 1000, "every key is seated within a second");
  await settle(page);
  await kit.shoot(page, "landing");
  const foot = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".rail")].map((rail) => rail.getBoundingClientRect().bottom)));
  check(foot <= FRAME.height, `the whole rail, all nine keys and its foot, closes inside the 1080 frame (at ${foot.toFixed(0)}px)`);

  // Where things hang: the plate over the block's padding, each side-note in the margin, level with its section.
  const placed = await page.evaluate(() => {
    const block = document.querySelector(".block")!.getBoundingClientRect();
    const plate = document.querySelector(".landing-card > .plate")!.getBoundingClientRect();
    const name = document.querySelector(".landing-card .skill")!.getBoundingClientRect();
    const notes = [...document.querySelectorAll(":is(.landing-card, .landing-section) > .margin")].map((note) => {
      const box = note.getBoundingClientRect();
      const section = note.parentElement!.getBoundingClientRect();
      const text = note.firstElementChild!.getBoundingClientRect();
      return { right: text.right, left: text.left, offset: Math.abs(box.top - section.top - 1) };
    });
    return { block: { left: block.left, right: block.right }, plate: { left: plate.left, top: plate.top }, name: name.top, notes };
  });
  const overlap = placed.block.right - placed.plate.left;
  check(overlap > 0 && overlap <= 40, `the plate overlaps only the block's 40px padding (${overlap.toFixed(0)}px)`);
  check(Math.abs(placed.plate.top - placed.name) <= 1, "the plate hangs level with the card's name");
  check(
    placed.notes.length === 5 && placed.notes.every((n) => n.right <= placed.block.left - 32 && n.left >= 39 && n.offset <= 1),
    `the five side-notes sit in the margin, level with their sections (${placed.notes.map((n) => `${n.left.toFixed(0)}–${n.right.toFixed(0)}`).join(", ")})`,
  );
  await kit.shoot(page, "landing-full", { fullPage: true });

  // The close's form refuses a weak password, in place.
  const close = page.locator(".landing-close");
  await close.getByLabel("Name").fill("Bea Example");
  await close.getByLabel("Email").fill("bea@example.com");
  await close.getByLabel("Password").fill("too short");
  await close.getByRole("button", { name: "Sign up" }).click();
  await close.locator(".error").waitFor();
  await close.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await kit.shoot(page, "landing-refused");

  // Common desktop widths keep the margin and the plate, and nothing scrolls sideways.
  for (const width of [1600, 1440, 1280, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const at = await page.evaluate(() => {
      const block = document.querySelector(".block")!.getBoundingClientRect();
      const notes = [...document.querySelectorAll(":is(.landing-card, .landing-section) > .margin")].map((note) => {
        const lines = [...note.children].map((p) => p.getBoundingClientRect());
        return { left: Math.min(...lines.map((r) => r.left)), right: Math.max(...lines.map((r) => r.right)), top: lines[0]!.top, bottom: lines.at(-1)!.bottom };
      });
      return {
        sideways: document.documentElement.scrollWidth > window.innerWidth,
        inMargin: notes.every((n) => n.left >= 0 && n.right <= block.left),
        apart: notes.every((n, i) => i === 0 || n.top - notes[i - 1]!.bottom >= 16),
      };
    });
    check(!at.sideways && at.inMargin && at.apart, `at ${width}px nothing scrolls sideways, and the side-notes stay in the margin, clear of one another (${JSON.stringify(at)})`);
  }

  // A narrow screen: one column, with the plate and the side-notes in flow.
  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, "/", ".block .rail");
  await settle(page);
  await kit.shoot(page, "landing-narrow", { fullPage: true });
  const order = await page.evaluate(() => {
    const rails = [...document.querySelectorAll(".landing-card > .rail")].map((rail) => rail.getBoundingClientRect().bottom);
    return { rail: Math.max(...rails), note: document.querySelector(".landing-card > .margin")!.getBoundingClientRect().top };
  });
  check(order.note > order.rail, "on a narrow screen the phrasings come before the card's side-note");
  await page.setViewportSize(FRAME);
}
