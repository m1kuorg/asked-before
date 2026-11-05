// Checks Connect your AI (/app/connect) end to end on a fresh copy of the
// app, in a real browser at 1920×1080. As a learner: the flow is one list of
// four steps in order, with no "Step" labels; the agents are offered with
// the Claude Code plugin first and picked, and each agent's snippet carries
// this server's address; the account's keys show with their last use. One
// button makes a key named for the agent, shown once and filled into the
// snippet, never put in the address or in storage; then the SDK calls with
// that key, and the page says when it was first used, without a reload,
// and stops asking. Leaving the screen stops the asking too. As the shared
// guest: no key button, why, and a Sign up link, with the snippets still
// there, and no request for keys at all. Every model request goes to a
// stand-in that refuses, and none may arrive. It prints each step's checks,
// never a key, saves screenshots, and exits 1 if any fails, naming the step.
// Run: bun run check:connect [screenshot dir]

import { createClient } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { startApp } from "./lib/app";
import { refuse, startModelStub } from "./lib/model-stub";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-connect");
const FRAME = { width: 1920, height: 1080 };
const AGENTS = ["Claude Code with the plugin", "Claude Code without the plugin", "Claude Desktop", "Cursor"];
const CAPTIONS = ["Claude Code plugin", "Claude Code without the plugin", "Claude Desktop", "Cursor"];
const STEPS = ["Pick your agent", "Give it a key", "Add it", "Check it"];
const KEY = /^ab_[0-9a-f]{16}_[0-9a-f]{32}$/;

await mkdir(OUT, { recursive: true });
const model = await startModelStub(refuse());
const app = await startApp({ ANTHROPIC_BASE_URL: model.url, ANTHROPIC_API_KEY: "stand-in" });
const failures: string[] = [];
let current = "";

