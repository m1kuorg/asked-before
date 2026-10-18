// Checks the upload page's sort states (m1kuorg/basics#44) in a real
// browser at 1920×1080, on a fresh copy of the app whose model is a
// stand-in in this script, never in the app: it answers as the answer key
// sorts the demo export, unless a step holds or refuses a request. The app
// sorts in batches of 10, with a daily cap of 4 model requests. Uploading
// the demo export shows the sort's progress in the library's words, and
// again after a reload; a sort that fails shows the error and a retry, and
// the retry finishes the sort with the key's cards; past the daily cap, the
// next model request gets 429, and the page says so with a retry. Each step
// is checked through the SDK too, saves a screenshot, and prints its
// checks; it exits 1 if any fails, naming the step.
// Run: bun run check:sort-page [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { compareWithKey, keySorter, sortEnds } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-sort-page");
const ROOT = join(import.meta.dir, "..");
const DEMO = join(ROOT, "demo", "export.json");
const CLAUDE = join(ROOT, "packages", "sdk", "fixtures", "claude.json");
const CAP = 4;

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, SORT_BATCH_SIZE: "10", DAILY_MODEL_REQUESTS: String(CAP) });
const browser = await chromium.launch();

const learner = app.browser();
await learner.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addCookies(learner.cookie().split("; ").map((pair) => pair.split("=")).map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors: string[] = [];
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

const text = async (selector: string) => ((await page.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const uploadId = () => new URL(page.url()).searchParams.get("upload") ?? "";

/** Chooses a file on the project's upload page and sends it, as a learner would. */
async function send(projectId: string, file: string) {
  await page.goto(`${app.url}/app/projects/${projectId}/upload`);
  await page.locator(".drop-zone input[type=file]").setInputFiles(file);
  await page.locator(".block").getByRole("button", { name: /^Upload \d+ (message|messages)$/ }).click();
  await page.waitForURL(/[?&]upload=/);
}

const project = await learner.client.shelves.create({ name: "Bootcamp" });
const held = hold();
model.queue(reply(keySorter), held.answer);

try {
  await step("1. Uploading the demo export shows the sort's progress, in the library's words", async () => {
    await send(project.id, DEMO);
    await held.reached;
    await page.locator(".block .is-waiting", { hasText: "10 of 27" }).waitFor();
    const line = await text(".block .is-waiting");
    check(/^Sorting them into Bootcamp's cards: 10 of 27 sorted…$/.test(line), `the waiting line says "${line}"`);
    check((await text(".block .plate b")) === "27" && (await text(".block .plate span")) === "new phrasings", `the plate still counts ${await text(".block .plate b")} ${await text(".block .plate span")}`);
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "sorting" && upload.offered === 10, `the API has it ${upload.status}, ${upload.offered} of ${upload.phrasings} offered`);
    await page.reload();
    await page.locator(".block .is-waiting", { hasText: "10 of 27" }).waitFor();
    check(true, "reloading shows the same progress");
  });

  await step("2. A sort that fails shows the error and a retry", async () => {
    held.release(refuse());
    await page.locator(".block .error").waitFor();
    check((await text(".block .error")) === "The model request failed (400).", `the notice says "${await text(".block .error")}"`);
    check(/10 of 27 were sorted before it stopped/.test(await text(".block .upload-done")), "and how far the sort got");
    check(await page.locator(".block").getByRole("button", { name: "Try again" }).isVisible(), "with a Try again button");
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "failed" && upload.error === "The model request failed (400).", `the API has it ${upload.status}: "${upload.error}"`);
  });

  await step("3. The retry finishes the sort, with the answer key's cards", async () => {
    await page.locator(".block").getByRole("button", { name: "Try again" }).click();
    await page.locator(".block .upload-done p", { hasText: /^They're sorted into Bootcamp's cards\.$/ }).waitFor();
    check(!(await page.locator(".block .is-waiting, .block .error").count()), `the page says "${await text(".block .upload-done p:last-child")}", with no waiting line or notice left`);
    const upload = await sortEnds(learner.client, uploadId());
    check(upload.status === "sorted" && upload.offered === 27, `the API has it ${upload.status}, ${upload.offered} offered`);
    const { lines, problems } = await compareWithKey(learner.client, project.id);
    console.log(lines.join("\n"));
    check(problems.length === 0, problems.length ? problems.join("; ") : "its cards match the answer key");
    check(model.requests.length === CAP, `the day's ${model.requests.length} of ${CAP} model requests are spent: two batches, the refused one, and the last`);
  });

  await step("4. Past the daily cap, the next model request gets 429, and the page shows it with a retry", async () => {
    await send(project.id, CLAUDE);
    await page.locator(".block .error").waitFor();
    const said = await text(".block .error");
    check(said === `You've used today's ${CAP} model requests. More open at midnight UTC.`, `the notice says "${said}"`);
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "failed" && upload.error === said && model.requests.length === CAP, `the API has it ${upload.status}, and the model wasn't asked (${model.requests.length} requests)`);
    await page.locator(".block").getByRole("button", { name: "Try again" }).click();
    await page.locator(".block .error").waitFor();
    check((await text(".block .error")) === said && model.requests.length === CAP, "trying again the same day says so again");
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
