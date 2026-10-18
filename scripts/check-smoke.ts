// A smoke check of the app on Cloudflare Workers (m1kuorg/basics#61), on a
// fresh copy under `wrangler dev`: every page, an asset, and the demo export
// answer with the security headers; the answer key and the known answers
// are never served; an endpoint that isn't there answers 404 as JSON; and a
// learner signs up and makes a shelf through the SDK. It prints each step's
// checks and exits 1 if any fails, naming the step.
// Run: bun run check:smoke

import { startApp } from "./lib/app";

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
    check(false, `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
  }
}

/** Each security header, and what its value must hold. */
const HEADERS: [string, RegExp][] = [
  // Only the app's own origin, workers too: the zip reader inflates in the page, so no blob: worker runs.
  ["content-security-policy", /^default-src 'self'; worker-src 'self'; (?!.*blob:).*frame-ancestors 'none'/],
  ["x-content-type-options", /^nosniff$/],
  ["x-frame-options", /^DENY$/],
  ["referrer-policy", /^same-origin$/],
  ["cross-origin-opener-policy", /^same-origin$/],
  ["strict-transport-security", /^max-age=\d+/],
];

/** Every content security policy seen, from the static assets and from the Worker alike. */
const policies = new Set<string>();

/** The security headers a response lacks, or carries with the wrong value. */
const wrongHeaders = (response: Response) => {
  policies.add(response.headers.get("content-security-policy") ?? "");
  return HEADERS.filter(([name, value]) => !value.test(response.headers.get(name) ?? "")).map(([name]) => name);
};

const say = (wrong: string[]) => (wrong.length ? `missing or wrong: ${wrong.join(", ")}` : "every security header");

await step("1. Every page answers with the security headers", async () => {
  const pages: [string, string, number, RegExp][] = [
    ["the landing page", "/", 200, /<title>Asked Before<\/title>/],
    ["the docs", "/docs", 200, /<title>[^<]*Asked Before<\/title>/],
    ["log in", "/login", 200, /<title>[^<]*Asked Before<\/title>/],
    ["sign up", "/signup", 200, /<title>[^<]*Asked Before<\/title>/],
    ["the app", "/app", 200, /<div id="app"><\/div>/],
    ["the Desk, routed on the client", "/app/desk", 200, /<div id="app"><\/div>/],
    ["a shelf, routed on the client", "/app/shelves/some-shelf", 200, /<div id="app"><\/div>/],
    ["a card, routed on the client", "/app/cards/some-card", 200, /<div id="app"><\/div>/],
    ["a page that isn't there", "/no-such-page", 404, /This page doesn't exist/],
  ];
  for (const [what, path, status, body] of pages) {
    const response = await fetch(new URL(path, app.url));
    const text = await response.text();
    const wrong = wrongHeaders(response);
    check(response.status === status && body.test(text) && wrong.length === 0, `${what} (${path}): ${response.status}, ${body.test(text) ? "its page" : "not its page"}, ${say(wrong)}`);
  }

  const landing = await (await fetch(app.url)).text();
  const assets = [...landing.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]!);
  check(assets.length > 0, `the landing page links ${assets.length} assets under /assets/`);
  for (const path of assets.slice(0, 2)) {
    const response = await fetch(new URL(path, app.url));
    await response.arrayBuffer();
    const wrong = wrongHeaders(response);
    const cache = response.headers.get("cache-control") ?? "";
    check(response.status === 200 && /immutable/.test(cache) && wrong.length === 0, `an asset (${path}): ${response.status}, cached "${cache}", ${say(wrong)}`);
  }

  const demo = await fetch(new URL("/demo/export.json", app.url));
  const conversations = (await demo.json().catch(() => null)) as unknown[] | null;
  check(demo.status === 200 && Array.isArray(conversations) && conversations.length > 0 && wrongHeaders(demo).length === 0, `the demo export: ${demo.status}, ${conversations?.length ?? 0} conversations, ${say(wrongHeaders(demo))}`);
});

await step("2. The answer key and the known answers are never served", async () => {
  for (const path of ["/demo/answer-key.json", "/demo/known-answers.json", "/answer-key.json", "/assets/answer-key.json"]) {
    const response = await fetch(new URL(path, app.url));
    const text = await response.text();
    check(response.status === 404 && !text.includes("messageIds") && wrongHeaders(response).length === 0, `${path}: ${response.status}, ${text.includes("messageIds") ? "the key itself" : "not the key"}, ${say(wrongHeaders(response))}`);
  }
});

await step("3. An endpoint that isn't there answers 404 as JSON", async () => {
  for (const [what, method, path] of [
    ["a missing endpoint", "GET", "/api/v1/nope"],
    ["outside the version", "GET", "/api/nope"],
    ["a method an endpoint doesn't have", "PUT", "/api/v1/health"],
  ] as const) {
    const response = await fetch(new URL(path, app.url), { method });
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const type = response.headers.get("content-type") ?? "";
    check(
      response.status === 404 && /^application\/json/.test(type) && typeof body?.error === "string" && response.headers.get("cache-control") === "no-store" && wrongHeaders(response).length === 0,
      `${what} (${method} ${path}): ${response.status} ${type}, ${JSON.stringify(body)}, ${say(wrongHeaders(response))}`,
    );
  }
  const health = await fetch(new URL("/api/v1/health", app.url));
  check(health.status === 200 && JSON.stringify(await health.json()) === '{"ok":true}' && wrongHeaders(health).length === 0, `the health check: ${health.status}, ${say(wrongHeaders(health))}`);
});

await step("4. The pages and the API send the one content security policy", async () => {
  check(policies.size === 1, `${policies.size} policies: ${[...policies].join(" | ")}`);
});

await step("5. Sign up and make a shelf", async () => {
  const ada = app.browser();
  const session = await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  check(session.account.email === "ada@example.com" && session.next === "/app/desk", `signed up as ${session.account.email}, going to ${session.next}`);
  check(/^session=/.test(ada.cookie()), "the session cookie is set");
  const me = await ada.client.auth.me();
  check(me.id === session.account.id, "the session is the new account's");
  const shelf = await ada.client.shelves.create({ name: "Work" });
  check(shelf.name === "Work" && shelf.counts.cards === 0, `made the shelf "${shelf.name}", ${shelf.counts.cards} cards`);
  const shelves = await ada.client.shelves.list();
  check(shelves.length === 1 && shelves[0]!.id === shelf.id, `the list holds it: ${shelves.map((s) => s.name).join(", ")}`);
});

await app.stop();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nThe app answers on Workers.");
