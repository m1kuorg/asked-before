// The shell's states (public/styles/shell.css, account.css, shelves.css;
// m1kuorg/basics#42), on the real pages: log in and sign up, each with a
// refusal; the Desk; the shelves list empty, waiting, failed, with
// rows, renaming, and confirming a delete; a shelf; settings; the
// not-found page, public and in the app; a focused navigation item; and the
// account and shelves pages on a narrow screen.

import type { Page, Route } from "playwright";
import { type Kit } from "../lib/styles";

export default async function shell(kit: Kit) {
  const { check, learner } = kit;

  // The public pages.
  const visitor = await kit.page();
  await kit.open(visitor, "/login", "form input");
  await kit.shoot(visitor, "log-in");
  await visitor.getByLabel("Email").fill(learner.email);
  await visitor.getByLabel("Password").fill("the wrong password");
  await visitor.getByRole("button", { name: "Log in" }).click();
  await visitor.locator(".block .error").waitFor();
  await kit.shoot(visitor, "log-in-refused");
  await kit.open(visitor, "/signup", "form input");
  await kit.shoot(visitor, "sign-up");
  await visitor.getByLabel("Name").fill("Bea Example");
  await visitor.getByLabel("Email").fill("bea@example.com");
  await visitor.getByLabel("Password").fill("too short");
  await visitor.getByRole("button", { name: "Sign up" }).click();
  await visitor.locator(".block .error").waitFor();
  await kit.shoot(visitor, "sign-up-refused");
  await kit.open(visitor, "/no-such-page", ".block h1");
  await kit.shoot(visitor, "not-found");

  // The app.
  const page = await kit.page({ loggedIn: true });
  await kit.open(page, "/app/desk", ".block h1");
  await kit.shoot(page, "desk");
  await fontsOf(kit, page, ["body > nav .nav-item", ".nav-account", ".block h1", ".block p"]);

  await kit.open(page, "/app/shelves", ".block .empty");
  await kit.shoot(page, "shelves-empty");

  // Waiting, then a failure and its retry, with the list's request held and answered here, never in the app.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const hold = async (route: Route) => {
    await held;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route("**/api/v1/shelves", hold);
  await page.goto(new URL("/app/shelves", kit.app.url).href);
  await page.locator(".block .is-waiting").waitFor();
  await kit.shoot(page, "shelves-waiting");
  release();
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "shelves-failed");
  await page.unroute("**/api/v1/shelves", hold);

  const work = await learner.client.shelves.create({ name: "Work" });
  await learner.client.shelves.create({ name: "Bootcamp: evening classes in data analysis at the community college", demo: true });
  await learner.client.shelves.create({ name: "Side shelves" });
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator("table.rows").waitFor();
  check((await page.locator("table.rows tbody tr").count()) === 3, "after the retry, the list holds the three shelves");
  await kit.shoot(page, "shelves");
  await fontsOf(kit, page, ["table.rows th", "table.rows td.is-numeric", ".row-title a", ".field > label"]);

  await page.getByRole("button", { name: "Rename Work" }).click();
  await kit.shoot(page, "shelves-rename");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete Side shelves" }).click();
  await page.locator(".confirm").waitFor();
  await kit.shoot(page, "shelves-confirm");

  // The navigation, from the keyboard.
  await kit.open(page, "/app/shelves", "table.rows");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({ text: document.activeElement?.textContent, visible: document.activeElement?.matches(":focus-visible") }));
  check(focused.text === "Shelves" && focused.visible === true, `the third tab stop is the current Shelves item, ringed (${JSON.stringify(focused)})`);
  await kit.shoot(page, "nav-focus");

  await kit.open(page, `/app/shelves/${work.id}`, ".block .empty");
  await kit.shoot(page, "shelf");
  await kit.open(page, "/app/settings", ".block h1");
  await kit.shoot(page, "settings");
  await kit.open(page, "/app/no-such-screen", ".block h1");
  await kit.shoot(page, "app-not-found");

  // Narrow screens.
  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, "/app/shelves", "table.rows");
  await kit.shoot(page, "shelves-narrow", { fullPage: true });
  await visitor.setViewportSize({ width: 390, height: 844 });
  await kit.open(visitor, "/signup", "form input");
  await kit.shoot(visitor, "sign-up-narrow", { fullPage: true });
}

/** Checks that each selector's text renders in the self-hosted face. */
async function fontsOf(kit: Kit, page: Page, selectors: string[]) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  for (const selector of selectors) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    kit.check(
      fonts.length > 0 && fonts.every((f) => f.familyName === "Hanken Grotesk" && f.isCustomFont),
      `${selector} renders in the self-hosted Hanken Grotesk (${fonts.map((f) => f.familyName).join(", ")})`,
    );
  }
  await cdp.detach();
}
