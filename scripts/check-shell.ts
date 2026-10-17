// Checks the app shell (m1kuorg/basics#42) in a real browser at 1920×1080, on
// a fresh copy of the app: the public pages and the not-found page, signing
// up and landing on the dashboard, the top navigation and every screen's
// route, creating, renaming, and deleting a project with its confirmation
// (each checked again through the SDK), logging out, and an app page visited
// while logged out sending you to log in and back. The page must reach the
// server only through /api/v1, and break no rule of the content security
// policy. It saves a screenshot per step, prints each step's checks, and
// exits 1 if any fails, naming the step.
// Run: bun run check:shell [screenshot dir]

import type { Project } from "@asked-before/sdk";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
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
const heading = async (p: Page) => ((await p.locator(".block h1").first().textContent()) ?? "").trim();
const row = (name: string) => page.locator("table.rows tbody tr", { has: page.getByRole("link", { name, exact: true }) });

try {
  await step("1. The public pages answer, and a missing page is a 404 page", async () => {
    for (const [what, at, status] of [
      ["the landing page", "/", 200],
      ["the docs", "/docs", 200],
      ["log in", "/login", 200],
      ["sign up", "/signup", 200],
      ["the app", "/app", 200],
      ["an app screen", "/app/projects/p1", 200],
      ["a missing page", "/no-such-page", 404],
    ] as const) {
      const response = await fetch(new URL(at, app.url));
      const type = response.headers.get("content-type") ?? "";
      check(response.status === status && type.startsWith("text/html"), `${what} (${at}): ${response.status}, ${type}`);
    }
    await page.goto(`${app.url}/no-such-page`);
    check((await heading(page)) === "This page doesn't exist", `the missing page says "${await heading(page)}"`);
    for (const name of ["Log in", "Sign up"]) {
      check(await page.locator("nav").getByRole("link", { name, exact: true }).isVisible(), `its navigation has ${name}`);
    }
  });

  await step("2. Sign up: a weak password is refused, then the dashboard", async () => {
    await page.goto(app.url);
    await page.locator("nav").getByRole("link", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/signup$/);
    await page.getByLabel("Name").fill(ADA.name);
    await page.getByLabel("Email").fill(ADA.email);
    await page.getByLabel("Password").fill("too short");
    await page.getByRole("button", { name: "Sign up" }).click();
    const refusal = page.locator(".block .error");
    await refusal.waitFor();
    check(/10 characters/.test((await refusal.textContent()) ?? ""), `a 9-character password says "${await refusal.textContent()}"`);
    check(path(page) === "/signup", `and stays on ${path(page)}`);
    const password = page.getByLabel("Password");
    const marked = await password.evaluate((input) => ({
      invalid: input.getAttribute("aria-invalid"),
      described: (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent),
      focused: input === document.activeElement,
    }));
    check(marked.invalid === "true" && marked.focused && marked.described.includes("A password needs at least 10 characters."), `the password field is marked, described by the notice, and focused: ${JSON.stringify(marked)}`);
    await page.getByLabel("Password").fill(ADA.password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/app$/);
    await page.locator(".block h1").waitFor();
    check((await heading(page)) === "Still borrowed", `signing up lands on the dashboard: "${await heading(page)}" at ${path(page)}`);
    const nav = page.locator("body > nav");
    check((await nav.locator('[aria-current="page"]').textContent()) === "Dashboard", "the navigation marks Dashboard as the current page");
    check((await nav.textContent())?.includes(ADA.name) ?? false, "the navigation names the account");
    check((await page.title()).startsWith("Dashboard"), `the page's title is "${await page.title()}"`);
  });

  await step("3. Projects: the empty state, then create two", async () => {
    await page.locator("body > nav").getByRole("link", { name: "Projects", exact: true }).click();
    await page.waitForURL(/\/app\/projects$/);
    await page.locator(".block .empty").waitFor();
    check((await page.locator(".block .empty h2").textContent()) === "No projects yet", `the empty state says "${await page.locator(".block .empty h2").textContent()}"`);
    for (const name of ["Work", "Bootcamp"]) {
      await page.getByLabel("New project").fill(name);
      await page.getByRole("button", { name: "Create project" }).click();
      await row(name).waitFor();
    }
    check((await page.locator("table.rows tbody tr").count()) === 2, "both projects are rows in the list");
    check((await page.getByLabel("New project").inputValue()) === "", "the field is cleared for the next one");
    const cells = (await row("Work").locator("td").allTextContents()).map((text) => text.trim());
    check(cells[1] === "0" && cells[2] === "0" && cells[3] === "0" && cells[4] === "None yet", `Work's row reads ${JSON.stringify(cells.slice(0, 5))}`);
    await page.getByLabel("New project").fill("   ");
    await page.getByRole("button", { name: "Create project" }).click();
    const refusal = page.locator(".block .error");
    await refusal.waitFor();
    check((await refusal.textContent()) === "A project needs a name.", `a blank name says "${await refusal.textContent()}"`);

    await api.auth.logIn({ email: ADA.email, password: ADA.password });
    const names = (await api.projects.list()).map((project) => project.name);
    check(names.join(", ") === "Work, Bootcamp", `the API lists ${names.join(", ")}`);
  });

  await step("4. Rename a project in its row", async () => {
    await row("Work").getByRole("button", { name: "Rename Work" }).click();
    const input = page.getByLabel("Name of Work");
    check((await input.inputValue()) === "Work" && (await input.evaluate((el) => el === document.activeElement)), "the row's name becomes a field holding it, with focus");
    await input.press("Escape");
    check((await row("Work").getByRole("button", { name: "Rename Work" }).isVisible()), "Escape leaves the name as it was");
    await row("Work").getByRole("button", { name: "Rename Work" }).click();
    await page.getByLabel("Name of Work").fill("Day job");
    await page.getByLabel("Name of Work").press("Enter");
    await row("Day job").waitFor();
    check((await row("Work").count()) === 0, "the row now reads Day job");
    const names = (await api.projects.list()).map((project) => project.name);
    check(names.join(", ") === "Day job, Bootcamp", `the API lists ${names.join(", ")}`);
  });

  await step("5. Delete a project, after its confirmation", async () => {
    await row("Bootcamp").getByRole("button", { name: "Delete Bootcamp" }).click();
    const notice = page.locator("table.rows .confirm");
    await notice.waitFor();
    const said = ((await notice.textContent()) ?? "").replace(/\s+/g, " ");
    check(/uploads, phrasings, cards, and reps/.test(said) && /can't be undone/.test(said), `the confirmation names what goes: "${said}"`);
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    check(focused === "Keep it", `focus starts on the safe choice: "${focused}"`);
    await page.screenshot({ path: join(OUT, `${shot}b-confirm.png`) });
    await page.getByRole("button", { name: "Keep it" }).click();
    check((await notice.count()) === 0 && (await row("Bootcamp").count()) === 1, "Keep it closes the confirmation and keeps the project");
    check((await api.projects.list()).length === 2, "the API still lists both");

    await row("Bootcamp").getByRole("button", { name: "Delete Bootcamp" }).click();
    await page.getByRole("button", { name: "Delete Bootcamp" }).last().click();
    await row("Bootcamp").waitFor({ state: "detached" });
    const left = (await api.projects.list()).map((project) => project.name);
    check(left.join(", ") === "Day job", `the API lists only ${left.join(", ")}`);
  });

  await step("6. Every screen has its route, and back and forward work", async () => {
    const [dayJob] = (await api.projects.list()) as [Project];
    await page.getByRole("link", { name: "Day job", exact: true }).click();
    await page.waitForURL(new RegExp(`/app/projects/${dayJob.id}$`));
    await page.locator(".block h1", { hasText: "Day job" }).waitFor();
    check((await heading(page)) === "Day job", `the project's screen is headed "${await heading(page)}"`);
    check((await page.locator("body > nav [aria-current=page]").textContent()) === "Projects", "the navigation keeps Projects current inside a project");
    await page.goBack();
    await row("Day job").waitFor();
    check(path(page) === "/app/projects", `back returns to ${path(page)}`);
    await page.goForward();
    await page.waitForURL(new RegExp(`/app/projects/${dayJob.id}$`));
    check(true, "forward returns to the project");

    for (const [at, title] of [
      [`/app/projects/${dayJob.id}/upload`, "Upload a chat export"],
      ["/app/cards/c1", "Card"],
      ["/app/settings", "Settings"],
      ["/app/no-such-screen", "This page doesn't exist"],
    ] as const) {
      await page.goto(`${app.url}${at}`);
      await page.locator(".block h1").waitFor();
      check((await heading(page)) === title, `${at} shows "${await heading(page)}"`);
    }
    await page.locator("body > nav").getByRole("link", { name: "Settings", exact: true }).click();
    await page.waitForURL(/\/app\/settings$/);
    check((await page.locator(".block").textContent())?.includes(ADA.email) ?? false, "settings shows the account's email");
  });

  await step("7. Log out", async () => {
    await page.locator("body > nav").getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login$/);
    check(path(page) === "/login", `logging out goes to ${path(page)}`);
    const me = await page.evaluate(() => fetch("/api/v1/auth/me").then((r) => r.status));
    check(me === 401, `the page's session is over: /auth/me answers ${me}`);
  });

  await step("8. Logged out, an app page sends you to log in and back", async () => {
    await page.goto(`${app.url}/app/projects?from=bookmark`);
    await page.waitForURL(/\/login\?/);
    const next = new URL(page.url()).searchParams.get("next");
    check(next === "/app/projects?from=bookmark", `sent to log in with next=${next}`);
    await page.getByLabel("Email").fill(ADA.email);
    await page.getByLabel("Password").fill("the wrong password");
    await page.getByRole("button", { name: "Log in" }).click();
    const refusal = page.locator(".block .error");
    await refusal.waitFor();
    check((await refusal.textContent()) === "Wrong email or password.", `a wrong password says "${await refusal.textContent()}"`);
    check((await page.locator("[aria-invalid]").count()) === 0, "and marks neither field, so it doesn't say which was wrong");
    await page.getByLabel("Password").fill(ADA.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/app\/projects\?from=bookmark$/);
    await row("Day job").waitFor();
    check(path(page) === "/app/projects?from=bookmark", `and back to ${path(page)}, with Day job listed`);
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
