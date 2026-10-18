// The upload page's states (public/styles/upload.css; m1kuorg/basics#43), on
// the real page: waiting for the project, and failing to get it (its request
// held and answered here), with no plate, since nothing is counted yet; the
// drop zone with the instructions in the margin; a
// Claude export's preview, with a message skipped for length; sending, and
// a failed chunk with its retry (the chunk held and answered here, never in
// the app); the finished upload, and its sort under way, failed with a
// retry, and done (the upload's own answer rewritten here, never in the
// app; m1kuorg/basics#44), every one of them keeping the plate of what it
// counts; a file that can't be read, with no plate, since it counts nothing;
// and the preview on a narrow screen.

import { join } from "node:path";
import type { Upload } from "@asked-before/sdk";
import type { Route } from "playwright";
import type { Kit } from "../lib/styles";

const ROOT = join(import.meta.dir, "..", "..");
const CLAUDE = join(ROOT, "packages", "sdk", "fixtures", "claude.json");
const DEMO = join(ROOT, "demo", "export.json");

export default async function upload(kit: Kit) {
  const { check, learner } = kit;
  const project = await learner.client.projects.create({ name: "Bootcamp" });
  const at = `/app/projects/${project.id}/upload`;
  const page = await kit.page({ loggedIn: true });
  const uploadButton = page.locator(".block").getByRole("button", { name: /^Upload / });

  // Waiting for the project, then failing to get it, with its request held and answered here.
  let releaseProject = () => {};
  const projectHeld = new Promise<void>((resolve) => (releaseProject = resolve));
  const projectFails = async (route: Route) => {
    await projectHeld;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route(`**/api/v1/projects/${project.id}`, projectFails);
  await kit.open(page, at, ".block .is-waiting");
  await kit.shoot(page, "upload-waiting", { plate: false });
  releaseProject();
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "upload-load-failed", { plate: false });
  await page.unroute(`**/api/v1/projects/${project.id}`, projectFails);

  await kit.open(page, at, ".drop-zone");
  await kit.shoot(page, "upload");

  await page.locator(".drop-zone input[type=file]").setInputFiles(CLAUDE);
  await uploadButton.waitFor();
  await kit.shoot(page, "upload-preview");

  // Sending, then a failed chunk, with the chunk's request held and answered here.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const fail = async (route: Route) => {
    await held;
    await route.fulfill({ status: 500, json: { error: "The server failed." } });
  };
  await page.route("**/api/v1/uploads/*/phrasings", fail);
  await uploadButton.click();
  await page.locator(".block .is-waiting").waitFor();
  await kit.shoot(page, "upload-sending", { plate: true });
  release();
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "upload-failed", { plate: true });
  await page.unroute("**/api/v1/uploads/*/phrasings", fail);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator(".block .upload-done").waitFor();
  await kit.shoot(page, "upload-done");
  const [sent] = (await learner.client.uploads.list(project.id)).uploads;
  check(sent?.phrasings === 3, `the retried upload holds ${sent?.phrasings} phrasings`);

  // The sort's states: the page reads the upload as each one, whatever the real sort is doing.
  const as = async (state: Partial<Upload>, name: string, selector: string, plate?: boolean) => {
    const pattern = `**/api/v1/uploads/${sent!.id}`;
    await page.route(pattern, async (route) => route.fulfill({ json: { ...(await (await route.fetch()).json()), ...state } }));
    await kit.open(page, `${at}?upload=${sent!.id}`, selector);
    await kit.shoot(page, name, { plate });
    await page.unroute(pattern);
  };
  await as({ status: "sorting", offered: 1 }, "upload-sorting", ".block .is-waiting", true);
  await as({ status: "failed", offered: 1, error: "The model request failed (502)." }, "upload-sort-failed", ".block .error", true);
  await as({ status: "sorted", offered: 3, error: null }, "upload-sorted", ".block .upload-done p + p");

  await kit.open(page, at, ".drop-zone");
  await page.locator(".drop-zone input[type=file]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
  await page.locator(".block .error").waitFor();
  await kit.shoot(page, "upload-unreadable", { plate: false });

  const narrow = await kit.page({ loggedIn: true, viewport: { width: 390, height: 844 } });
  await kit.open(narrow, at, ".drop-zone");
  await narrow.locator(".drop-zone input[type=file]").setInputFiles(DEMO);
  await narrow.locator(".block").getByRole("button", { name: /^Upload / }).waitFor();
  await kit.shoot(narrow, "upload-narrow", { fullPage: true });
}
