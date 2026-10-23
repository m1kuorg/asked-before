// Checks the upload page's sort states (m1kuorg/basics#44) in a real
// browser at 1920×1080, on a fresh copy of the app whose model is a
// stand-in in this script, never in the app: it answers as the answer key
// sorts the demo export, unless a step holds or refuses a request. The app
// sorts in batches of 10, with a daily cap of 6 model requests. Uploading
// the demo export shows the sort's progress in the app's words, and again
// after a reload; a sort that fails shows the error and a retry; the retry
// carries on to the sort's last pass over the messages not on a card
// (m1kuorg/basics#56), which the progress line names, and which can fail
// and be tried again too, finishing the sort with the key's cards; past
// the daily cap, the next model request gets 429, and the page says so
// with a retry. Each step is checked through the SDK too, saves a
// screenshot, and prints its checks; it exits 1 if any fails, naming the
// step.
// Run: bun run check:sort-page [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator } from "playwright";
import { compareWithKey, keySorter, sortEnds } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { hold, refuse, reply, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-sort-page");
const ROOT = join(import.meta.dir, "..");
const DEMO = join(ROOT, "demo", "export.json");
const CLAUDE = join(ROOT, "packages", "sdk", "fixtures", "claude.json");
const CAP = 6;

const failures: string[] = [];
let current = "";
let shot = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const model = await startModelStub(reply(keySorter));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, SORT_BATCH_SIZE: "10", SITE_DAILY_MODEL_REQUESTS: String(CAP) });
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

const main = () => page.getByRole("main");
const alerts = () => main().getByRole("alert");
/** What a locator shows, its whitespace collapsed. */
const words = async (locator: Locator) => ((await locator.first().innerText()) ?? "").replace(/\s+/g, " ").trim();
const tryAgain = () => main().getByRole("button", { name: "Try again", exact: true });
const uploadId = () => new URL(page.url()).searchParams.get("upload") ?? "";

/**
 * The sort's progress line, as its live status (its words and the quarter it has reached, never the count), the
 * count shown beside it, and the bar a screen reader hears: its name is the line's words, its value the count.
 */
async function progress(label: string, done: string) {
  const bar = main().getByRole("progressbar", { name: label, exact: true });
  await bar.or(alerts()).first().waitFor();
  if (!(await bar.isVisible())) throw new Error(`the page says "${await words(alerts())}"`);
  const count = main().getByText(done, { exact: true });
  await count.waitFor();
  return { line: `${await words(main().getByRole("status").filter({ hasText: label }))} | ${await words(count)}`, value: await bar.getAttribute("aria-valuetext") };
}

/** Chooses a file on the shelf's upload page and sends it, as a learner would. */
async function send(shelfId: string, file: string) {
  await page.goto(`${app.url}/app/shelves/${shelfId}/upload`);
  await main().getByRole("button", { name: "Drop your chat export here Choose a file", exact: true }).setInputFiles(file);
  await main().getByRole("button", { name: /^Upload \d+ (message|messages)$/ }).click();
  await page.waitForURL(/[?&]upload=/);
}

const shelf = await learner.client.shelves.create({ name: "Bootcamp" });
const held = hold();
model.queue(reply(keySorter), held.answer);

const SORTING = "Sorting them into the cards on Bootcamp…";
const LAST_PASS = "Sorting them into the cards on Bootcamp, and a last pass over the messages not on a card…";

