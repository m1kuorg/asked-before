// Checks that the password never reaches the server (m1kuorg/basics#68, ADR
// 0006), on a fresh copy of the app. In a real browser at 1920×1080, every
// request the page sends is read: signing up (a weak password refused
// before anything is sent), logging out and in, a wrong log-in, changing
// the password and the email in settings, and deleting the account each
// send the key the SDK derives from the password and the email, the same
// key Bun's SDK derives, and never the password. Then the API itself: a
// password, or anything that isn't a key, is a 400; the database keeps
// only a salted SHA-256 of the key, different for two accounts with the
// same password; checking an account's key is throttled; and Wrangler's
// output holds no password and no key. It
// prints each step's checks and exits 1 if any fails, naming the step.
// Run: bun run check:passwords

import { ApiError, passwordKey } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { chromium, type Locator, type Page } from "playwright";
import { startApp } from "./lib/app";

const FRAME = { width: 1920, height: 1080 };
const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const NEW_PASSWORD = "a new and longer password";
const NEW_EMAIL = "ada@engine.example";
/** Every password any step types, none of which may reach the server. */
const PASSWORDS = [ADA.password, NEW_PASSWORD, "too short", "the wrong password"];

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
    check(false, `threw ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

const app = await startApp();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(10_000);

/** Every request the page sent to the API, with its body. */
const sent: { call: string; body: string }[] = [];
page.on("request", (request) => {
  const { origin, pathname } = new URL(request.url());
  if (origin === app.url && pathname.startsWith("/api/")) sent.push({ call: `${request.method()} ${pathname}`, body: request.postData() ?? "" });
});

/** The body of the last request the page sent as `call`, such as "POST /api/v1/auth/login", read as JSON. */
const lastBody = (call: string): Record<string, unknown> | null => {
  const body = sent.findLast((request) => request.call === call)?.body;
  return body ? (JSON.parse(body) as Record<string, unknown>) : null;
};
const leaks = (body: string) => PASSWORDS.filter((password) => body.toLowerCase().includes(password.toLowerCase()));

/** Checks a body against the keys it should carry, each as `passwordKey()` derives it in Bun, and says it holds no password. */
async function sends(call: string, want: Record<string, [password: string, email: string]>) {
  const body = lastBody(call);
  const keys = Object.keys(body ?? {}).filter((name) => /[Pp]assword/.test(name));
  check(JSON.stringify(keys.sort()) === JSON.stringify(Object.keys(want).sort()), `${call} sends ${keys.join(" and ") || "no key"}, no password field`);
  for (const [name, [password, email]] of Object.entries(want)) {
    const key = await passwordKey(password, email);
    check(body?.[name] === key, `its ${name} is the key Bun's SDK derives from the password and ${email}: ${String(body?.[name]).slice(0, 12)}…`);
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

/** A settings section, the region its heading names. */
const section = (p: Page, name: string) => p.getByRole("main").getByRole("region", { name, exact: true });
/** A form's refusal: the role="alert" line inside `scope`. */
const refusalIn = (scope: Locator) => scope.getByRole("alert");
/** A section's status line once it says something (it's always in the page, empty until then). */
const said = (scope: Locator) => scope.getByRole("status").filter({ hasText: /\S/ });
/** Waits for the section's status line or its refusal, so a refusal fails at once instead of timing out. */
async function saved(scope: Locator, what: string) {
  await said(scope).or(refusalIn(scope)).first().waitFor();
  const refused = await refusalIn(scope).count();
  check(refused === 0, `${what} says "${refused ? await refusalIn(scope).first().textContent() : await said(scope).textContent()}"`);
}

try {
  await step("1. Signing up in the page sends the key, never the password; a weak one is refused before anything is sent", async () => {
    await page.goto(`${app.url}/signup`);
    const main = page.getByRole("main");
    await main.getByLabel("Name", { exact: true }).fill(ADA.name);
    await main.getByLabel("Email", { exact: true }).fill("  Ada@Example.COM ");
    await main.getByLabel("Password", { exact: true }).fill("too short");
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    const refusal = refusalIn(main);
    await refusal.waitFor();
    check(/10 characters/.test((await refusal.textContent()) ?? ""), `a 9-character password says "${await refusal.textContent()}"`);
    check(!sent.some((request) => request.call === "POST /api/v1/auth/signup"), "and nothing was sent: the SDK holds the rule");

    await main.getByLabel("Password", { exact: true }).fill(ADA.password);
    await main.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    await sends("POST /api/v1/auth/signup", { passwordKey: [ADA.password, ADA.email] });
  });

  await step("2. Logging in sends the key, and a wrong password a wrong key", async () => {
    await page.getByRole("navigation", { name: "Asked Before" }).getByRole("button", { name: "Log out", exact: true }).click();
    await page.waitForURL(/\/login$/);
    const main = page.getByRole("main");
    await main.getByLabel("Email", { exact: true }).fill(ADA.email);
    await main.getByLabel("Password", { exact: true }).fill("the wrong password");
    await main.getByRole("button", { name: "Log in", exact: true }).click();
    const refusal = refusalIn(main);
    await refusal.waitFor();
    check((await refusal.textContent()) === "Wrong email or password.", `a wrong password says "${await refusal.textContent()}"`);
    await sends("POST /api/v1/auth/login", { passwordKey: ["the wrong password", ADA.email] });

    await main.getByLabel("Password", { exact: true }).fill(ADA.password);
    await main.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/app\/desk$/);
    await sends("POST /api/v1/auth/login", { passwordKey: [ADA.password, ADA.email] });
  });

  await step("3. Settings sends keys to change the password and the email, and to delete the account", async () => {
    await page.goto(`${app.url}/app/settings`);
    const password = section(page, "Password");
    await password.getByLabel("Current password", { exact: true }).fill(ADA.password);
    await password.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await password.getByRole("button", { name: "Change password", exact: true }).click();
    await saved(password, "the password change");
    await sends("POST /api/v1/account/password", { currentPasswordKey: [ADA.password, ADA.email], newPasswordKey: [NEW_PASSWORD, ADA.email] });

    const profile = section(page, "Profile");
    await profile.getByLabel("Email", { exact: true }).fill(NEW_EMAIL);
    await profile.getByLabel("Your password", { exact: true }).fill(NEW_PASSWORD);
    await profile.getByRole("button", { name: "Save profile", exact: true }).click();
    await saved(profile, "the profile");
    check(sent.filter((request) => request.call === "PATCH /api/v1/account").length === 1, "the name and the new email go in one call");
    await sends("PATCH /api/v1/account", { currentPasswordKey: [NEW_PASSWORD, ADA.email], newPasswordKey: [NEW_PASSWORD, NEW_EMAIL] });
    const relogged = await app.browser().client.auth.logIn({ email: NEW_EMAIL, password: NEW_PASSWORD });
    check(relogged.account.email === NEW_EMAIL, "the password logs in with the new email");

    const del = section(page, "Delete your account");
    await del.getByLabel("Your password", { exact: true }).fill(NEW_PASSWORD);
    await del.getByRole("button", { name: "Delete your account", exact: true }).click();
    const confirmation = del.getByRole("group", { name: "Delete your account and everything in it?", exact: true });
    await confirmation.waitFor();
    check(!sent.some((request) => request.call === "DELETE /api/v1/account"), "nothing is deleted before the confirmation");
    await confirmation.getByRole("button", { name: "Delete everything", exact: true }).click();
    await page.waitForURL(`${app.url}/`);
    await sends("DELETE /api/v1/account", { passwordKey: [NEW_PASSWORD, NEW_EMAIL] });
  });

  await step("4. No request the page sent holds a password", async () => {
    const leaked = sent.filter((request) => leaks(request.body).length);
    check(sent.length > 10 && leaked.length === 0, `${sent.length} requests, ${leaked.length} with a password${leaked.length ? `: ${leaked.map((r) => r.call).join(", ")}` : ""}`);
  });

  await step("5. The API takes only a key, and the database keeps only its salted hash", async () => {
    const post = (path: string, body: unknown) =>
      fetch(`${app.url}/api/v1${path}`, { method: "POST", headers: { "content-type": "application/json", origin: app.url }, body: JSON.stringify(body) });
    const key = await passwordKey(ADA.password, "bea@example.com");
    for (const [what, path, body] of [
      ["signing up with a password", "/auth/signup", { name: "Bea", email: "bea@example.com", password: ADA.password }],
      ["signing up with a key in capitals", "/auth/signup", { name: "Bea", email: "bea@example.com", passwordKey: key.toUpperCase() }],
      ["signing up with a short key", "/auth/signup", { name: "Bea", email: "bea@example.com", passwordKey: key.slice(1) }],
      ["signing up with a password as the key", "/auth/signup", { name: "Bea", email: "bea@example.com", passwordKey: ADA.password }],
      ["logging in with a password", "/auth/login", { email: ADA.email, password: ADA.password }],
    ] as const) {
      const response = await post(path, body);
      const { error } = (await response.json()) as { error?: string };
      check(response.status === 400, `${what}: ${response.status} "${error}"`);
    }

    const bea = app.browser().client;
    const cy = app.browser().client;
    await bea.auth.signUp({ name: "Bea", email: "bea@example.com", password: ADA.password });
    await cy.auth.signUp({ name: "Cy", email: "cy@example.com", password: ADA.password });
    const store = new Database(app.databasePath, { readonly: true, strict: true });
    // Every account but the shared Guest account, which has no password (check:guest).
    const hashes = store.query("SELECT email, password_hash AS hash FROM users WHERE id <> 'guest' ORDER BY email").all() as { email: string; hash: string }[];
    store.close();
    const stored = /^sha256\$([0-9a-f]{32})\$([0-9a-f]{64})$/;
    for (const { email, hash } of hashes) {
      const [, salt, digest] = hash.match(stored) ?? [];
      const key = await passwordKey(ADA.password, email);
      const salted = salt ? createHash("sha256").update(Buffer.from(salt, "hex")).update(Buffer.from(key, "hex")).digest("hex") : "";
      check(digest === salted && !hash.includes(key), `${email}'s hash is the SHA-256 of a salt of its own and its key, and holds neither the key nor the password`);
    }
    check(hashes.length === 2 && hashes[0]!.hash !== hashes[1]!.hash, "the same password on two accounts is stored two ways");
  });

  await step("6. Checking an account's password is throttled: 20 tries in 15 minutes", async () => {
    const dee = app.browser().client;
    await dee.auth.signUp({ name: "Dee", email: "dee@example.com", password: ADA.password });
    let tries = 0;
    let refused: ApiError | null = null;
    while (tries < 25 && refused?.status !== 429) {
      tries++;
      refused = await failure(dee.account.delete({ password: "the wrong password" }));
    }
    check(tries === 21 && refused?.status === 429, `after ${tries - 1} wrong passwords, the next try: ${say(refused)}`);
    const right = await failure(dee.account.delete({ password: ADA.password }));
    check(right?.status === 429 && (await dee.auth.me()).email === "dee@example.com", `then even the right one, and the account is still there: ${say(right)}`);
  });

  await step("7. Wrangler's output holds no password and no key", async () => {
    const keys = await Promise.all([passwordKey(ADA.password, ADA.email), passwordKey(NEW_PASSWORD, NEW_EMAIL)]);
    const log = app.log().toLowerCase();
    const found = [...PASSWORDS, ...keys].filter((secret) => log.includes(secret.toLowerCase()));
    check(found.length === 0, `none of ${PASSWORDS.length} passwords and ${keys.length} keys is in it`);
  });
} finally {
  await browser.close();
  await app.stop();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nThe password never leaves the page.");
