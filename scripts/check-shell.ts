// Checks the app shell (m1kuorg/basics#42) in a real browser at 1920×1080, on
// a fresh copy of the app: the public pages and the not-found page, signing
// up and landing on Home, the sidebar's navigation and every screen's
// route, creating, renaming, and deleting a shelf with its confirmation
// (each checked again through the SDK), logging out, and an app page visited
// while logged out sending you to log in and back. The page must reach the
// server only through /api/v1, and break no rule of the content security
// policy. It saves a screenshot per step, prints each step's checks, and
// exits 1 if any fails, naming the step.
// Run: bun run check:shell [screenshot dir]

import type { Shelf } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { startApp } from "./lib/app";

const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-shell");
const FRAME = { width: 1920, height: 1080 };
const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };

const failures: string[] = [];
let current = "";
let shot = 0;

const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(`${current}: ${what}`);
};

await mkdir(OUT, { recursive: true });
const app = await startApp();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(10_000);

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

/** The same learner through the SDK, on a session of its own, to check what the page did. */
const api = app.browser().client;

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

const path = (p: Page) => {
  const url = new URL(p.url());
  return url.pathname + url.search;
};
const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const main = page.getByRole("main");
const nav = page.getByRole("navigation", { name: "Asked Before" });
const heading = (p: Page) => say(p.getByRole("main").getByRole("heading", { level: 1 }));
/** A shelf's row in the shelves table, by its name's link. */
const row = (name: string) => main.getByRole("table").locator("tbody tr", { has: page.getByRole("link", { name, exact: true }) });
/** A form's message, which every form shows as role="alert" inside the main. */
const alert = main.getByRole("alert");