const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? `${error.name}: ${error.message.split("\n")[0]}` : String(error)}`);
  }
}

const withKey = (apiKey: string) => createClient({ baseUrl: app.url, apiKey });

// Ada, with a key she's used already, as a returning learner has.
const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
await ada.client.shelves.create({ name: "Work" });
const laptop = await ada.client.keys.create({ name: "Laptop" });
await withKey(laptop.key).shelves.list();
const guest = app.browser();
await guest.client.auth.signInAsGuest({});

const browser = await chromium.launch();
/** A browser context logged in with a session's Cookie header. */
async function contextWith(cookie: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const pairs = cookie.split("; ").map((pair) => pair.split("="));
  await context.addCookies(pairs.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  return context;
}
let shot = 0;
const screenshot = (p: Page, name: string) => p.screenshot({ path: join(OUT, `${++shot}-${name}.png`), fullPage: true });

/** Every request a page sent to the server's API, with when, and every console error, CSP violations included. */
const apiCalls: { call: string; at: number }[] = [];
const consoleErrors: string[] = [];
function watch(page: Page) {
  page.setDefaultTimeout(10_000);
  page.on("request", (request) => {
    const { origin, pathname } = new URL(request.url());
    if (origin === app.url && pathname.startsWith("/api/")) apiCalls.push({ call: `${request.method()} ${pathname}`, at: Date.now() });
  });
  page.on("console", (message) => {
    // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
}
const keyLists = (since = 0) => apiCalls.filter((c) => c.call === "GET /api/v1/keys" && c.at >= since);

const adaContext = await contextWith(ada.cookie());
const page = await adaContext.newPage();
watch(page);
const main = page.getByRole("main");
const region = (name: string) => main.getByRole("region", { name, exact: true });
const flow = main.getByRole("list", { name: "Connect your AI, in order" });
const status = region("Check it").getByRole("status");
/** The shown snippet: the one figure in Add it, by its caption and its code. */
async function snippet(): Promise<{ caption: string; code: string }> {
  const figure = region("Add it").getByRole("figure");
  await figure.waitFor();
  const caption = await figure.evaluate((f) => f.querySelector("figcaption")?.firstElementChild?.textContent?.trim() ?? "");
  return { caption, code: ((await figure.locator("code").textContent()) ?? "").trim() };
}
/** The MCP server's env in a Claude Desktop or Cursor config. */
const envOf = (code: string) => (JSON.parse(code) as { mcpServers?: Record<string, { env?: Record<string, string> }> }).mcpServers?.["asked-before"]?.env;
const keyRow = (name: string) => region("Your keys").getByRole("row").filter({ has: page.getByText(name, { exact: true }) });

/** The key made in step 3, whole, and when its button was pressed. */
let made = "";
let madeAt = 0;

try {
  await step("1. The screen is one flow of four steps in order, beside the account's keys", async () => {
    await page.goto(`${app.url}/app/connect`);
    await keyRow("Laptop").waitFor();
    check((await main.getByRole("heading", { level: 1 }).textContent()) === "Connect your AI", "the page is headed Connect your AI");
    const nav = page.getByRole("navigation", { name: "Asked Before" });
    check((await nav.locator("[aria-current=page]").textContent())?.trim() === "Connect your AI", "the navigation marks Connect your AI");
    check((await flow.evaluate((list) => list.tagName)) === "OL", "the flow is an ordered list");
    const headings = await flow.getByRole("listitem").evaluateAll((items) => items.map((item) => item.querySelector("h2")?.textContent?.trim() ?? ""));
    check(JSON.stringify(headings) === JSON.stringify(STEPS), `its steps, in order: ${headings.join(", ")}`);
    check(!/\bstep\s*\d/i.test((await flow.textContent()) ?? ""), "with no \"Step N\" labels");
    const laptopRow = await keyRow("Laptop").getByRole("cell").allTextContents();
    check(/^\d{4}-\d{2}-\d{2}$/.test(laptopRow[1]?.trim() ?? ""), `Your keys shows Laptop's last use: ${laptopRow[1]?.trim()}`);
    check((await region("Your keys").getByRole("link", { name: "Manage in API keys" }).getAttribute("href")) === "/app/settings/keys", "and links to API keys to manage them");
    check((await region("What it can do").locator("dt").allTextContents()).join(", ") === "list_shelves, list_cards, record_question, start_cold_rep, check_answer", "What it can do lists the MCP server's five tools");
    await screenshot(page, "connect");
  });

  await step("2. The agents come with the Claude Code plugin first, and every snippet names this server", async () => {
    const radios = region("Pick your agent").getByRole("radio");
    const names = await radios.evaluateAll((all) => all.map((radio) => radio.getAttribute("aria-labelledby")?.split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).join(" ") ?? ""));
    check(JSON.stringify(names) === JSON.stringify(AGENTS), `the agents, in order: ${names.join(", ")}`);
    check((await radios.first().getAttribute("aria-checked")) === "true", "the plugin is picked to start with");
    const described = await radios.first().evaluate((radio) => (radio.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).join(" "));
    check(described.startsWith("Recommended "), `and described as Recommended: "${described}"`);

    for (const [i, agent] of AGENTS.entries()) {
      await region("Pick your agent").getByRole("radio", { name: agent, exact: true }).click();
      const { caption, code } = await snippet();
      check(caption === CAPTIONS[i], `${agent} shows the ${caption} snippet`);
      if (i === 0) check(code.startsWith("claude plugin marketplace add") && code.includes(`server_url=${app.url}`) && code.includes("api_key=YOUR_API_KEY"), "the plugin's install names this server, and YOUR_API_KEY");
      if (i === 1) check(code.startsWith("claude mcp add") && code.includes(`ASKED_BEFORE_URL=${app.url}`), "Claude Code's command from a copy names this server");
      if (i >= 2) check(envOf(code)?.ASKED_BEFORE_URL === app.url && envOf(code)?.ASKED_BEFORE_API_KEY === "YOUR_API_KEY", `${agent}'s config is JSON naming this server`);
    }
    await region("Pick your agent").getByRole("radio", { name: AGENTS[0], exact: true }).click();
    check((await status.count()) === 0, "nothing is checked before a key is made");
  });

  await step("3. One button makes a key named for the agent, shown once and filled into the snippet", async () => {
    const keysBefore = (await ada.client.keys.list()).length;
    madeAt = Date.now();
    await region("Give it a key").getByRole("button", { name: "Make a key for Claude Code", exact: true }).click();
    const shown = region("Give it a key").getByRole("figure");
    await shown.or(region("Give it a key").getByRole("alert")).first().waitFor();
    const caption = await shown.evaluate((figure) => figure.querySelector("figcaption")?.firstElementChild?.textContent ?? "");
    check(caption === "Claude Code's key", `it's shown as Claude Code's key: "${caption}"`);
    made = ((await shown.locator("code").textContent()) ?? "").trim();
    check(KEY.test(made), "in the ab_<id>_<secret> form");
    check(await shown.getByRole("button", { name: "Copy Claude Code's key" }).evaluate((button) => button === document.activeElement), "with its copy button focused");
    check((await region("Give it a key").getByRole("button", { name: /^Make a key/ }).count()) === 0, "and the button is gone, so it's made once");
    const listed = await ada.client.keys.list();
    check(listed.length === keysBefore + 1 && listed.at(-1)!.name === "Claude Code", `the account has one more key, named ${listed.at(-1)?.name}`);

    const plugin = (await snippet()).code;
    check(plugin.includes(`api_key=${made}`) && !plugin.includes("YOUR_API_KEY"), "the plugin's snippet holds the key in place of YOUR_API_KEY");
    await region("Pick your agent").getByRole("radio", { name: "Cursor", exact: true }).click();
    check(envOf((await snippet()).code)?.ASKED_BEFORE_API_KEY === made, "so does Cursor's");
    await region("Pick your agent").getByRole("radio", { name: AGENTS[0], exact: true }).click();

    await keyRow("Claude Code").waitFor();
    check((await keyRow("Claude Code").getByRole("cell").nth(1).textContent())?.trim() === "Never", "Your keys lists it, never used");
    check((await status.textContent()) === "Waiting for the first request from Claude Code…", `the check waits: "${await status.textContent()}"`);
    const secret = made.split("_")[2]!;
    check(!page.url().includes(secret), "the key isn't in the address");
    const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
    check(!stored.includes(secret), "nor in local or session storage, nor a cookie the page can read");
    await screenshot(page, "key-made");
  });

  await step("4. The SDK calls with the key, and the page says when it was first used, without a reload", async () => {
    await page.waitForTimeout(Math.max(0, madeAt + 7_000 - Date.now()));
    const waiting = keyLists(madeAt);
    check(waiting.length === 2 && (await status.textContent()) === "Waiting for the first request from Claude Code…", `7 s after the key was made, it has asked keys.list() ${waiting.length} times, and still waits`);
    const before = Date.now();
    await page.evaluate(() => Object.assign(window, { stillHere: true }));
    const shelves = await withKey(made).shelves.list();
    check(shelves.some((shelf) => shelf.name === "Work"), `the key lists Ada's shelves: ${shelves.map((shelf) => shelf.name).join(", ")}`);
    const firstUse = (await ada.client.keys.list()).find((k) => k.name === "Claude Code" && k.lastUsedAt)?.lastUsedAt ?? "";
    const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(firstUse));
    const said = `Claude Code's key was first used at ${time}.`;
    await status.filter({ hasText: said }).waitFor({ timeout: 8_000 }).catch(() => {});
    check((await status.textContent()) === said, `within ${((Date.now() - before) / 1000).toFixed(1)} s the check says "${await status.textContent()}"`);
    check(await page.evaluate(() => "stillHere" in window), "on the same page, with no reload");
    check((await status.locator("time").getAttribute("datetime")) === firstUse, "with the use's own time in its <time>");
    check(/^\d{4}-\d{2}-\d{2}$/.test((await keyRow("Claude Code").getByRole("cell").nth(1).textContent())?.trim() ?? ""), "and Your keys shows its last use too");

    const asked = keyLists(madeAt);
    const gaps = [asked[0]!.at - madeAt, ...asked.slice(1).map((c, i) => c.at - asked[i]!.at)];
    check(gaps.every((gap) => gap >= 2_500 && gap <= 4_500), `it asked keys.list() about every 3 seconds: ${gaps.map((g) => `${(g / 1000).toFixed(1)} s`).join(", ")}`);
    const stopped = Date.now();
    await page.waitForTimeout(7_000);
    check(keyLists(stopped).length === 0, "then it stops asking");
    await screenshot(page, "first-used");
  });

  await step("5. Leaving the screen stops the check", async () => {
    await page.reload();
    await keyRow("Claude Code").waitFor();
    check(!((await page.locator("body").textContent()) ?? "").includes(made.split("_")[2]!), "after a reload, the key's secret is nowhere on the page");
    check((await region("Give it a key").getByRole("figure").count()) === 0, "and no key is shown");
    await region("Pick your agent").getByRole("radio", { name: "Cursor", exact: true }).click();
    await region("Give it a key").getByRole("button", { name: "Make a key for Cursor", exact: true }).click();
    await region("Give it a key").getByRole("figure").waitFor();
    check((await status.textContent()) === "Waiting for the first request from Cursor…", "a key made for Cursor waits for Cursor's first request");
    await page.getByRole("navigation", { name: "Asked Before" }).getByRole("link", { name: /^Home/ }).click();
    await page.waitForURL(/\/app\/desk$/);
    const left = Date.now();
    await page.waitForTimeout(7_000);
    check(keyLists(left).length === 0, "after going Home, nothing asks for the keys");
  });

  await step("6. The shared guest gets why keys need an account, and Sign up, and no key requests", async () => {
    const guestPage = await (await contextWith(guest.cookie())).newPage();
    watch(guestPage);
    const opened = Date.now();
    await guestPage.goto(`${app.url}/app/connect`);
    const guestMain = guestPage.getByRole("main");
    const keyStep = guestMain.getByRole("region", { name: "Give it a key", exact: true });
    await keyStep.waitFor();
    const nav = guestPage.getByRole("navigation", { name: "Asked Before" });
    check((await nav.getByRole("link", { name: "Connect your AI", exact: true }).count()) === 1, "the guest's navigation has Connect your AI");
    check((await keyStep.getByRole("button").count()) === 0, "there's no key button");
    check(/every guest shares the Guest account, so it has no API keys/.test((await keyStep.textContent()) ?? ""), "it says why: every guest shares the Guest account, which has no keys");
    const signUp = keyStep.getByRole("link", { name: "Sign up", exact: true });
    check((await signUp.getAttribute("href")) === "/signup?next=%2Fapp%2Fconnect", `with a Sign up link that comes back here: ${await signUp.getAttribute("href")}`);
    check((await guestMain.getByRole("region", { name: "Your keys", exact: true }).count()) === 0, "and no keys list");
    const figure = guestMain.getByRole("region", { name: "Add it", exact: true }).getByRole("figure");
    const code = (await figure.locator("code").textContent()) ?? "";
    check(code.includes(`server_url=${app.url}`) && code.includes("api_key=YOUR_API_KEY"), "the plugin's snippet still names this server, with YOUR_API_KEY");
    await guestPage.waitForTimeout(1_000);
    check(keyLists(opened).length === 0, "the page never asks for keys, which the server refuses a guest");
    await screenshot(guestPage, "guest");
  });

  await step("7. No model request, and only /api/v1 within the security policy", async () => {
    check(model.requests.length === 0, `the model stand-in got ${model.requests.length} requests`);
    const outside = apiCalls.filter(({ call }) => !call.split(" ")[1]!.startsWith("/api/v1/"));
    check(apiCalls.length > 0 && outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
  model.stop();
}

console.log(`\nscreenshots in ${OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nConnect your AI holds up.");
