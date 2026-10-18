// Checks the upload page (m1kuorg/basics#43) in a real browser at 1920×1080,
// on a fresh copy of the app. It shows how to request each export; a file
// chosen through its input is read on the page, and its preview counts your
// own messages and the ones skipped, with the privacy line, before anything
// is sent. Uploading the demo export stores 27 phrasings, which the page
// watches being sorted, and uploading it again stores none; a Claude export and a sharded zip upload too, and a
// file that can't be read says what's wrong with it, naming the field, and
// sends nothing. Every request the page makes is intercepted: the phrasings
// it sends are only { sourceId, text, time }, with no assistant words and no
// titles. Sending shows its progress, and a failed chunk (stubbed in this
// script, never in the app) shows the error and a retry that finishes the
// same upload. A new learner's demo action makes a shelf flagged demo and
// uploads the demo export onto it. The app's model is a stand-in in this
// script, answering as the demo export's answer key does (the sort's own
// states are check:sort-page's). Each step is checked again through the
// SDK, saves a screenshot, and prints its checks; it exits 1 if any fails,
// naming the step.
// Run: bun run check:upload-page [screenshot dir]

import { readExport, type Shelf, type Upload } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page, type Request } from "playwright";
import { PRIVACY_LINE } from "../src/parts/library";
import { keySorter } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-upload-page");
const ROOT = join(import.meta.dir, "..");
const FIXTURES = join(ROOT, "packages", "sdk", "fixtures");
const DEMO = join(ROOT, "demo", "export.json");
const FRAME = { width: 1920, height: 1080 };

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const browser = await chromium.launch();

/** A logged-in page for a new learner, watching every request it sends to the API and every console error. */
async function learnerPage(email: string) {
  const learner = app.browser();
  await learner.client.auth.signUp({ name: "Ada Lovelace", email, password: "analytical engine" });
  const context: BrowserContext = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const cookies = learner.cookie().split("; ").map((pair) => pair.split("="));
  await context.addCookies(cookies.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const sent: Request[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin === app.url) sent.push(request);
  });
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { learner, page, sent, errors };
}

const ada = await learnerPage("ada@example.com");
const { page } = ada;

async function step(name: string, run: () => Promise<void>, on: Page = page) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  await on.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

