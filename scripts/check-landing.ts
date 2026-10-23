// Checks the landing page (m1kuorg/basics#52) in a real browser at 1920×1080,
// on a fresh copy of the app: card A of the demo export, its nine messages
// set word for word with their dates and matched against the answer key; the
// showcase, which matches what you type against the demo cards in the
// browser, card A as the answer key has it and the others as the guest's
// sorted demo shelf (demo/sorted.json) names them; the pitch, how it works,
// what leaves this computer, and the agents; the answer key and the known
// answers in no bundle or page; signing up and logging in from the landing
// page's links, each confirmed through the SDK; and, for a fresh visitor, no
// claims about users, no API request on load or while typing, no request
// off the app's origin, no breach of the content security policy, and "Try
// it as a guest" signing in. It saves a screenshot per step, prints each
// step's checks, and exits 1 if any fails, naming the step.
// Run: bun run check:landing [screenshot dir]

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { key, phrasings } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { known } from "./lib/reps";

const ROOT = join(import.meta.dir, "..");
const OUT = process.argv[2] ?? join(tmpdir(), "asked-before-landing");
const FRAME = { width: 1920, height: 1080 };
const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };

/** The answer key's card A, the independent source for the card's name, count, months (UTC), and messages. */
const A = key.skills[0]!;
/** Card A's messages in the demo export, oldest first. */
const asksOfA = A.messageIds.map((id) => phrasings[Number(id.slice(1)) - 1]!).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
/** The guest's sorted demo shelf, which names the landing's other cards. */
const sorted: { cards: { skill: string; phrasings: string[] }[]; phrasings: { sourceId: string; text: string; time: string }[] } = await Bun.file(join(ROOT, "demo/sorted.json")).json();
/** What only the answer key and the known answers hold: their notes, the key's one-offs, the names only the key gives, and the known answers. */
const keyFile: { note: string } = await Bun.file(join(ROOT, "demo/answer-key.json")).json();
const knownFile: { note: string } = await Bun.file(join(ROOT, "demo/known-answers.json")).json();
const SECRETS = [
  keyFile.note,
  "oneOffs",
  ...key.skills.map((skill) => skill.name).filter((name) => !sorted.cards.some((card) => card.skill === name)),
  knownFile.note,
  known.wrong,
  known.right,
];
/** The privacy line, as the spec (m1kuorg/basics#40, Privacy) words it. */
const PRIVACY =
  "Only your own messages, with when you sent them, leave this computer. The chatbot's answers and your titles never do, and the model sees your words only, never your dates.";

// Dates and months as the page writes them, in UTC as the browsers here read them.
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const month = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

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

/** Waits for the page's finite, clock-driven animations and transitions, such as a chapter's entrance; the photograph's drift follows the scroll and never ends. */
const settled = (on: Page) =>
  on
    .evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ).then(() => undefined),
    )
    .catch(() => undefined);

/** Scrolls a chapter into view and lets its entrance finish, for a screenshot of it. */
async function shown(chapter: Locator) {
  await chapter.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await chapter.locator("[data-reveal][data-in]").first().waitFor();
  await settled(page);
}

