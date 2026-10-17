// Checks the landing page (m1kuorg/basics#52) in a real browser at 1920×1080,
// on a fresh copy of the app: card A of the demo export, set with the rail's
// markup and matched against the answer key; the pitch, the three steps, the
// privacy line, and the agents section; signing up and logging in from the
// landing page, each confirmed through the SDK; and no claims about users,
// no tells from the planning context's list, no request outside /api/v1,
// and no breach of the content security policy. It saves a screenshot per
// step, prints each step's checks, and exits 1 if any fails, naming the step.
// Run: bun run check:landing [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startApp } from "./lib/app";

const ROOT = join(import.meta.dir, "..");
const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-landing");
const FRAME = { width: 1920, height: 1080 };
const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };

/** The answer key's card A, the independent source for the card's name, count, and months (UTC). */
const answerKey: { skills: { name: string; count: number; firstMonth: string; lastMonth: string }[] } = await Bun.file(join(ROOT, "demo/answer-key.json")).json();
const A = answerKey.skills[0]!;
const exportText = await Bun.file(join(ROOT, "demo/export.json")).text();
/** The one-line pitch: the product's purpose, from PRODUCT.md as devpost/scope.md quotes it. */
const PITCH = "Turn a question you keep asking into one you can answer without AI.";
/** The privacy line, as the spec (m1kuorg/basics#40, Privacy) words it. */
const PRIVACY =
  "Only your own messages, with when you sent them, leave this computer. The chatbot's answers and your titles never do, and the model sees your words only, never your dates.";

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
// The answer key's months are in UTC, so the page is read in UTC too.
const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" });
const page = await context.newPage();
page.setDefaultTimeout(10_000);

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

