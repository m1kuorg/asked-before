// Checks the upload page (m1kuorg/basics#43) in a real browser at 1920×1080,
// on a fresh copy of the app. It shows how to request each export; a file
// chosen through its input is read on the page, and its preview counts your
// own messages and the ones skipped, and says row by row what leaves this
// computer, with the privacy line, before anything is sent. Uploading the
// demo export stores 27 new messages, which the page watches being sorted,
// and uploading it again stores none; a Claude export and a sharded zip
// upload too, and a file the reader can't read, for each of the reader's
// reasons, says why in the reader's own words, naming the field, and sends
// nothing. Every request the page makes is intercepted: the messages it
// sends are only { sourceId, text, time }, with no assistant words and no
// titles. Sending shows its progress, and a failed chunk (stubbed in this
// script, never in the app) shows the error and a retry that finishes the
// same upload. A new learner's demo action makes a shelf flagged demo and
// uploads the demo export onto it, with the privacy line in view and no
// preview. The app's model is a stand-in in this script, answering as the
// demo export's answer key does (the sort's own states are
// check:sort-page's). Each step is checked again through the SDK, saves a
// screenshot, and prints its checks; it exits 1 if any fails, naming the
// step.
// Run: bun run check:upload-page [screenshot dir]

import { ExportError, readExport, type Shelf, type Upload } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page, type Request } from "playwright";
import { CONTENT_SECURITY_POLICY } from "../server/security";
import { PRIVACY_LINE } from "../src/lib/copy";
import { keySorter } from "./lib/answer-key";
import { startApp, type Browser as Learner } from "./lib/app";
import { reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-upload-page");
const ROOT = join(import.meta.dir, "..");
const FIXTURES = join(ROOT, "packages", "sdk", "fixtures");
const DEMO = join(ROOT, "demo", "export.json");
const FRAME = { width: 1920, height: 1080 };

/** The drop target's file input (a button to assistive technology), named by its title and its "Choose a file". */
const INPUT_NAME = "Drop your chat export here Choose a file";
/** The preview's table, named by its caption. */
const LEAVES_TABLE = "What leaves this computer, and what the model sees";

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
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
const main = (on: Page = page) => on.getByRole("main");
const alerts = (on: Page = page) => main(on).getByRole("alert");
/** What a locator shows, its whitespace collapsed. */
const words = async (locator: Locator) => ((await locator.first().innerText()) ?? "").replace(/\s+/g, " ").trim();
/** One of the step's h2s, such as "27 of your own messages" in the preview or "27 new messages" once sent. */
const headline = (name: string | RegExp, on: Page = page) => main(on).getByRole("heading", { level: 2, name, exact: true });
const fileInput = (on: Page = page) => main(on).getByRole("button", { name: INPUT_NAME, exact: true });
const uploadButton = (on: Page = page) => main(on).getByRole("button", { name: /^Upload \d+ (message|messages)$/ });
/** The sent upload's page, which closes every state of its sort with this link. */
const watching = (on: Page = page) => main(on).getByRole("link", { name: "Upload another export", exact: true });
const latest = async (learner: Learner, shelf: Shelf): Promise<Upload> => (await learner.client.uploads.list(shelf.id, { limit: 1 })).uploads[0]!;

/** Waits for `success`, or fails at once with what the page's alert says. */
async function outcome(success: Locator, on: Page = page) {
  await success.or(alerts(on)).first().waitFor();
  if (!(await success.first().isVisible())) throw new Error(`the page says "${await words(alerts(on))}"`);
}

/** Opens the shelf's upload page and chooses a file through the drop target's input, as a learner would. */
async function choose(shelf: Shelf, file: string | { name: string; mimeType: string; buffer: Buffer }, on: Page = page) {
  await on.goto(`${app.url}/app/shelves/${shelf.id}/upload`);
  await fileInput(on).setInputFiles(file);
}

/** The preview table's rows, each as its visible cells joined by " | ". */
async function leaves(on: Page = page): Promise<string[]> {
  const rows = await main(on).getByRole("table", { name: LEAVES_TABLE, exact: true }).getByRole("row").all();
  const cells = await Promise.all(rows.map(async (row) => (await row.getByRole("cell").allInnerTexts()).map((cell) => cell.replace(/\s+/g, " ").trim())));
  return cells.filter((row) => row.length).map((row) => row.join(" | "));
}

let work: Shelf;

try {
  await step("1. The upload page says how to request each export, and reads nothing yet", async () => {
    work = await ada.learner.client.shelves.create({ name: "Work" });
    await page.goto(`${app.url}/app/shelves/${work.id}/upload`);
    await outcome(fileInput());
    const h1 = await words(main().getByRole("heading", { level: 1 }));
    check(h1 === "Upload a chat export", `headed "${h1}"`);
    check(await main().getByText("Into Work.", { exact: true }).isVisible(), "it names the shelf it uploads into");
    const side = await words(main().getByRole("complementary", { name: "Getting your export", exact: true }));
    check(/ChatGPT/.test(side) && /Data controls/.test(side) && /Claude/.test(side) && /Privacy/.test(side) && /Export data/.test(side), "the side column says where ChatGPT and Claude keep Export data");
    check(await main().getByText(PRIVACY_LINE, { exact: true }).isVisible(), "the privacy line is shown");
    const input = fileInput();
    const native = await input.evaluate((element) => element instanceof HTMLInputElement && element.type === "file");
    const accept = await input.getAttribute("accept");
    check(native && accept?.includes(".zip") === true && accept.includes(".json"), `a native file input takes ${accept}`);
  });

  await step("2. The demo export's preview: 27 of your own messages, and nothing sent", async () => {
    await choose(work, DEMO);
    await outcome(uploadButton());
    check(await headline("27 of your own messages").isVisible(), `it counts "${await words(main().getByRole("heading", { level: 2 }))}"`);
    check(await main().getByText("export.json, read as a ChatGPT export.", { exact: true }).isVisible(), "it says the export came from ChatGPT");
    const rows = await leaves();
    const want = [
      "The words of your 27 messages | Sent | Yes, your words only",
      "When you sent each one | Sent | Never",
      "Each message's id in the export | Sent, so a re-upload isn't counted twice | Never",
      "The chatbot's answers | Stay here | Never",
      "Conversation titles | Stay here | Never",
      "System and tool messages | Stay here | Never",
      "0 messages over 2,000 characters | Stay here | Never",
    ];
    check(rows.join("\n") === want.join("\n"), `What leaves this computer: only the words, their times, and their ids are sent, and the model sees the words only${rows.join("\n") === want.join("\n") ? "" : `: ${JSON.stringify(rows)}`}`);
    check(await main().getByText(PRIVACY_LINE, { exact: true }).isVisible(), "with the privacy line");
    check((await uploadButton().textContent()) === "Upload 27 messages", `the button says "${await uploadButton().textContent()}"`);
    check(uploadsSent(ada.sent).length === 0, `nothing was sent to the uploads endpoints yet (${uploadsSent(ada.sent).length} requests)`);
  });

  await step("3. Upload it: 27 phrasings, which the page watches being sorted", async () => {
    await uploadButton().click();
    await outcome(watching());
    const upload = await latest(ada.learner, work);
    check(upload.phrasings === 27 && upload.messages === 27 && upload.status !== "receiving" && upload.source === "chatgpt", `the API has ${upload.phrasings} new phrasings of ${upload.messages}, ${upload.status}, from ${upload.source}`);
    check(new URL(page.url()).searchParams.get("upload") === upload.id, `the page now shows that upload (${new URL(page.url()).search})`);
    check(await headline("27 new messages").isVisible(), `it says "${await words(main().getByRole("heading", { level: 2 }))}"`);
    await outcome(main().getByRole("status").filter({ hasText: /^They're sorted into the cards on Work\.$/ }));
    check(true, "and says they're sorted into the cards on Work once the sort ends, with no reload");
    const before = uploadsSent(ada.sent).length;
    await page.reload();
    await outcome(watching());
    check(await headline("27 new messages").isVisible(), "reloading shows the same upload");
    check(uploadsSent(ada.sent).length === before && (await ada.learner.client.uploads.list(work.id)).uploads.length === 1, "and sends nothing again");
  });

  await step("4. Upload the same export again: none new", async () => {
    await choose(work, DEMO);
    await uploadButton().click();
    await outcome(watching());
    const upload = await latest(ada.learner, work);
    check(upload.messages === 27 && upload.phrasings === 0, `the API has ${upload.phrasings} new of ${upload.messages}`);
    const already = main().getByText("All 27 of your messages in export.json were in Work already, so nothing new was added.", { exact: true });
    check((await headline("0 new messages").isVisible()) && (await already.isVisible()), `the page says "${await words(main().getByRole("heading", { level: 2 }))}", all there already`);
  });

  await step("5. A Claude export uploads, with its long message skipped", async () => {
    await choose(work, join(FIXTURES, "claude.json"));
    await outcome(uploadButton());
    check((await headline("3 of your own messages").isVisible()) && (await main().getByText("claude.json, read as a Claude export.", { exact: true }).isVisible()), "the preview counts 3 from Claude");
    check(/1 more .*2,000 characters/.test(await words(main())), "and says 1 more ran over 2,000 characters and stays here");
    check((await leaves()).at(-1) === "1 message over 2,000 characters | Stays here | Never", `the table says it stays: "${(await leaves()).at(-1)}"`);
    await uploadButton().click();
    await outcome(watching());
    const upload = await latest(ada.learner, work);
    check(upload.source === "claude" && upload.phrasings === 3 && upload.fileName === "claude.json", `the API has ${upload.phrasings} new from ${upload.source}, ${upload.fileName}`);
  });

  await step("6. A ChatGPT zip in numbered shards uploads", async () => {
    const served = page.waitForResponse((response) => response.request().resourceType() === "document");
    await choose(work, join(FIXTURES, "chatgpt-sharded.zip"));
    const policy = (await served).headers()["content-security-policy"];
    check(policy === CONTENT_SECURITY_POLICY, `the page reads it under the app's content security policy: ${policy}`);
    await outcome(uploadButton());
    check(await headline("4 of your own messages").isVisible(), `the preview counts "${await words(main().getByRole("heading", { level: 2 }))}"`);
    await uploadButton().click();
    await outcome(watching());
    const upload = await latest(ada.learner, work);
    check(upload.phrasings === 4 && upload.fileName === "chatgpt-sharded.zip", `the API has ${upload.phrasings} new from ${upload.fileName}`);
  });

  await step("7. A file that can't be read says why, naming the field, and sends nothing", async () => {
    const before = uploadsSent(ada.sent).length;
    const broken = await Bun.file(DEMO).json();
    delete broken[2].mapping;
    const claudeZip = Buffer.from(await Bun.file(join(FIXTURES, "claude.zip")).arrayBuffer());
    const json = (name: string, data: unknown) => ({ name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
    const zip = (name: string, buffer: Buffer) => ({ name, mimeType: "application/zip", buffer });
    // One file for each way the reader refuses an export.
    const unreadable: [string, { name: string; mimeType: string; buffer: Buffer }, RegExp][] = [
      ["a ChatGPT export missing a field", json("conversations.json", broken), /Conversation 3.*mapping/],
      ["a picture", { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) }, /neither a zip nor JSON/],
      ["an export with no conversations", json("empty.json", []), /no conversations/],
      ["JSON that isn't a ChatGPT or Claude export", json("notes.json", [{ title: "x" }]), /mapping.*chat_messages/],
      ["a zip with no conversations.json", zip("no-conversations.zip", Buffer.from(await Bun.file(join(FIXTURES, "no-conversations.zip")).arrayBuffer())), /no conversations\.json/],
      ["a zip cut short", zip("cut-short.zip", claudeZip.subarray(0, 40)), /damaged|cut short/],
      ["a zip with an encrypted entry", zip("locked.zip", encrypted(claudeZip)), /encrypted/],
    ];
    for (const [what, file, names] of unreadable) {
      const reason = await readExport(new Uint8Array(file.buffer)).then(
        () => "(read anyway)",
        (error: unknown) => (error instanceof ExportError ? error.message : `(not an ExportError: ${error})`),
      );
      await choose(work, file);
      await alerts().first().waitFor();
      const said = await words(alerts());
      check(said === `Asked Before can't read ${file.name}. ${reason}` && names.test(said), `${what}: "${said}"`);
      check((await fileInput().isEnabled()) && (await main().getByText("Drop your chat export here", { exact: true }).isVisible()), `and offers the drop target again`);
    }
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
    const sending = main().getByRole("progressbar", { name: "Sending your messages…", exact: true });
    await outcome(sending);
    // The live status is the words alone; the count sits beside it, so a screen reader isn't told every chunk.
    const status = await words(main().getByRole("status").filter({ hasText: "Sending your messages…" }));
    const counted = await words(main().getByText("0 of 27 sent", { exact: true }));
    check(status === "Sending your messages…" && counted === "0 of 27 sent" && (await sending.getAttribute("aria-valuetext")) === "0 of 27 sent", `while it sends: "${status}", beside it "${counted}"`);
    check(await headline("27 of your own messages").isVisible(), "the count still 27 of your own messages");
    await page.screenshot({ path: join(OUT, `${shot + 1}-sending.png`) });
    release();
    await alerts().first().waitFor();
    check(await alerts().getByText("The server failed.", { exact: true }).isVisible(), `a failed chunk says "${await words(alerts())}"`);
    await page.screenshot({ path: join(OUT, `${shot + 1}-failed.png`) });
    await alerts().getByRole("button", { name: "Try again", exact: true }).click();
    await outcome(watching());
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
    check(appends.length >= 6 && shapes, `${appends.length} chunks sent, each { phrasings: [{ sourceId, text, time }] }: the three rows the preview says are sent`);
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
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await bea.page.route("**/demo/export.json", async (route) => {
        await held;
        await route.continue();
      });
      await bea.page.goto(`${app.url}/app/shelves`);
      await outcome(main(bea.page).getByRole("button", { name: "Try the demo shelf", exact: true }), bea.page);
      await main(bea.page).getByRole("button", { name: "Try the demo shelf", exact: true }).click();
      await outcome(main(bea.page).getByRole("status").filter({ hasText: /^Reading the demo export…$/ }), bea.page);
      const preview = (await uploadButton(bea.page).count()) + (await main(bea.page).getByRole("table", { name: LEAVES_TABLE, exact: true }).count());
      check((await main(bea.page).getByText(PRIVACY_LINE, { exact: true }).isVisible()) && preview === 0, "it reads the demo export with the privacy line in view, and no preview");
      release();
      await outcome(watching(bea.page), bea.page);
      await bea.page.unrouteAll();
      const [demoShelf] = await bea.learner.client.shelves.list();
      check(demoShelf?.demo === true, `made "${demoShelf?.name}", flagged demo: ${demoShelf?.demo}`);
      check(new URL(bea.page.url()).pathname === `/app/shelves/${demoShelf!.id}/upload`, `and went to its upload page: ${new URL(bea.page.url()).pathname}`);
      check(await main(bea.page).getByText("Demo data", { exact: true }).isVisible(), "labeled as demo data");
      const upload = await latest(bea.learner, demoShelf!);
      check(upload.phrasings === 27 && upload.source === "chatgpt" && upload.status !== "receiving" && (await headline("27 new messages", bea.page).isVisible()), `its upload has ${upload.phrasings} new phrasings, ${upload.status}`);
      const appends = uploadsSent(bea.sent).filter((r) => r.url().endsWith("/phrasings"));
      check(appends.length > 0 && appends.every((r) => (r.postDataJSON() as { phrasings: object[] }).phrasings.every((p) => Object.keys(p).sort().join() === "sourceId,text,time")), "through the same endpoints, with the same shape");
      check(bea.errors.length === 0, `no console errors${bea.errors.length ? `: ${bea.errors.slice(0, 3).join(" | ")}` : ""}`);
    },
    bea.page,
  );
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

/** A copy of a zip whose every entry is flagged encrypted, in its central directory and its local header. */
function encrypted(zip: Buffer): Buffer {
  const copy = Buffer.from(zip);
  for (let i = 0; i + 4 <= copy.length; i++) {
    const signature = copy.readUInt32LE(i);
    if (signature === 0x02014b50) copy.writeUInt16LE(copy.readUInt16LE(i + 8) | 1, i + 8);
    if (signature === 0x04034b50) copy.writeUInt16LE(copy.readUInt16LE(i + 6) | 1, i + 6);
  }
  return copy;
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
