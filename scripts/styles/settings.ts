// Settings' states (public/styles/settings.css; m1kuorg/basics#48), on the
// real page: the profile and password, a refused profile and a refused
// password, API keys empty, waiting, failed, a new key shown once under its
// row, a revoke being confirmed, the setup snippets, and the page on a narrow
// screen. It makes keys for the check's learner, and changes nothing else
// about the account, so the other surfaces' modules find it as it was.

import type { Route } from "playwright";
import { type Kit } from "../lib/styles";

export default async function settings(kit: Kit) {
  const { check } = kit;
  const page = await kit.page({ loggedIn: true });
  const section = (name: string) => page.locator("section", { has: page.getByRole("heading", { name, exact: true }) });

  await kit.open(page, "/app/settings", ".block .empty");
  await kit.shoot(page, "settings-profile");

  const profile = section("Profile");
  await profile.getByLabel("Email", { exact: true }).fill("not an email");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await profile.locator(".error").waitFor();
  await kit.shoot(page, "settings-profile-refused");

  const password = section("Password");
  await password.getByLabel("Current password").fill("the wrong password");
  await password.getByLabel("New password").fill("a new and longer password");
  await password.getByRole("button", { name: "Change password" }).click();
  await password.locator(".error").waitFor();
  await password.scrollIntoViewIfNeeded();
  await kit.shoot(page, "settings-password-refused");

  // Waiting, then a failure and its retry, with the keys' request held and answered here, never in the app.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const hold = async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await held;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route("**/api/v1/keys", hold);
  await kit.open(page, "/app/settings", ".key-list .is-waiting");
  const keys = section("API keys");
  await keys.scrollIntoViewIfNeeded();
  await kit.shoot(page, "settings-keys-waiting");
  release();
  await keys.locator(".error").waitFor();
  await kit.shoot(page, "settings-keys-failed");
  await page.unroute("**/api/v1/keys", hold);
  await keys.getByRole("button", { name: "Try again" }).click();
  await keys.locator(".empty").waitFor();
  await kit.shoot(page, "settings-keys-empty");

  for (const name of ["Laptop", "Claude Code"]) {
    await keys.getByLabel("Key name").fill(name);
    await keys.getByRole("button", { name: "Create key" }).click();
    await keys.locator("table.rows tbody tr", { hasText: name }).first().waitFor();
  }
  await keys.locator(".key-shown").waitFor();
  check((await keys.locator(".key-shown").count()) === 1, "only the newest key is shown, under its row");
  await keys.scrollIntoViewIfNeeded();
  await kit.shoot(page, "settings-key-shown");

  await keys.getByRole("button", { name: "Revoke Laptop" }).click();
  await keys.locator(".confirm").waitFor();
  await kit.shoot(page, "settings-key-revoke");

  const agents = section("Connect an agent");
  await agents.evaluate((node) => node.scrollIntoView({ block: "start" }));
  await kit.shoot(page, "settings-agents");
  await agents.locator(".code-block").last().scrollIntoViewIfNeeded();
  await kit.shoot(page, "settings-agents-end");

  await page.setViewportSize({ width: 390, height: 844 });
  await kit.open(page, "/app/settings", "table.rows");
  await kit.shoot(page, "settings-narrow", { fullPage: true });
}