try {
  await step("1. Uploading the demo export shows the sort's progress, in the library's words", async () => {
    await send(shelf.id, DEMO);
    await held.reached;
    const { line, value } = await progress(SORTING, "10 of 27 sorted");
    check(line === `${SORTING} A quarter sorted. | 10 of 27 sorted` && value === "10 of 27 sorted", `the progress line says "${line}", its bar "${value}"`);
    check(await main().getByRole("heading", { level: 2, name: "27 new messages", exact: true }).isVisible(), `the count still says "${await words(main().getByRole("heading", { level: 2 }))}"`);
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "sorting" && upload.offered === 10, `the API has it ${upload.status}, ${upload.offered} of ${upload.phrasings} offered`);
    await page.reload();
    const again = await progress(SORTING, "10 of 27 sorted");
    check(again.line === line, `reloading shows the same progress: "${again.line}"`);
  });

  await step("2. A sort that fails shows the error and a retry", async () => {
    held.release(refuse());
    await alerts().first().waitFor();
    check(await alerts().getByText("The model request failed (400).", { exact: true }).isVisible(), `with no reload, the notice says "${await words(alerts())}"`);
    check(await main().getByText("10 of 27 were sorted before it stopped. Trying again carries on from there.", { exact: true }).isVisible(), "and how far the sort got");
    check(await tryAgain().isVisible(), "with a Try again button");
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "failed" && upload.error === "The model request failed (400).", `the API has it ${upload.status}: "${upload.error}"`);
  });

  await step("3. The retry carries on to the last pass over the unsorted, which the page names, and which can fail too", async () => {
    const last = hold();
    model.queue(reply(keySorter), reply(keySorter), last.answer);
    await tryAgain().click();
    await last.reached;
    const { line, value } = await progress(LAST_PASS, "27 of 27 sorted");
    check(line === `${LAST_PASS} All sorted. | 27 of 27 sorted` && value === "27 of 27 sorted", `the progress line says "${line}", its bar "${value}"`);
    const sorting = await learner.client.uploads.get(uploadId());
    check(sorting.status === "sorting" && sorting.offered === 27, `the API has it ${sorting.status}, ${sorting.offered} of ${sorting.phrasings} offered`);
    last.release(refuse());
    await alerts().first().waitFor();
    const said = "27 of 27 were sorted, and it stopped on the last pass over the messages not on a card. Trying again runs that pass.";
    check((await main().getByText(said, { exact: true }).isVisible()) && (await alerts().getByText("The model request failed (400).", { exact: true }).isVisible()), `the notice says "${await words(alerts())}", and how far it got: "${said}"`);
    const failed = await learner.client.uploads.get(uploadId());
    check(failed.status === "failed" && failed.offered === 27 && failed.error === "The model request failed (400).", `the API has it ${failed.status}, ${failed.offered} offered: "${failed.error}"`);
  });

  await step("4. Trying the last pass again finishes the sort, with the answer key's cards", async () => {
    await tryAgain().click();
    const done = main().getByRole("status").filter({ hasText: /^They're sorted into the cards on Bootcamp\.$/ });
    await done.or(alerts()).first().waitFor();
    const left = (await main().getByRole("progressbar").count()) + (await alerts().count());
    check((await done.isVisible()) && !left, `the page says "${await words(done.or(alerts()))}", with no progress line or notice left`);
    const upload = await sortEnds(learner.client, uploadId());
    check(upload.status === "sorted" && upload.offered === 27, `the API has it ${upload.status}, ${upload.offered} offered`);
    const { lines, problems } = await compareWithKey(learner.client, shelf.id);
    console.log(lines.join("\n"));
    check(problems.length === 0, problems.length ? problems.join("; ") : "its cards match the answer key");
    check(model.requests.length === CAP, `the day's ${model.requests.length} of ${CAP} model requests are spent: three batches, the refused one, and the last pass twice`);
  });

  await step("5. Past the daily cap, the next model request gets 429, and the page shows it with a retry", async () => {
    const PAST_MODEL = "Asked Before has used today's model requests for everyone. More open at midnight UTC.";
    await send(shelf.id, CLAUDE);
    await alerts().first().waitFor();
    check(await alerts().getByText(PAST_MODEL, { exact: true }).isVisible(), `the notice says "${await words(alerts())}"`);
    const upload = await learner.client.uploads.get(uploadId());
    check(upload.status === "failed" && upload.error === PAST_MODEL && model.requests.length === CAP, `the API has it ${upload.status}, and the model wasn't asked (${model.requests.length} requests)`);
    const retried = page.waitForResponse((response) => response.url().endsWith(`/uploads/${uploadId()}/retry`));
    await tryAgain().click();
    check((await retried).ok(), `the retry starts the sort again: ${(await retried).status()}`);
    await alerts().first().waitFor();
    check((await alerts().getByText(PAST_MODEL, { exact: true }).isVisible()) && model.requests.length === CAP, "trying again the same day says so again");
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