const uploadsSent = (requests: Request[]) => requests.filter((r) => new URL(r.url()).pathname.match(/^\/api\/v1\/(shelves\/[^/]+\/uploads|uploads\/)/) && r.method() === "POST");
const text = async (selector: string, on: Page = page) => ((await on.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const plate = (on: Page = page) => text(".block .plate b", on);
const latest = async (learner: Learner, shelf: Shelf): Promise<Upload> => (await learner.client.uploads.list(shelf.id, { limit: 1 })).uploads[0]!;

/** Opens the shelf's upload page and chooses a file through the drop zone's input, as a learner would. */
async function choose(shelf: Shelf, file: string | { name: string; mimeType: string; buffer: Buffer }, on: Page = page) {
  await on.goto(`${app.url}/app/shelves/${shelf.id}/upload`);
  await on.locator(".drop-zone input[type=file]").setInputFiles(file);
}

const uploadButton = (on: Page = page) => on.locator(".block").getByRole("button", { name: /^Upload \d+ (message|messages)$/ });

let work: Shelf;

try {
  await step("1. The upload page says how to request each export, and reads nothing yet", async () => {
    work = await ada.learner.client.shelves.create({ name: "Work" });
    await page.goto(`${app.url}/app/shelves/${work.id}/upload`);
    await page.locator(".drop-zone").waitFor();
    check((await text(".block h1")) === "Upload a chat export", `headed "${await text(".block h1")}"`);
    check((await text(".block")).includes("Into Work"), "it names the shelf it uploads into");
    const margin = await text(".margin");
    check(/ChatGPT/.test(margin) && /Data controls/.test(margin) && /Claude/.test(margin) && /Privacy/.test(margin) && /Export data/.test(margin), "the margin says where ChatGPT and Claude keep Export data");
    check((await text(".block .privacy-line")) === PRIVACY_LINE, "the privacy line is shown");
    const input = page.locator(".drop-zone input[type=file]");
    check((await input.getAttribute("accept"))?.includes(".zip") === true && (await input.getAttribute("accept"))?.includes(".json") === true, `the input takes ${await input.getAttribute("accept")}`);
  });

  await step("2. The demo export's preview: 27 of your own messages, and nothing sent", async () => {
    await choose(work, DEMO);
    await uploadButton().waitFor();
    check((await plate()) === "27", `the plate counts ${await plate()}`);
    check((await text(".block .plate span")) === "of your own messages", `captioned "${await text(".block .plate span")}"`);
    check((await text(".block")).includes("ChatGPT"), "it says the export came from ChatGPT");
    check((await text(".block .privacy-line")) === PRIVACY_LINE, "with the privacy line");
    check((await uploadButton().textContent()) === "Upload 27 messages", `the button says "${await uploadButton().textContent()}"`);
    check(uploadsSent(ada.sent).length === 0, `nothing was sent to the uploads endpoints yet (${uploadsSent(ada.sent).length} requests)`);
  });

  await step("3. Upload it: 27 phrasings, which the page watches being sorted", async () => {
    await uploadButton().click();
    await page.locator(".block .upload-done").waitFor();
    const upload = await latest(ada.learner, work);
    check(upload.phrasings === 27 && upload.messages === 27 && upload.status !== "receiving" && upload.source === "chatgpt", `the API has ${upload.phrasings} new phrasings of ${upload.messages}, ${upload.status}, from ${upload.source}`);
    check(new URL(page.url()).searchParams.get("upload") === upload.id, `the page now shows that upload (${new URL(page.url()).search})`);
    check((await plate()) === "27" && (await text(".block .plate span")) === "new phrasings", `the plate says ${await plate()} ${await text(".block .plate span")}`);
    await page.locator(".block .upload-done p", { hasText: /^They're sorted into Work's cards\.$/ }).waitFor();
    check(true, "and says they're sorted into Work's cards once the sort ends");
    await page.reload();
    await page.locator(".block .upload-done").waitFor();
    check((await plate()) === "27" && (await ada.learner.client.uploads.list(work.id)).uploads.length === 1, "reloading shows the same upload and sends nothing again");
  });

  await step("4. Upload the same export again: none new", async () => {
    await choose(work, DEMO);
    await uploadButton().click();
    await page.locator(".block .upload-done").waitFor();
    const upload = await latest(ada.learner, work);
    check(upload.messages === 27 && upload.phrasings === 0, `the API has ${upload.phrasings} new of ${upload.messages}`);
    check((await plate()) === "0" && /already/.test(await text(".block")), `the page says ${await plate()} new, all there already`);
  });

  await step("5. A Claude export uploads, with its long message skipped", async () => {
    await choose(work, join(FIXTURES, "claude.json"));
    await uploadButton().waitFor();
    check((await plate()) === "3" && (await text(".block")).includes("Claude"), `the preview counts ${await plate()} from Claude`);
    check(/1 more .*2,000 characters/.test(await text(".block")), "and says 1 more ran over 2,000 characters and stays here");
    await uploadButton().click();
    await page.locator(".block .upload-done").waitFor();
    const upload = await latest(ada.learner, work);
    check(upload.source === "claude" && upload.phrasings === 3 && upload.fileName === "claude.json", `the API has ${upload.phrasings} new from ${upload.source}, ${upload.fileName}`);
  });

  await step("6. A ChatGPT zip in numbered shards uploads", async () => {
    await choose(work, join(FIXTURES, "chatgpt-sharded.zip"));
    await uploadButton().waitFor();
    check((await plate()) === "4", `the preview counts ${await plate()}`);
    await uploadButton().click();
    await page.locator(".block .upload-done").waitFor();
    const upload = await latest(ada.learner, work);
    check(upload.phrasings === 4 && upload.fileName === "chatgpt-sharded.zip", `the API has ${upload.phrasings} new from ${upload.fileName}`);
  });

  await step("7. A file that can't be read says why, naming the field, and sends nothing", async () => {
    const before = uploadsSent(ada.sent).length;
    const broken = await Bun.file(DEMO).json();
    delete broken[2].mapping;
    await choose(work, { name: "conversations.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(broken)) });
    await page.locator(".block .error").waitFor();
    const said = await text(".block .error");
    check(/Conversation 3/.test(said) && /mapping/.test(said), `it says "${said}"`);
    check(await page.locator(".drop-zone").isVisible(), "and offers the drop zone again");
    await choose(work, { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) });
    await page.locator(".block .error").waitFor();
    check(/JSON|zip/.test(await text(".block .error")), `a picture says "${await text(".block .error")}"`);
    check(uploadsSent(ada.sent).length === before, "nothing was sent");
  });

  await step("8. Sending shows its progress; a failed chunk shows the error and a retry that finishes the same upload", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let failed = false;
    await page.route("**/api/v1/uploads/*/phrasings", async (route) => {
      await held;
      if (!failed) {
        failed = true;
        return route.fulfill({ status: 500, json: { error: "The server failed." } });
      }
      return route.continue();
    });
    const bootcamp = await ada.learner.client.shelves.create({ name: "Bootcamp" });
    await choose(bootcamp, DEMO);
    await uploadButton().click();
    await page.locator(".block .is-waiting").waitFor();
    check(/Sending your messages/.test(await text(".block .is-waiting")) && (await plate()) === "27", `while it sends: "${await text(".block .is-waiting")}", the plate still ${await plate()}`);
    await page.screenshot({ path: join(OUT, `${shot + 1}-sending.png`) });
    release();
    await page.locator(".block .error").waitFor();
    check((await text(".block .error")) === "The server failed.", `a failed chunk says "${await text(".block .error")}"`);
    await page.screenshot({ path: join(OUT, `${shot + 1}-failed.png`) });
    await page.locator(".block").getByRole("button", { name: "Try again" }).click();
    await page.locator(".block .upload-done").waitFor();
    await page.unrouteAll();
    const { uploads } = await ada.learner.client.uploads.list(bootcamp.id);
    check(uploads.length === 1 && uploads[0]!.phrasings === 27 && uploads[0]!.status !== "receiving", `Bootcamp has ${uploads.length} upload, ${uploads[0]?.phrasings} new, ${uploads[0]?.status}`);
  });

  await step("9. The page sent only { sourceId, text, time } phrasings: no assistant words, no titles", async () => {
    const demo: any[] = await Bun.file(DEMO).json();
    const others = demo.flatMap((c) =>
      Object.values<any>(c.mapping).flatMap((n) => (n.message && n.message.author.role !== "user" ? (n.message.content.parts ?? []).filter((p: unknown) => typeof p === "string" && p.length > 20) : [])),
    );
    const demoRead = await readExport(Bun.file(DEMO));
    // A title that repeats your own words, such as "HTTP 418", can't tell a leak from a phrasing, so only the others are looked for.
    const titles = demo.map((c) => c.title as string).filter((title) => !demoRead.phrasings.some((p) => p.text.includes(title)));
    const appends = uploadsSent(ada.sent).filter((r) => r.url().endsWith("/phrasings"));
    const bodies = appends.map((r) => r.postDataJSON() as { phrasings: Record<string, unknown>[] });
    const shapes = bodies.every((b) => Object.keys(b).join() === "phrasings" && b.phrasings.every((p) => Object.keys(p).sort().join() === "sourceId,text,time"));
    check(appends.length >= 6 && shapes, `${appends.length} chunks sent, each { phrasings: [{ sourceId, text, time }] }`);
    const everything = ada.sent.map((r) => r.postData() ?? "").join("\n");
    const leaked = [...others, ...titles].filter((words) => everything.includes(JSON.stringify(words).slice(1, -1)));
    check(leaked.length === 0, `no assistant, system, or tool words and no titles in any request (${others.length} answers and ${titles.length} titles looked for)${leaked.length ? `: ${leaked.length} found` : ""}`);
    const sentIds = new Set(bodies.flatMap((b) => b.phrasings.map((p) => p.sourceId)));
    check(demoRead.phrasings.every((p) => sentIds.has(p.sourceId)), "every phrasing sent carries its export's own message id");
    const outside = ada.sent.filter((r) => !new URL(r.url()).pathname.startsWith("/api/v1/") && r.resourceType() === "fetch");
    check(outside.length === 0, `the page fetched nothing outside /api/v1 for a learner's own file (${outside.map((r) => new URL(r.url()).pathname).join(", ") || "none"})`);
    check(ada.errors.length === 0, `no console errors or policy violations${ada.errors.length ? `: ${ada.errors.slice(0, 3).join(" | ")}` : ""}`);
  });

  const bea = await learnerPage("bea@example.com");
  await step(
    "10. A new learner's demo action makes a demo shelf and uploads the demo export onto it",
    async () => {
      await bea.page.goto(`${app.url}/app/shelves`);
      await bea.page.locator(".block .empty").getByRole("button", { name: "Try the demo shelf" }).click();
      await bea.page.locator(".block .upload-done").waitFor();
      const [demoShelf] = await bea.learner.client.shelves.list();
      check(demoShelf?.demo === true, `made "${demoShelf?.name}", flagged demo: ${demoShelf?.demo}`);
      check(new URL(bea.page.url()).pathname === `/app/shelves/${demoShelf!.id}/upload`, `and went to its upload page: ${new URL(bea.page.url()).pathname}`);
      check(await bea.page.locator(".block .demo-label").isVisible(), "labeled as demo data");
      const upload = await latest(bea.learner, demoShelf!);
      check(upload.phrasings === 27 && upload.source === "chatgpt" && upload.status !== "receiving", `its upload has ${upload.phrasings} new phrasings, ${upload.status}`);
      const appends = uploadsSent(bea.sent).filter((r) => r.url().endsWith("/phrasings"));
      check(appends.every((r) => (r.postDataJSON() as { phrasings: object[] }).phrasings.every((p) => Object.keys(p).sort().join() === "sourceId,text,time")), "through the same endpoints, with the same shape");
      check(bea.errors.length === 0, `no console errors${bea.errors.length ? `: ${bea.errors.slice(0, 3).join(" | ")}` : ""}`);
    },
    bea.page,
  );
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