try {
  await step("1. The landing page sets card A of the demo export on the rail", async () => {
    await page.goto(app.url);
    await page.locator(".block .rail").first().waitFor();
    check((await text(".block .skill")) === A.name, `the card is "${await text(".block .skill")}"`);
    check(await page.locator(".block .heading .demo-label").isVisible(), "the card is labeled demo data beside its name");
    const line = await text(".landing-card p:not([class])");
    check(line.includes(`${A.count} times`) && line.includes(A.firstMonth) && line.includes(A.lastMonth), `its line reads "${line}"`);
    check((await text(".block .plate b")) === String(A.count), `the plate counts ${await text(".block .plate b")}`);
    const rows = await page.locator(".block .rail > li").evaluateAll((items) =>
      items.map((li) => ({
        phrasing: li.querySelector(".phrasing")?.textContent ?? "",
        key: li.querySelector(".rail-key") !== null,
        date: li.querySelector(".stamp time")?.getAttribute("datetime") ?? "",
        shown: li.querySelector(".stamp time")?.textContent ?? "",
      })),
    );
    check(rows.length === A.count, `the rail holds ${rows.length} borrows`);
    check(rows.every((row) => row.key), "every borrow has its key on the rail");
    check(rows.every((row) => row.phrasing && exportText.includes(JSON.stringify(row.phrasing))), "every phrasing is a message from the demo export, word for word");
    const times = rows.map((row) => Date.parse(row.date));
    check(times.every((t, i) => Number.isFinite(t) && (i === 0 || t >= times[i - 1]!)), "the borrows run in date order");
    check(rows.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.shown) && row.date.startsWith(row.shown)), "each stamp shows the date it was sent");
    const years = await page.locator(".block .rail").evaluateAll((rails) => rails.map((rail) => rail.getAttribute("aria-label")));
    check(years.join(", ") === "Borrowed in 2025, Borrowed in 2026", `one rail per year: ${years.join(", ")}`);
    // The page's script carries card A and nothing else of the demo: no other card, no one-off, no answer key.
    const scripts = await page.locator("script[src]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));
    const bundle = (await Promise.all(scripts.map(async (src) => (await fetch(src)).text()))).join("\n");
    const others = answerKey.skills.slice(1).map((skill) => skill.name);
    check(bundle.length > 0 && others.every((name) => !bundle.includes(name)) && !bundle.includes("Never served") && !bundle.includes("oneOffs"), "the page's script holds card A only, never the answer key or the other cards");
    for (const at of ["/demo/answer-key.json", "/demo/known-answers.json"]) {
      check((await fetch(new URL(at, app.url))).status === 404, `${at} is never served`);
    }
  });

  await step("2. It says what Asked Before does, its three steps, what leaves this computer, and that agents reach it", async () => {
    check((await page.locator(".block h1").count()) === 1, "one heading for the page");
    check((await text(".block h1")) === PITCH, `the pitch reads "${await text(".block h1")}"`);
    const headings = (await page.locator(".block h2").allTextContents()).map((h) => h.trim());
    check(headings.includes(A.name), "the card is one section");
    const steps = (await page.locator(".landing-steps > li h3").allTextContents()).map((h) => h.trim());
    check(steps.join(" / ") === "Upload a chat export / See your cards / Pass a cold rep", `the three steps: ${steps.join(" / ")}`);
    const body = ((await page.locator(".block").textContent()) ?? "").replace(/\s+/g, " ");
    check(body.includes(PRIVACY), "the spec's privacy line is said in full");
    const agents = await page.locator(".landing-agents").textContent();
    check(["Claude Code", "Claude Desktop", "Cursor"].every((name) => agents?.includes(name)), "the agents section names Claude Code, Claude Desktop, and Cursor");
    check(await page.locator(".landing-agents a[href='/docs']").isVisible(), "and leads to the docs");
  });

  await step("3. Sign up in the landing page's close: a weak password is refused, then the dashboard", async () => {
    const close = page.locator(".landing-close");
    await close.getByLabel("Name").fill(ADA.name);
    await close.getByLabel("Email").fill(ADA.email);
    await close.getByLabel("Password").fill("too short");
    await close.getByRole("button", { name: "Sign up" }).click();
    const refusal = close.locator(".error");
    await refusal.waitFor();
    check(/10 characters/.test((await refusal.textContent()) ?? ""), `a 9-character password says "${await refusal.textContent()}"`);
    check(new URL(page.url()).pathname === "/", "and the visitor stays on the landing page");
    await close.getByLabel("Password").fill(ADA.password);
    await close.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/app$/);
    await page.locator(".block h1").waitFor();
    check((await text(".block h1")) === "Dashboard", `signing up lands on the dashboard: "${await text(".block h1")}"`);
    const api = app.browser().client;
    const session = await api.auth.logIn({ email: ADA.email, password: ADA.password });
    check(session.account.name === ADA.name, `the SDK logs in as the new account, ${session.account.name}`);
  });

  await step("4. Log in from the landing page's head, on a fresh browser", async () => {
    await page.context().clearCookies();
    await page.goto(app.url);
    await page.locator(".block .landing-lede").getByRole("link", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/login$/);
    await page.getByLabel("Email").fill(ADA.email);
    await page.getByLabel("Password").fill(ADA.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/app$/);
    await page.locator(".block h1").waitFor();
    check((await text(".block h1")) === "Dashboard", `logging in lands on the dashboard: "${await text(".block h1")}"`);
    check((await page.locator("body > nav").textContent())?.includes(ADA.name) ?? false, "the navigation names the account");
    await page.context().clearCookies();
    await page.goto(app.url);
    for (const [where, locator] of [
      ["head", page.locator(".landing-lede")],
      ["close", page.locator(".landing-close")],
      ["navigation", page.locator("body > nav")],
    ] as const) {
      const hrefs = await locator.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      check(where === "close" ? hrefs.includes("/login") : hrefs.includes("/signup") && hrefs.includes("/login"), `the ${where} leads to ${hrefs.join(" and ")}`);
    }
  });

  await step("5. No claims, none of the generic AI look, and only the app's own requests", async () => {
    const visitor = await (await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 })).newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    visitor.on("request", (request) => requests.push(request.url()));
    visitor.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    visitor.on("pageerror", (error) => errors.push(error.message));
    await visitor.goto(app.url);
    await visitor.locator(".block .rail").first().waitFor();
    await visitor.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));
    const words = ((await visitor.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    const claims = words.match(/\b(users?|customers?|testimonials?|trusted|loved|reviews?|rated|thousands|millions|join (?:over|thousands))\b|\d+\s?%|\d+[kKmM]\+|★/gi) ?? [];
    check(claims.length === 0, `no claims about users or numbers${claims.length ? ` (found ${claims.join(", ")})` : ""}`);
    const tells = await visitor.evaluate(() => {
      const found: string[] = [];
      if (/→|\p{Extended_Pictographic}/u.test(document.body.textContent ?? "")) found.push("an arrow or emoji in the copy");
      if (document.querySelector("body svg, body img, body canvas, body video")) found.push("an icon, image, or chart");
      for (const heading of document.querySelectorAll(".block :is(h1, h2, h3)")) {
        const before = heading.previousElementSibling;
        if (before && getComputedStyle(before).textTransform === "uppercase") found.push(`an all-caps eyebrow over "${heading.textContent}"`);
      }
      for (const node of document.querySelectorAll("body *")) {
        if (getComputedStyle(node).backgroundImage !== "none") found.push(`a gradient or image on ${node.tagName.toLowerCase()}.${node.className}`);
      }
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect).target;
        if (!target?.matches(".rail-key")) found.push(`motion on ${target?.tagName.toLowerCase()}.${target?.className}`);
      }
      const faces = new Set([...document.querySelectorAll("body *")].map((node) => getComputedStyle(node).fontFamily));
      for (const face of faces) if (!face.startsWith('"Hanken Grotesk"')) found.push(`the face ${face}`);
      return found;
    });
    check(tells.length === 0, `none of the planning context's tells${tells.length ? ` (found ${tells.join("; ")})` : ""}`);
    const outside = requests.filter((url) => {
      const { origin, pathname } = new URL(url);
      return origin !== app.url || (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1/"));
    });
    check(outside.length === 0, `every request stays on the app's origin and API${outside.length ? ` (also ${outside.join(", ")})` : ""}`);
    check(errors.length === 0, `no console errors or security-policy breaches${errors.length ? ` (${errors.join("; ")})` : ""}`);
    await visitor.screenshot({ path: join(OUT, "5-visitor.png") });
  });
} finally {
  await browser.close();
  await app.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