try {
  await step("1. The public pages answer, and a missing page is a 404 page", async () => {
    for (const [what, at, status] of [
      ["the landing page", "/", 200],
      ["the docs", "/docs", 200],
      ["log in", "/login", 200],
      ["sign up", "/signup", 200],
      ["Home", "/app/desk", 200],
      ["an app screen", "/app/shelves/p1", 200],
      ["the app's root", "/app", 200],
      ["a missing page", "/no-such-page", 404],
    ] as const) {
      const response = await fetch(new URL(at, app.url));
      const type = response.headers.get("content-type") ?? "";
      check(response.status === status && type.startsWith("text/html"), `${what} (${at}): ${response.status}, ${type}`);
    }
    await page.goto(`${app.url}/no-such-page`);
    await main.getByRole("heading", { level: 1 }).waitFor();
    check((await heading(page)) === "This page doesn't exist", `the missing page says "${await heading(page)}"`);
    const back = main.getByRole("link", { name: "Go to the start of Asked Before", exact: true });
    check((await back.getAttribute("href")) === "/" && (await nav.getByRole("link", { name: "Asked Before", exact: true }).getAttribute("href")) === "/", "it leads back to the start of Asked Before");
  });

  await step("2. Sign up: a weak password is refused, then Home", async () => {
    await page.goto(app.url);
    // The landing page's own Sign up, in its closing question.
    await main.getByRole("link", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/signup$/);
    await page.getByLabel("Name", { exact: true }).fill(ADA.name);
    await page.getByLabel("Email", { exact: true }).fill(ADA.email);
    await page.getByLabel("Password", { exact: true }).fill("too short");
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    await alert.waitFor();
    check(/10 characters/.test(await say(alert)), `a 9-character password says "${await say(alert)}"`);
    check(path(page) === "/signup", `and stays on ${path(page)}`);
    const password = page.getByLabel("Password", { exact: true });
    const marked = await password.evaluate((input) => ({
      invalid: input.getAttribute("aria-invalid"),
      described: (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent),
      focused: input === document.activeElement,
    }));
    check(marked.invalid === "true" && marked.focused && marked.described.includes("A password needs at least 10 characters."), `the password field is marked, described by the notice, and focused: ${JSON.stringify(marked)}`);
    await password.fill(ADA.password);
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    // A new account's Home: its h1 is built from the data, and has no cards to count yet.
    await main.getByRole("heading", { level: 1, name: "No cards yet.", exact: true }).waitFor();
    check((await heading(page)) === "No cards yet.", `signing up lands on Home: "${await heading(page)}" at ${path(page)}`);
    const current = nav.locator('[aria-current="page"]');
    check((await current.count()) === 1 && (await say(current)) === "Home", `the navigation marks Home as the current page: "${await say(current)}"`);
    check((await nav.textContent())?.includes(ADA.name) ?? false, "the navigation names the account");
    check((await page.title()).startsWith("Home"), `the page's title is "${await page.title()}"`);
  });

  await step("3. Shelves: the empty state, then create two", async () => {
    await nav.getByRole("link", { name: "All shelves", exact: true }).click();
    await page.waitForURL(/\/app\/shelves$/);
    const empty = main.locator('[data-slot="empty-title"]');
    await empty.waitFor();
    check((await say(empty)) === "No shelves yet", `the empty state says "${await say(empty)}"`);
    const field = main.getByLabel("New shelf", { exact: true });
    for (const name of ["Work", "Bootcamp"]) {
      await field.fill(name);
      await main.getByRole("button", { name: "Add shelf", exact: true }).click();
      await row(name).waitFor();
    }
    check((await main.getByRole("table").locator("tbody tr").count()) === 2, "both shelves are rows in the list");
    check((await field.inputValue()) === "", "the field is cleared for the next one");
    // Name, Cards, Need a rep, Proven, Last upload; the name's cell also holds the phone's second line.
    const cells = (await row("Work").locator("td").allTextContents()).map((text) => text.trim());
    check(cells[1] === "0" && cells[2] === "0" && cells[3] === "0" && cells[4] === "None yet", `Work's row reads ${JSON.stringify(cells.slice(1, 5))}`);
    check(await nav.getByRole("link", { name: "Bootcamp", exact: true }).isVisible(), "and the sidebar lists the new shelves");
    await field.fill("   ");
    await main.getByRole("button", { name: "Add shelf", exact: true }).click();
    await alert.waitFor();
    check((await say(alert)) === "A shelf needs a name.", `a blank name says "${await say(alert)}"`);

    await api.auth.logIn({ email: ADA.email, password: ADA.password });
    const names = (await api.shelves.list()).map((shelf) => shelf.name);
    check(names.join(", ") === "Work, Bootcamp", `the API lists ${names.join(", ")}`);
  });

  await step("4. Rename a shelf in its row", async () => {
    await row("Work").getByRole("button", { name: "Rename Work", exact: true }).click();
    const input = main.getByLabel("Name of Work", { exact: true });
    check((await input.inputValue()) === "Work" && (await input.evaluate((el) => el === document.activeElement)), "the row's name becomes a field holding it, with focus");
    await input.press("Escape");
    check(await row("Work").getByRole("button", { name: "Rename Work", exact: true }).isVisible(), "Escape leaves the name as it was");
    await row("Work").getByRole("button", { name: "Rename Work", exact: true }).click();
    await main.getByLabel("Name of Work", { exact: true }).fill("Day job");
    await main.getByLabel("Name of Work", { exact: true }).press("Enter");
    await row("Day job").waitFor();
    check((await row("Work").count()) === 0, "the row now reads Day job");
    const names = (await api.shelves.list()).map((shelf) => shelf.name);
    check(names.join(", ") === "Day job, Bootcamp", `the API lists ${names.join(", ")}`);
  });

  await step("5. Delete a shelf, after its confirmation", async () => {
    await row("Bootcamp").getByRole("button", { name: "Delete Bootcamp…", exact: true }).click();
    const confirm = main.getByRole("table").getByRole("group", { name: "Delete Bootcamp?", exact: true });
    await confirm.waitFor();
    const said = await say(confirm);
    check(/uploads, messages, cards, and cold reps/.test(said) && /can't be undone/.test(said), `the confirmation names what goes: "${said}"`);
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    check(focused === "Keep it", `focus starts on the safe choice: "${focused}"`);
    await page.screenshot({ path: join(OUT, `${shot}b-confirm.png`) });
    await confirm.getByRole("button", { name: "Keep it", exact: true }).click();
    check((await confirm.count()) === 0 && (await row("Bootcamp").count()) === 1, "Keep it closes the confirmation and keeps the shelf");
    check((await api.shelves.list()).length === 2, "the API still lists both");

    await row("Bootcamp").getByRole("button", { name: "Delete Bootcamp…", exact: true }).click();
    await confirm.getByRole("button", { name: "Delete Bootcamp", exact: true }).click();
    await row("Bootcamp").waitFor({ state: "detached" });
    const left = (await api.shelves.list()).map((shelf) => shelf.name);
    check(left.join(", ") === "Day job", `the API lists only ${left.join(", ")}`);
  });

  await step("6. Every screen has its route, and back and forward work", async () => {
    const [dayJob] = (await api.shelves.list()) as [Shelf];
    await main.getByRole("link", { name: "Day job", exact: true }).click();
    await page.waitForURL(new RegExp(`/app/shelves/${dayJob.id}$`));
    await main.getByRole("heading", { level: 1, name: "Day job", exact: true }).waitFor();
    check((await heading(page)) === "Day job", `the shelf's screen is headed "${await heading(page)}"`);
    const current = nav.locator("[aria-current=page]");
    check((await current.count()) === 1 && (await say(current)) === "Day job", `the navigation marks the shelf itself as current inside it: "${await say(current)}"`);
    await page.goBack();
    await row("Day job").waitFor();
    check(path(page) === "/app/shelves", `back returns to ${path(page)}`);
    await page.goForward();
    await page.waitForURL(new RegExp(`/app/shelves/${dayJob.id}$`));
    check(true, "forward returns to the shelf");

    for (const [at, title] of [
      // Home's h1 for an account with a shelf and no cards.
      ["/app", "No cards yet."],
      [`/app/shelves/${dayJob.id}/upload`, "Upload a chat export"],
      // A card that isn't there is the app's not-found screen.
      ["/app/cards/c1", "This page doesn't exist"],
      ["/app/settings", "Settings"],
      ["/app/no-such-screen", "This page doesn't exist"],
    ] as const) {
      await page.goto(`${app.url}${at}`);
      await main.getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
      check((await heading(page)) === title, `${at} shows "${await heading(page)}"`);
    }
    await nav.getByRole("link", { name: "Settings", exact: true }).click();
    await page.waitForURL(/\/app\/settings$/);
    await main.getByRole("heading", { level: 1, name: "Settings", exact: true }).waitFor();
    check((await main.textContent())?.includes(ADA.email) ?? false, "settings shows the account's email");
  });

  await step("7. Log out", async () => {
    await nav.getByRole("button", { name: "Log out", exact: true }).click();
    await page.waitForURL(/\/login$/);
    check(path(page) === "/login", `logging out goes to ${path(page)}`);
    const me = await page.evaluate(() => fetch("/api/v1/auth/me").then((r) => r.status));
    check(me === 401, `the page's session is over: /auth/me answers ${me}`);
  });

  await step("8. Logged out, an app page sends you to log in and back", async () => {
    await page.goto(`${app.url}/app/shelves?from=bookmark`);
    await page.waitForURL(/\/login\?/);
    const next = new URL(page.url()).searchParams.get("next");
    check(next === "/app/shelves?from=bookmark", `sent to log in with next=${next}`);
    await page.getByLabel("Email", { exact: true }).fill(ADA.email);
    await page.getByLabel("Password", { exact: true }).fill("the wrong password");
    await main.getByRole("button", { name: "Log in", exact: true }).click();
    await alert.waitFor();
    check((await say(alert)) === "Wrong email or password.", `a wrong password says "${await say(alert)}"`);
    check((await page.locator("[aria-invalid]").count()) === 0, "and marks neither field, so it doesn't say which was wrong");
    await page.getByLabel("Password", { exact: true }).fill(ADA.password);
    await main.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/app\/shelves\?from=bookmark$/);
    await row("Day job").waitFor();
    check(path(page) === "/app/shelves?from=bookmark", `and back to ${path(page)}, with Day job listed`);
  });

  await step("9. The page reached the server only through /api/v1, within its security policy", async () => {
    const outside = apiCalls.filter((call) => !call.split(" ")[1]!.startsWith("/api/v1/"));
    check(apiCalls.length > 0 && outside.length === 0, `${apiCalls.length} API calls, ${outside.length} outside /api/v1${outside.length ? `: ${outside.join(", ")}` : ""}`);
    check(consoleErrors.length === 0, `no console errors or policy violations${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.stop();
}

console.log(`\nscreenshots in ${OUT}`);
console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
