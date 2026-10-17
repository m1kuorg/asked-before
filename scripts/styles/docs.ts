// The docs page's states (public/styles/docs.css; m1kuorg/basics#51), on the
// real page, logged out: the first viewport, the endpoint rows, the setup
// snippets, the whole page, and a narrow screen. It also checks the
// contents stay in the margin, in view, as the block scrolls by, and that
// nothing scrolls sideways at common desktop widths.

import { FRAME, type Kit } from "../lib/styles";

export default async function docs(kit: Kit) {
  const { check } = kit;
  const page = await kit.page();

  await kit.open(page, "/docs", ".docs-endpoint");
  await kit.shoot(page, "docs");

  await page.evaluate(() => document.getElementById("endpoints")!.scrollIntoView({ block: "start" }));
  await kit.shoot(page, "docs-endpoints");
  const contents = await page.evaluate(() => {
    const box = document.querySelector(".docs-contents")!.getBoundingClientRect();
    const block = document.querySelector(".block")!.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, right: box.right, block: block.left };
  });
  check(contents.top >= 0 && contents.bottom <= FRAME.height && contents.right <= contents.block, `the contents stay in the margin, in view, while the block scrolls (top ${contents.top.toFixed(0)}px)`);

  await page.evaluate(() => document.getElementById("mcp")!.scrollIntoView({ block: "start" }));
  await kit.shoot(page, "docs-mcp");
  await kit.shoot(page, "docs-full", { fullPage: true });

  for (const width of [1600, 1440, 1280, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!sideways, `at ${width}px nothing scrolls sideways`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, "/docs", ".docs-endpoint");
  await kit.shoot(page, "docs-narrow", { fullPage: true });
  const flush = await page.evaluate(() => [...document.querySelectorAll(".docs-section > h2, .docs-section > h3")].map((node) => getComputedStyle(node).textAlign));
  check(flush.every((align) => align === "left" || align === "start"), "on a narrow screen every heading sits flush left");
  await page.setViewportSize(FRAME);
}
