// The shared parts' states (public/styles/parts.css; m1kuorg/basics#42),
// drawn by the parts' own code (scripts/lib/parts-sample.ts, bundled here
// and run in the app's page): form fields with a hint, a failure notice, a
// locked field, and a disabled button; rows with a delete confirmation and
// an empty state; and the wells, the drop zone (idle and with a file held
// over it) and code blocks.

import { join } from "node:path";
import { SAMPLE_PATH, type Kit } from "../lib/styles";

export default async function parts(kit: Kit) {
  const { check } = kit;
  const build = await Bun.build({ entrypoints: [join(import.meta.dir, "..", "lib", "parts-sample.ts")], target: "browser" });
  if (!build.success) throw new AggregateError(build.logs, "The parts sample didn't build.");
  const bundle = await build.outputs[0]!.text();

  const page = await kit.page({ loggedIn: true, bypassCSP: true });
  await kit.open(page, SAMPLE_PATH, ".block h1");
  await page.addScriptTag({ content: bundle, type: "module" });
  await page.waitForFunction(() => typeof window.showSample === "function");
  const show = async (name: string) => {
    await page.evaluate((sample) => window.showSample(sample), name);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  };

  await show("forms");
  await page.locator(".field-row .error").waitFor();
  check((await page.locator(".block .error").count()) === 2, "a refused form shows its notice: in a column above the button, in a row under it");
  const described = await page.getByLabel("New password").evaluate((input) => ({
    invalid: input.getAttribute("aria-invalid"),
    by: (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent),
  }));
  check(
    described.invalid === "true" && described.by.join(" | ") === "At least 10 characters. | A password needs at least 10 characters.",
    `the field the refusal names is marked, and described by its hint and the notice: ${JSON.stringify(described)}`,
  );
  await kit.shoot(page, "parts-forms");
  await page.getByLabel("Email").focus();
  await kit.shoot(page, "parts-forms-focus");

  await show("rows");
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  check(focused === "Keep it", `a confirmation starts on the safe choice: "${focused}"`);
  await kit.shoot(page, "parts-rows");
  await page.getByRole("button", { name: "Revoke Old desktop" }).click();
  await page.locator(".confirm .error").waitFor();
  await kit.shoot(page, "parts-rows-refused");

  await show("wells");
  await kit.shoot(page, "parts-wells");
  await page.locator(".drop-zone").dispatchEvent("dragenter");
  check(await page.locator(".drop-zone.is-over").isVisible(), "a file held over the drop zone fills it");
  await kit.shoot(page, "parts-wells-over");
  await page.locator(".drop-zone").dispatchEvent("dragleave");
  await page.keyboard.press("Tab");
  check(await page.locator(".drop-zone:focus-within").isVisible(), "the drop zone takes focus from the keyboard");
  await kit.shoot(page, "parts-wells-focus");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["forms", "rows", "wells"]) {
    await show(name);
    await kit.shoot(page, `parts-${name}-narrow`, { fullPage: true });
  }
}