async function step(name: string, run: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  try {
    await run();
  } catch (error) {
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  await settled(page);
  await page.screenshot({ path: join(OUT, `${++shot}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`) });
}

const say = async (locator: Locator) => ((await locator.first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const main = page.getByRole("main");
const nine = main.getByRole("region", { name: "Nine ways to ask one thing" });
const showcase = main.getByRole("region", { name: "Type something you've asked a chatbot" });
/** The showcase's answer: the matched card, drawn at the app's size (inert, so read by its markup). */
const answer = showcase.locator("div[data-ui]");
/** What the showcase says in words when its answer changes. */
const said = showcase.getByRole("status");
/** What it says once typing has paused: it speaks half a second after the last key, not at every one. */
const saidAfterPause = async () => {
  await page.waitForTimeout(600);
  return say(said);
};

/** The answer card's skill, its line, its label, and the messages it shows, each with its time. */
const answerCard = () =>
  answer.evaluate((card) => ({
    skill: card.querySelector("p")?.textContent ?? "",
    line: card.querySelectorAll("p")[1]?.textContent ?? "",
    label: [...card.querySelectorAll("span")].some((span) => span.textContent === "Demo data"),
    asks: [...card.querySelectorAll("li")].map((li) => ({ text: li.querySelector("span")?.textContent ?? "", at: li.querySelector("time")?.getAttribute("datetime") ?? "", shown: li.querySelector("time")?.textContent ?? "" })),
  }));

/** Whether a file's text holds `secret`, as written or as a minifier escapes its quotes. */
const holds = (text: string, secret: string) => [secret, secret.replaceAll("'", "\\'"), secret.replaceAll('"', '\\"'), JSON.stringify(secret).slice(1, -1)].some((form) => text.includes(form));

try {
  await step("1. The landing page sets card A's nine messages, word for word, with their dates", async () => {
    await page.goto(app.url);
    await nine.waitFor();
    check((await say(nine.getByRole("heading", { level: 2 }))) === "Nine ways to ask one thing", "the chapter is headed Nine ways to ask one thing");
    const lines = (await nine.locator("p").allTextContents()).map((text) => text.replace(/\s+/g, " ").trim());
    check(lines[0] === A.name, `the card is "${lines[0]}"`);
    check(lines[1] === `Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}, never in the same words twice.`, `its line reads "${lines[1]}"`);
    check(await nine.getByText("Demo data", { exact: true }).isVisible(), "labeled demo data");
    const list = nine.getByRole("list", { name: `The ${A.count} messages, oldest first`, exact: true });
    const rows = await list.getByRole("listitem").evaluateAll((items) =>
      items.map((li) => ({ text: li.querySelector("p")?.textContent ?? "", at: li.querySelector("time")?.getAttribute("datetime") ?? "", shown: li.querySelector("time")?.textContent ?? "" })),
    );
    check(rows.length === A.count, `the list holds ${rows.length} messages, the key's card ${A.count}`);
    check(rows.length === A.count && rows.every((row, i) => row.text === asksOfA[i]!.text), "each is card A's message in the demo export, word for word, oldest first");
    check(
      rows.length === A.count && rows.every((row, i) => Date.parse(row.at) === Date.parse(asksOfA[i]!.time) && row.shown === shortDate(asksOfA[i]!.time)),
      `each dated the day it was sent (${rows.map((row) => row.shown).join(", ")})`,
    );
    await shown(nine);
  });

  await step("2. The showcase matches what you type against the demo cards, in the browser, card A as the answer key has it", async () => {
    const field = showcase.getByRole("textbox", { name: "Type something you've asked a chatbot", exact: true });
    await field.fill("how do i undo my last git commit");
    await answer.waitFor();
    const a = await answerCard();
    check(a.skill === A.name && a.label, `it shows card A, "${a.skill}", labeled demo data: ${a.label}`);
    check(a.line === `Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}`, `its line reads "${a.line}"`);
    const byText = new Map(asksOfA.map((ask) => [ask.text, ask]));
    check(
      a.asks.length === 3 && a.asks.every((ask) => byText.has(ask.text) && Date.parse(ask.at) === Date.parse(byText.get(ask.text)!.time) && ask.shown === shortDate(ask.at)),
      `the ${a.asks.length} messages it shows are card A's, word for word, each with the day it was sent (${a.asks.map((ask) => ask.shown).join(", ")})`,
    );
    const saysA = await saidAfterPause();
    check(saysA === `${A.name}. Asked ${A.count} times, ${A.firstMonth} to ${A.lastMonth}. Demo data.`, `and says so: "${saysA}"`);

    // An example refills the line with another demo card, as the guest's sorted demo shelf names it.
    await showcase.getByRole("button", { name: "center a div", exact: true }).click();
    check((await field.inputValue()) === "center a div", "an example refills the line");
    const other = await answerCard();
    const card = sorted.cards.find((each) => each.skill === other.skill);
    const asks = (card?.phrasings ?? []).map((id) => sorted.phrasings.find((p) => p.sourceId === id)!).sort((x, y) => Date.parse(x.time) - Date.parse(y.time));
    check(card !== undefined && /^Center /.test(card.skill), `it shows "${other.skill}", the guest's sorted demo shelf's card on centering`);
    check(asks.length > 0 && other.line === `Asked ${asks.length} times, ${month(asks[0]!.time)} to ${month(asks.at(-1)!.time)}`, `its line reads "${other.line}"`);
    check(other.asks.length > 0 && other.asks.every((ask) => asks.some((p) => p.text === ask.text && Date.parse(p.time) === Date.parse(ask.at))), "its messages are that card's, word for word, with their dates");

    await field.fill("knit a scarf from wool");
    await answer.waitFor({ state: "detached" });
    const saysNone = await saidAfterPause();
    check(/Upload your own export to see yours\.$/.test(saysNone), `a question no demo card asks shows no card: "${saysNone}"`);
    await field.fill("how do i undo my last git commit");
    await answer.waitFor();
    await shown(showcase);
  });

  await step("3. It says what Asked Before does, how it works, what leaves this computer, and that agents reach it", async () => {
    check((await page.getByRole("heading", { level: 1 }).count()) === 1, "one heading for the page");
    check((await say(main.getByRole("heading", { level: 1 }))) === "Asked before?", `it asks "${await say(main.getByRole("heading", { level: 1 }))}"`);
    const body = ((await main.textContent()) ?? "").replace(/\s+/g, " ");
    check(body.includes("Asked Before finds those questions in your own chat history, then tests you on each one without AI."), "and says what Asked Before does");
    const how = main.getByRole("region", { name: "How it works", exact: true });
    const steps = await how.locator(":scope ol > li").evaluateAll((items) => items.map((li) => (li.querySelector("p")?.textContent ?? "").trim()));
    check(steps.join(" / ") === "First, upload your chat export. / Then see what you keep asking. / Finally, prove it without AI.", `how it works, in three steps: ${steps.join(" / ")}`);
    check(body.includes(PRIVACY), "the spec's privacy line is said in full");
    const table = main.getByRole("table", { name: "What leaves your computer when you upload a chat export, and what the model sees", exact: true });
    const rows = await table.locator("tbody tr").evaluateAll((trs) =>
      trs.map((tr) => [tr.querySelector("th")?.textContent ?? "", ...[...tr.querySelectorAll("td")].map((td) => [...td.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(""))].join(": ")),
    );
    for (const row of ["Your own messages: Yes: Your words only", "When you sent them: Yes: Never", "The chatbot's answers: Never: Never", "Conversation titles: Never: Never"]) {
      check(rows.includes(row), `what leaves this computer, and what the model sees: "${row}"`);
    }
    check(body.includes("The server logs requests, never your words."), "and the server logs requests, never your words");
    const agents = main.getByRole("region", { name: "Agents file it as you ask.", exact: true });
    const agentsSay = (await agents.textContent()) ?? "";
    check(["Claude Code", "Claude Desktop", "Cursor"].every((name) => agentsSay.includes(name)), "the agents section names Claude Code, Claude Desktop, and Cursor");
    check((await agents.getByRole("link", { name: "Read the docs", exact: true }).getAttribute("href")) === "/docs", "and leads to the docs");
    await shown(how);
  });

  await step("4. The answer key and the known answers never ship in any bundle or page", async () => {
    // Every file the app serves as a page or an asset: what Wrangler serves from the pages' build.
    const files = [...new Bun.Glob("**/*").scanSync({ cwd: app.pages, dot: true })];
    const texts = await Promise.all(files.map(async (file) => ({ file, text: await Bun.file(join(app.pages, file)).text() })));
    check(texts.some(({ file, text }) => file.startsWith("assets/") && text.includes(A.name) && holds(text, asksOfA[0]!.text)), "the landing page's bundle holds card A and its messages");
    const leaks = texts.flatMap(({ file, text }) => SECRETS.filter((secret) => holds(text, secret)).map((secret) => `${file} holds "${secret.slice(0, 40)}"`));
    check(files.length > 0 && leaks.length === 0, `none of the ${files.length} files the app serves holds the answer key or the known answers${leaks.length ? `: ${leaks.join("; ")}` : ""}`);
    const demo = files.filter((file) => file.startsWith("demo/"));
    check(demo.join(", ") === "demo/export.json", `the only demo file served is the export: ${demo.join(", ")}`);
    for (const at of ["/demo/answer-key.json", "/demo/known-answers.json", "/demo/sorted.json"]) {
      check((await fetch(new URL(at, app.url))).status === 404, `${at} is never served`);
    }
  });

  await step("5. Sign up from the landing page's links: a weak password is refused, then Home", async () => {
    await page.evaluate(() => scrollTo(0, 0));
    await main.getByRole("link", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/signup$/);
    await page.getByLabel("Name", { exact: true }).fill(ADA.name);
    await page.getByLabel("Email", { exact: true }).fill(ADA.email);
    await page.getByLabel("Password", { exact: true }).fill("too short");
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    const refusal = main.getByRole("alert");
    await refusal.waitFor();
    check(/10 characters/.test(await say(refusal)), `a 9-character password says "${await say(refusal)}"`);
    check(new URL(page.url()).pathname === "/signup", "and the visitor stays on the sign-up page");
    await page.getByLabel("Password", { exact: true }).fill(ADA.password);
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    await main.getByRole("heading", { level: 1, name: "No cards yet.", exact: true }).waitFor();
    check((await say(main.getByRole("heading", { level: 1 }))) === "No cards yet.", `signing up lands on Home: "${await say(main.getByRole("heading", { level: 1 }))}"`);
    const api = app.browser().client;
    const session = await api.auth.logIn({ email: ADA.email, password: ADA.password });
    check(session.account.name === ADA.name, `the SDK logs in as the new account, ${session.account.name}`);
  });

  await step("6. Log in from the landing page, on a fresh browser", async () => {
    await page.context().clearCookies();
    await page.goto(app.url);
    await page.getByRole("banner").getByRole("link", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/login$/);
    await page.getByLabel("Email", { exact: true }).fill(ADA.email);
    await page.getByLabel("Password", { exact: true }).fill(ADA.password);
    await main.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    await main.getByRole("heading", { level: 1, name: "No cards yet.", exact: true }).waitFor();
    check(new URL(page.url()).pathname === "/app/desk" && (await say(main.getByRole("heading", { level: 1 }))) === "No cards yet.", `logging in lands on Home: "${await say(main.getByRole("heading", { level: 1 }))}"`);
    check((await page.getByRole("navigation", { name: "Asked Before" }).textContent())?.includes(ADA.name) ?? false, "the navigation names the account");
    await page.context().clearCookies();
    await page.goto(app.url);
    for (const [where, locator, expected] of [
      ["head", page.getByRole("banner"), ["/docs", "/login"]],
      ["closing question", main, ["/signup"]],
      ["footer", page.getByRole("contentinfo"), ["/docs", "/login", "/signup"]],
    ] as const) {
      const hrefs = await locator.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      check(expected.every((href) => hrefs.includes(href)), `the ${where} leads to ${hrefs.join(" and ")}`);
    }
  });

  await step("7. A fresh visitor: no claims, no API request on load or while typing, only the app's own requests, and Try it as a guest signs in", async () => {
    const visitor = await (await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1, timezoneId: "UTC" })).newPage();
    visitor.setDefaultTimeout(10_000);
    const requests: string[] = [];
    const errors: string[] = [];
    visitor.on("request", (request) => requests.push(request.url()));
    visitor.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    visitor.on("pageerror", (error) => errors.push(error.message));
    await visitor.goto(app.url, { waitUntil: "networkidle" });
    const field = visitor.getByRole("main").getByRole("textbox", { name: "Type something you've asked a chatbot", exact: true });
    await field.fill("port 3000 already in use");
    await visitor.getByRole("main").getByRole("region", { name: "Type something you've asked a chatbot" }).locator("div[data-ui]").waitFor();
    await settled(visitor);
    const words = ((await visitor.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    const claims = words.match(/\b(users?|customers?|testimonials?|trusted|loved|reviews?|rated|thousands|millions|join (?:over|thousands))\b|\d+\s?%|\d+[kKmM]\+|★/gi) ?? [];
    check(claims.length === 0, `no claims about users or numbers${claims.length ? ` (found ${claims.join(", ")})` : ""}`);
    const tells = await visitor.evaluate(() => {
      const found: string[] = [];
      if (/\p{Extended_Pictographic}/u.test(document.body.textContent ?? "")) found.push("an emoji in the copy");
      for (const heading of document.querySelectorAll("main :is(h1, h2, h3)")) {
        const before = heading.previousElementSibling;
        if (before && getComputedStyle(before).textTransform === "uppercase") found.push(`an all-caps eyebrow over "${heading.textContent}"`);
      }
      return found;
    });
    check(tells.length === 0, `no emoji and no eyebrows${tells.length ? ` (found ${tells.join("; ")})` : ""}`);
    const api = requests.filter((url) => new URL(url).pathname.startsWith("/api/"));
    check(api.length === 0, `no API request on load or while typing${api.length ? ` (${api.join(", ")})` : ""}`);
    const outside = requests.filter((url) => new URL(url).origin !== app.url);
    check(outside.length === 0, `every request stays on the app's origin${outside.length ? ` (also ${outside.join(", ")})` : ""}`);
    await visitor.screenshot({ path: join(OUT, `${shot + 1}-visitor.png`) });

    await visitor.getByRole("banner").getByRole("button", { name: "Try it as a guest", exact: true }).click();
    await visitor.waitForURL(/\/app\/desk$/);
    const h1 = visitor.getByRole("main").getByRole("heading", { level: 1, name: /need a cold rep/ });
    await h1.waitFor();
    const nav = (await visitor.getByRole("navigation", { name: "Asked Before" }).textContent()) ?? "";
    check(nav.includes("Shared guest"), `Try it as a guest lands on Home, as the shared guest: "${await say(h1)}"`);
    const offOrigin = requests.filter((url) => new URL(url).origin !== app.url);
    const outsideApi = requests.filter((url) => new URL(url).pathname.startsWith("/api/") && !new URL(url).pathname.startsWith("/api/v1/"));
    check(offOrigin.length === 0 && outsideApi.length === 0, "and every request after it stays on the app's origin and its /api/v1");
    check(errors.length === 0, `no console errors or security-policy breaches${errors.length ? ` (${errors.join("; ")})` : ""}`);
    await visitor.context().close();
  });
} finally {
  await browser.close();
  await app.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
