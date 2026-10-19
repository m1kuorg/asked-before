// The shared guest's own states (m1kuorg/basics#73), on the real pages, in
// a browser of its own signed in as the guest from the log-in page: the
// Desk under the guest's navigation, the upload page's warning before a
// file is chosen and beside the preview, and the settings page's empty
// state, then the warning on a narrow screen. The guest workspace is the
// guest's, so the check's learner is left as it was.

import { join } from "node:path";
import type { Shelf } from "@asked-before/sdk";
import type { Kit } from "../lib/styles";

const DEMO = join(import.meta.dir, "..", "..", "demo", "export.json");

export default async function guest(kit: Kit) {
  const page = await kit.page();
  await kit.open(page, "/login");
  await page.getByRole("button", { name: "Sign in as a guest" }).click();
  await page.waitForURL(/\/app\/desk$/);
  await page.locator(".block table").first().waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await kit.shoot(page, "guest-desk");

  const [demo] = await page.evaluate(async () => ((await (await fetch("/api/v1/shelves")).json()) as { shelves: Shelf[] }).shelves);
  const at = `/app/shelves/${demo!.id}/upload`;
  await kit.open(page, at, ".block .drop-zone");
  await kit.shoot(page, "guest-upload");
  await page.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
  await page.locator(".block").getByRole("button", { name: /^Upload / }).waitFor();
  await kit.shoot(page, "guest-upload-preview");

  await kit.open(page, "/app/settings", ".block .empty");
  await kit.shoot(page, "guest-settings");

  const narrow = await kit.page({ viewport: { width: 390, height: 844 } });
  await narrow.context().addCookies(await page.context().cookies(kit.app.url));
  await kit.open(narrow, at, ".block .drop-zone");
  await kit.shoot(narrow, "guest-upload-narrow", { fullPage: true });
}
