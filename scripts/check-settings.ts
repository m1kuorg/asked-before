// Checks settings (m1kuorg/basics#48) end to end on a fresh copy of the app.
// Through the SDK: API keys, made once in the ab_<id>_<secret> form, listed,
// used as a Bearer token with their last use stamped, and revoked; a wrong or
// revoked key's 401; the one rule for what a key can't do (403); changing the
// name and email; and changing the password, which needs the current one and
// ends every other session. Then, in a real browser at 1920×1080, the
// settings page: a key made there and used by the SDK, then revoked there;
// the name; the password, logging out another browser; and the setup
// snippets carrying this server's address. It prints each step's checks,
// never a key, saves screenshots, and exits 1 if any fails, naming the step.
// Run: bun run check:settings [screenshot dir]

import { ApiError, createClient } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { startApp } from "./lib/app";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-settings");
const FRAME = { width: 1920, height: 1080 };

await mkdir(OUT, { recursive: true });
const app = await startApp();
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

/** The ApiError a call fails with, or null when it doesn't fail. */
async function failure(call: Promise<unknown>): Promise<ApiError | null> {
  try {
    await call;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}

const say = (error: ApiError | null) => (error ? `${error.status} "${error.message}"` : "no error");
const withKey = (apiKey: string) => createClient({ baseUrl: app.url, apiKey });

const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const BEA = { name: "Bea Example", email: "bea@example.com", password: "difference engine" };
const ada = app.browser();
const bea = app.browser();
await ada.client.auth.signUp(ADA);
await bea.client.auth.signUp(BEA);
const work = await ada.client.projects.create({ name: "Work" });

/** Ada's key, made in step 1 and revoked in step 3. */
let laptop = "";
let laptopId = "";

await step("1. A key is made once, listed, and lists projects as a Bearer token", async () => {
  const made = await ada.client.keys.create({ name: "  Laptop  " });
  laptop = made.key;
  laptopId = made.id;
  const form = made.key.match(/^ab_([^_]+)_(.+)$/);
  check(form !== null && form[1] === made.id, `the key reads ab_<id>_<secret>, with its id ${made.id}`);
  check(made.name === "Laptop" && made.prefix === `ab_${made.id}` && made.lastUsedAt === null, `it's named "${made.name}", with prefix ${made.prefix}, never used`);
  check(!Number.isNaN(Date.parse(made.createdAt)), `made ${made.createdAt}`);

  const listed = await ada.client.keys.list();
  check(listed.length === 1 && listed[0]!.id === made.id && listed[0]!.name === "Laptop", `the list holds it: ${listed.map((k) => k.name).join(", ")}`);
  check(listed.every((k) => !("key" in k) && !JSON.stringify(k).includes(made.key.slice(made.prefix.length + 1))), "the list never shows the secret again");

  const projects = await withKey(laptop).projects.list();
  check(projects.length === 1 && projects[0]!.id === work.id, `the key lists Ada's projects: ${projects.map((p) => p.name).join(", ")}`);
  const me = await withKey(laptop).auth.me();
  check(me.email === ADA.email, `the key is Ada's: ${me.email}`);
  const used = (await ada.client.keys.list())[0]!;
  check(used.lastUsedAt !== null && Date.parse(used.lastUsedAt) >= Date.parse(made.createdAt), `its last use is stamped: ${used.lastUsedAt}`);

  const blank = await failure(ada.client.keys.create({ name: "   " }));
  check(blank?.status === 400, `a key with a blank name: ${say(blank)}`);
});

await step("2. A wrong secret, a made-up key, or another account's key id gets nowhere", async () => {
  const wrongSecret = `ab_${laptopId}_${"0".repeat(32)}`;
  for (const [what, key] of [
    ["the right id with a wrong secret", wrongSecret],
    ["a made-up key", "ab_nope_nope"],
    ["something that isn't a key", "hello"],
  ] as const) {
    const error = await failure(withKey(key).projects.list());
    check(error?.status === 401, `${what}: ${say(error)}`);
  }
  const theirs = await failure(bea.client.keys.revoke(laptopId));
  check(theirs?.status === 404, `Bea revoking Ada's key: ${say(theirs)}`);
  check((await bea.client.keys.list()).length === 0, "Bea lists no keys");
  check((await withKey(laptop).projects.list()).length === 1, "Ada's key still works");
});

await step("3. Revoked, a key gets 401 at once", async () => {
  const spare = await ada.client.keys.create({ name: "Spare" });
  await ada.client.keys.revoke(laptopId);
  const error = await failure(withKey(laptop).projects.list());
  check(error?.status === 401, `the revoked key lists projects: ${say(error)}`);
  const listed = await ada.client.keys.list();
  check(listed.length === 1 && listed[0]!.id === spare.id, `the list holds only the other key: ${listed.map((k) => k.name).join(", ")}`);
  check((await withKey(spare.key).projects.list()).length === 1, "the other key still works");
  const again = await failure(ada.client.keys.revoke(laptopId));
  check(again?.status === 404, `revoking it again: ${say(again)}`);
  laptop = spare.key;
});

await step("4. A key reads and adds, but gets 403 deleting, managing keys, or changing the account", async () => {
  const key = withKey(laptop);
  const made = await key.projects.create({ name: "Made by a key" });
  check(made.name === "Made by a key", `a key can make a project: "${made.name}"`);
  const before = (await ada.client.keys.list())[0]!.lastUsedAt;
  await key.projects.list();
  const after = (await ada.client.keys.list())[0]!.lastUsedAt;
  check(before !== null && before === after, `a second use within the minute leaves the last use as it was: ${before}, then ${after}`);

  const keyIds = (await ada.client.keys.list()).map((k) => k.id);
  for (const [what, call] of [
    ["deleting a project", () => key.projects.delete(made.id)],
    ["listing keys", () => key.keys.list()],
    ["making a key", () => key.keys.create({ name: "Another" })],
    ["revoking a key", () => key.keys.revoke(keyIds[0]!)],
    ["changing the name and email", () => key.account.update({ name: "Mallory" })],
    ["changing the password", () => key.account.changePassword({ currentPassword: ADA.password, newPassword: "a new long password" })],
    ["logging out", () => key.auth.logOut()],
  ] as const) {
    const error = await failure(call());
    check(error?.status === 403, `${what}: ${say(error)}`);
  }
  check((await ada.client.projects.list()).some((p) => p.id === made.id), "the project is still there");
  check((await ada.client.keys.list()).length === 1, "no key was made or revoked");
  check((await ada.client.auth.me()).name === ADA.name, "the account is unchanged");
  const revoked = `ab_${laptopId}_${"0".repeat(32)}`;
  const denied = await failure(withKey(revoked).projects.delete(made.id));
  check(denied?.status === 401, `a revoked key deleting a project is a 401, not a 403: ${say(denied)}`);
});

await step("5. Change the name and the email, which is trimmed, lowercased, and not another account's", async () => {
  const renamed = await ada.client.account.update({ name: "  Augusta Ada King  " });
  check(renamed.name === "Augusta Ada King" && renamed.email === ADA.email, `the name alone: ${renamed.name}, ${renamed.email}`);
  const moved = await ada.client.account.update({ email: "  Ada@Engine.Example " });
  check(moved.email === "ada@engine.example" && moved.name === "Augusta Ada King", `the email alone: ${moved.name}, ${moved.email}`);
  const me = await ada.client.auth.me();
  check(me.name === moved.name && me.email === moved.email, `the current account shows both: ${me.name}, ${me.email}`);

  const taken = await failure(ada.client.account.update({ email: "BEA@example.com" }));
  check(taken?.status === 409, `Bea's email: ${say(taken)}`);
  for (const [what, change] of [
    ["a blank name", { name: "  " }],
    ["a bad email", { email: "not an email" }],
    ["nothing to change", {}],
  ] as const) {
    const error = await failure(ada.client.account.update(change));
    check(error?.status === 400, `${what}: ${say(error)}`);
  }
  check((await ada.client.auth.me()).email === "ada@engine.example", "none of them changed it");
  const back = await ada.client.account.update({ name: ADA.name, email: ADA.email });
  check(back.name === ADA.name && back.email === ADA.email, `both at once, back again: ${back.name}, ${back.email}`);
  const loggedIn = await app.browser().client.auth.logIn({ email: ADA.email, password: ADA.password });
  check(loggedIn.account.id === back.id, "logging in takes the email as it is now");
});

await step("6. Changing the password needs the current one and logs out every other session, not this one", async () => {
  const other = app.browser();
  await other.client.auth.logIn({ email: ADA.email, password: ADA.password });
  const NEW = "a new and longer password";

  const wrong = await failure(ada.client.account.changePassword({ currentPassword: "the wrong password", newPassword: NEW }));
  check(wrong?.status === 403, `with a wrong current password: ${say(wrong)}`);
  const weak = await failure(ada.client.account.changePassword({ currentPassword: ADA.password, newPassword: "too short" }));
  check(weak?.status === 400 && /10/.test(weak.message), `with a 9-character new one: ${say(weak)}`);
  check((await other.client.auth.me()).email === ADA.email, "neither ended the other session");

  await ada.client.account.changePassword({ currentPassword: ADA.password, newPassword: NEW });
  const ended = await failure(other.client.auth.me());
  check(ended?.status === 401, `the other browser's session is over: ${say(ended)}`);
  check((await ada.client.auth.me()).email === ADA.email, "this browser's session goes on");
  check((await withKey(laptop).projects.list()).length > 0, "the API key still works");

  const old = await failure(app.browser().client.auth.logIn({ email: ADA.email, password: ADA.password }));
  check(old?.status === 401, `logging in with the old password: ${say(old)}`);
  const fresh = await app.browser().client.auth.logIn({ email: ADA.email, password: NEW });
  check(fresh.account.email === ADA.email, "logging in with the new one works");
  await ada.client.account.changePassword({ currentPassword: NEW, newPassword: ADA.password });
});

// The settings page, in a real browser, on Ada's session.
const browser = await chromium.launch();
/** A browser context logged in with a session's Cookie header. */
async function contextWith(cookie: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const pairs = cookie.split("; ").map((pair) => pair.split("="));
  await context.addCookies(pairs.map(([name, value]) => ({ name: name!, value: value!, url: app.url })));
  return context;
}
const page = await (await contextWith(ada.cookie())).newPage();
page.setDefaultTimeout(10_000);
let shot = 0;
const screenshot = (p: Page, name: string) => p.screenshot({ path: join(OUT, `${++shot}-${name}.png`) });

/** Every request the page sent to the server's API, and every console error, CSP violations included. */
const apiCalls: string[] = [];
const consoleErrors: string[] = [];
page.on("request", (request) => {
  const { origin, pathname } = new URL(request.url());
  if (origin === app.url && pathname.startsWith("/api/")) apiCalls.push(`${request.method()} ${pathname}`);
});
page.on("console", (message) => {
  // Chrome reports every non-2xx answer as a failed resource; the steps check those answers themselves.
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const section = (name: string) => page.locator("section", { has: page.getByRole("heading", { name, exact: true }) });
const keyRow = (name: string) => page.locator("table.rows tbody tr", { has: page.getByText(name, { exact: true }) });

try {
  await step("7. In the settings page, a key is made and shown once, and the SDK lists projects with it", async () => {
    await page.goto(`${app.url}/app/settings`);
    await keyRow("Spare").waitFor();
    check((await page.locator(".block h1").textContent()) === "Settings", "the page is headed Settings");
    check((await page.locator("body > nav [aria-current=page]").textContent()) === "Settings", "the navigation marks Settings");
    const cells = (await keyRow("Spare").locator("td").allTextContents()).map((text) => text.trim());
    check(/^ab_[0-9a-f]{16}$/.test(cells[1] ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(cells[2] ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(cells[3] ?? ""), `the Spare key's row reads its prefix, made, and last used: ${JSON.stringify(cells.slice(0, 4))}`);

    await page.getByLabel("Key name").fill("Claude Code");
    await page.getByRole("button", { name: "Create key" }).click();
    const shown = keyRow("Claude Code").locator("xpath=following-sibling::tr[1]").locator(".code-block code");
    await shown.waitFor();
    const key = ((await shown.textContent()) ?? "").trim();
    check(/^ab_[0-9a-f]{16}_[0-9a-f]{32}$/.test(key), "the new key is shown in the ab_<id>_<secret> form");
    check((await page.getByLabel("Key name").inputValue()) === "", "the field is cleared for the next one");
    const neverUsed = (await keyRow("Claude Code").locator("td").allTextContents()).map((text) => text.trim());
    check(neverUsed[3] === "Never", `it's never been used: ${JSON.stringify(neverUsed.slice(0, 4))}`);
    await screenshot(page, "key-shown");

    const projects = await withKey(key).projects.list();
    check(projects.some((p) => p.id === work.id), `the SDK lists Ada's projects with it: ${projects.map((p) => p.name).join(", ")}`);

    await page.reload();
    await keyRow("Claude Code").waitFor();
    check(!((await page.locator("body").textContent()) ?? "").includes(key.split("_")[2]!), "after a reload, the key's secret is nowhere on the page");
    const used = (await keyRow("Claude Code").locator("td").allTextContents()).map((text) => text.trim());
    check(/^\d{4}-\d{2}-\d{2}$/.test(used[3] ?? ""), `its row now has a last use: ${used[3]}`);

    await page.getByRole("button", { name: "Revoke Claude Code" }).click();
    const confirm = page.locator(".confirm");
    await confirm.waitFor();
    check(((await confirm.locator("h2").textContent()) ?? "") === "Revoke Claude Code?", `the revoke asks first: "${await confirm.locator("h2").textContent()}"`);
    await screenshot(page, "key-revoke");
    await confirm.getByRole("button", { name: "Revoke Claude Code" }).click();
    await keyRow("Claude Code").waitFor({ state: "detached" });
    const revoked = await failure(withKey(key).projects.list());
    check(revoked?.status === 401, `revoked in the page, the key gets: ${say(revoked)}`);
    check((await ada.client.keys.list()).map((k) => k.name).join(", ") === "Spare", "the SDK lists only the Spare key");
  });

  await step("8. Change the name in the page, and the navigation shows it", async () => {
    const profile = section("Profile");
    await profile.getByLabel("Name", { exact: true }).fill("Ada King");
    await profile.getByRole("button", { name: "Save profile" }).click();
    await page.locator("body > nav .nav-account", { hasText: "Ada King" }).waitFor();
    check((await profile.locator("[role=status]").textContent())?.includes("saved") ?? false, `the profile says "${await profile.locator("[role=status]").textContent()}"`);
    check((await ada.client.auth.me()).name === "Ada King", "the SDK sees the new name");
    await profile.getByLabel("Email", { exact: true }).fill("bea@example.com");
    await profile.getByRole("button", { name: "Save profile" }).click();
    const taken = profile.locator(".error");
    await taken.waitFor();
    const marked = await profile.getByLabel("Email", { exact: true }).getAttribute("aria-invalid");
    check(marked === "true", `Bea's email is refused with "${await taken.textContent()}", and the email field is marked`);
    await screenshot(page, "profile-refused");
    await ada.client.account.update({ name: ADA.name, email: ADA.email });
  });

  await step("9. Changing the password in the page needs the current one and logs out another browser", async () => {
    const other = app.browser();
    await other.client.auth.logIn({ email: ADA.email, password: ADA.password });
    const elsewhere = await (await contextWith(other.cookie())).newPage();
    await elsewhere.goto(`${app.url}/app/projects`);
    await elsewhere.locator("table.rows").waitFor();
    check(true, "another browser is logged in and lists projects");

    await page.goto(`${app.url}/app/settings`);
    const password = section("Password");
    await password.getByLabel("Current password").fill("the wrong password");
    await password.getByLabel("New password").fill("a new and longer password");
    await password.getByRole("button", { name: "Change password" }).click();
    const refusal = password.locator(".error");
    await refusal.waitFor();
    const current = await password.getByLabel("Current password").evaluate((input) => ({ invalid: input.getAttribute("aria-invalid"), focused: input === document.activeElement }));
    check((await refusal.textContent()) === "That isn't your current password." && current.invalid === "true" && current.focused, `a wrong current password says "${await refusal.textContent()}", marking that field: ${JSON.stringify(current)}`);
    await screenshot(page, "password-refused");
    await elsewhere.reload();
    await elsewhere.locator("table.rows").waitFor();
    check(true, "the other browser is still logged in");

    await password.getByLabel("Current password").fill(ADA.password);
    await password.getByRole("button", { name: "Change password" }).click();
    await password.locator("[role=status]").waitFor();
    check((await password.getByLabel("Current password").inputValue()) === "" && (await password.getByLabel("New password").inputValue()) === "", "both fields are cleared");
    check((await password.locator(".error").count()) === 0, "the refusal is gone");
    await screenshot(page, "password-changed");

    await elsewhere.goto(`${app.url}/app/projects`);
    await elsewhere.waitForURL(/\/login\?next=/);
    check(true, `the other browser is sent to log in: ${new URL(elsewhere.url()).pathname}`);
    await page.locator("body > nav").getByRole("link", { name: "Projects", exact: true }).click();
    await page.locator("table.rows").waitFor();
    check(true, "this browser stays logged in");
    await ada.client.account.changePassword({ currentPassword: "a new and longer password", newPassword: ADA.password });
  });

  await step("10. The setup snippets carry this server's address", async () => {
    await page.goto(`${app.url}/app/settings`);
    const agents = section("Connect an agent");
    await agents.waitFor();
    const blocks = agents.locator(".code-block");
    const captions = (await blocks.locator("figcaption > span").allTextContents()).map((text) => text.trim());
    check(JSON.stringify(captions) === JSON.stringify(["Claude Code", "Claude Desktop", "Cursor"]), `a snippet for each agent: ${captions.join(", ")}`);
    const [claudeCode, desktop, cursor] = (await blocks.locator("code").allTextContents()).map((text) => text.trim());
    check((claudeCode ?? "").startsWith("claude mcp add") && (claudeCode ?? "").includes(`ASKED_BEFORE_URL=${app.url}`), "Claude Code's command names this server");
    for (const [what, snippet] of [["Claude Desktop", desktop], ["Cursor", cursor]] as const) {
      const server = (JSON.parse(snippet ?? "{}") as { mcpServers?: Record<string, { env?: Record<string, string> }> }).mcpServers?.["asked-before"];
      check(server?.env?.ASKED_BEFORE_URL === app.url, `${what}'s config is JSON naming this server: ${server?.env?.ASKED_BEFORE_URL}`);
    }
    await agents.scrollIntoViewIfNeeded();
    await screenshot(page, "connect-an-agent");
  });

  await step("11. The page reached the server only through /api/v1, within its security policy", async () => {
    const outside = apiCalls.filter((call) => !call.split(" ")[1]!.startsWith("/api/v1/"));
    check(apiCalls.length > 0 && outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
}

console.log(`\nscreenshots in ${OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nSettings hold up.");
