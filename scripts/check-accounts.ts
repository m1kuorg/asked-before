// Checks accounts and projects (m1kuorg/basics#41) end to end, through the
// SDK, on a fresh copy of the app: the health check and the security
// headers, sign-up, log-in and its `next`, log-out, projects and their
// counts, another account's 404, deletes, the Origin and JSON rule, the
// logs, and, last, the per-IP throttle. The counts come from cards made and
// returned through the API, with the app's model a stand-in in this script,
// never in the app: it sorts as the answer key does, writes a stand-in's
// problem, and passes the answer "right" and fails any other. It prints
// each step's checks and exits 1 if any fails, naming the step.
// Run: bun run check:accounts

import { ApiError, type Card, type Shelf } from "@asked-before/sdk";
import { Database } from "bun:sqlite";
import { allUnsorted, key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { startModelStub } from "./lib/model-stub";
import { checkRequest, kindOf, repReply, sortsByKey, verdictReply } from "./lib/reps";

/** Words of phrasings the demo export doesn't hold, mapped to the key's skill each asks, for the stand-in's sort. */
const newer = new Map<string, string>();
const model = await startModelStub(
  sortsByKey(
    (request, raw, body) =>
      (kindOf(request) === "rep" ? repReply("A problem.") : verdictReply(checkRequest(request).answer === "right" ? "pass" : "fail", "A reason."))(request, raw, body),
    newer,
  ),
);
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
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

const SECURITY_HEADERS = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"];
const missingHeaders = (response: Response) => SECURITY_HEADERS.filter((name) => !response.headers.has(name));

const ADA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" };
const BEA = { name: "Bea Example", email: "bea@example.com", password: "difference engine" };
const ada = app.browser();
const bea = app.browser();

await step("1. The health check answers, and every kind of answer carries the security headers", async () => {
  const health = await ada.client.health.check();
  check(health.ok === true, `the health check says ${JSON.stringify(health)}`);

  const page = await fetch(app.url);
  const assetPath = (await page.text()).match(/src="(\/assets\/[^"]+)"/)?.[1];
  const answers: [string, string, number][] = [
    ["the health check", "/api/v1/health", 200],
    ["the page", "/", 200],
    ["a page asset", assetPath ?? "/assets/missing", 200],
    ["a missing page", "/no-such-page", 404],
    ["a missing endpoint", "/api/v1/no-such-endpoint", 404],
    ["a method an endpoint doesn't have", "/api/v1/health?method=PUT", 404],
    ["an endpoint that needs a session", "/api/v1/projects", 401],
  ];
  for (const [what, path, status] of answers) {
    const url = new URL(path, app.url);
    const response = await fetch(url, { method: url.searchParams.get("method") ?? "GET" });
    const missing = missingHeaders(response);
    check(response.status === status && missing.length === 0, `${what} (${path}): ${response.status}, ${missing.length ? `missing ${missing.join(", ")}` : "all security headers"}`);
    if (path.startsWith("/api/")) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      check(response.headers.get("cache-control") === "no-store" && (status === 200 || typeof body?.error === "string"), `${what} isn't cached, and a failure says { error }`);
    }
  }
  const csp = page.headers.get("content-security-policy") ?? "";
  check(/default-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp), `the content security policy allows only the app's own origin: ${csp}`);
});

await step("2. Sign up, with the email trimmed and lowercased", async () => {
  const session = await ada.client.auth.signUp({ ...ADA, email: "  Ada@Example.COM " });
  check(session.account.email === ADA.email, `the account's email is ${session.account.email}`);
  check(session.account.name === ADA.name, `the account's name is ${session.account.name}`);
  check(session.next === "/app", `with no next, sign-up goes to ${session.next}`);
  const me = await ada.client.auth.me();
  check(me.id === session.account.id && !Number.isNaN(Date.parse(me.createdAt)), `the current account is the new one, made ${me.createdAt}`);
});

await step("3. Sign-up rejects a weak password, a bad email, and an email in use", async () => {
  const weak = await failure(bea.client.auth.signUp({ ...BEA, password: "too short" }));
  check(weak?.status === 400 && /10/.test(weak.message), `a 9-character password: ${say(weak)}`);
  const long = await failure(bea.client.auth.signUp({ ...BEA, password: "x".repeat(201) }));
  check(long?.status === 400 && /200/.test(long.message), `a 201-character password: ${say(long)}`);
  const badEmail = await failure(bea.client.auth.signUp({ ...BEA, email: "not an email" }));
  check(badEmail?.status === 400, `a bad email: ${say(badEmail)}`);
  const taken = await failure(bea.client.auth.signUp({ ...BEA, email: "ADA@example.com" }));
  check(taken?.status === 409, `an email in use, in other letter case: ${say(taken)}`);
  const me = await failure(bea.client.auth.me());
  check(me?.status === 401, `none of them logged in: ${say(me)}`);
});

await step("4. Log out", async () => {
  await ada.client.auth.logOut();
  const me = await failure(ada.client.auth.me());
  check(me?.status === 401, `the current account after logging out: ${say(me)}`);
  const list = await failure(ada.client.shelves.list());
  check(list?.status === 401, `projects after logging out: ${say(list)}`);
  check(ada.cookie() === "", `the session cookie is cleared: "${ada.cookie()}"`);
});

await step("5. A wrong log-in says neither which field was wrong nor whether the account exists", async () => {
  const wrongPassword = await failure(ada.client.auth.logIn({ email: ADA.email, password: "the wrong password" }));
  const noAccount = await failure(ada.client.auth.logIn({ email: "nobody@example.com", password: ADA.password }));
  check(wrongPassword?.status === 401, `a wrong password: ${say(wrongPassword)}`);
  check(noAccount?.status === 401, `an email with no account: ${say(noAccount)}`);
  check(wrongPassword?.message === noAccount?.message, "both get the same message");
  check(!/exist|found|unknown|no account|registered|password is|email is/i.test(wrongPassword?.message ?? ""), "the message names no field and no account");
  const me = await failure(ada.client.auth.me());
  check(me?.status === 401, `neither logged in: ${say(me)}`);
});

await step("6. Log in, following `next` only when it's a path inside the app", async () => {
  const inside = "/app/projects/p1?tab=uploads#latest";
  const session = await ada.client.auth.logIn({ email: ` ${ADA.email.toUpperCase()} `, password: ADA.password, next: inside });
  check(session.next === inside, `next ${inside} is followed: ${session.next}`);
  const offSite = ["https://evil.example/app", "//evil.example/app", "/\\evil.example/app", "/app/../../evil", "/apple", "javascript:alert(1)"];
  for (const next of offSite) {
    const { next: went } = await ada.client.auth.logIn({ email: ADA.email, password: ADA.password, next });
    check(went === "/app", `next ${next} is ignored: ${went}`);
  }
  const me = await ada.client.auth.me();
  check(me.email === ADA.email, `logged in as ${me.email}`);

  const before = ada.cookie();
  await ada.client.auth.logIn({ email: ADA.email, password: ADA.password });
  const earlier = await fetch(new URL("/api/v1/auth/me", app.url), { headers: { cookie: before } });
  check(earlier.status === 401 && ada.cookie() !== before, `logging in again ends the earlier session: ${earlier.status}`);

  for (const [what, call] of [
    ["sign-up", "/api/v1/auth/signup"],
    ["log-in", "/api/v1/auth/login"],
  ] as const) {
    const forged = await fetch(new URL(call, app.url), {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify(what === "log-in" ? { email: BEA.email, password: BEA.password } : BEA),
    });
    check(forged.status === 403, `${what} from another site's Origin: ${forged.status}`);
  }
});

let work: Shelf | undefined;
let bootcamp: Shelf | undefined;

await step("7. Create, rename, list, and get projects, with every count zero", async () => {
  work = await ada.client.shelves.create({ name: "  Work  " });
  bootcamp = await ada.client.shelves.create({ name: "Bootcamp", demo: true });
  const zero = { cards: 0, borrowed: 0, returned: 0, borrowedAgain: 0 };
  check(work.name === "Work" && work.demo === false, `made "${work.name}", demo ${work.demo}`);
  check(bootcamp.demo === true, `made "${bootcamp.name}" as a demo project`);
  check(JSON.stringify(work.counts) === JSON.stringify(zero) && work.lastUploadAt === null, `its counts are ${JSON.stringify(work.counts)}, last upload ${work.lastUploadAt}`);

  const renamed = await ada.client.shelves.rename(work.id, "Day job");
  check(renamed.id === work.id && renamed.name === "Day job", `renamed to "${renamed.name}"`);
  const got = await ada.client.shelves.get(work.id);
  check(got.name === "Day job", `getting it shows "${got.name}"`);
  const list = await ada.client.shelves.list();
  check(
    JSON.stringify(list.map((p) => p.name)) === JSON.stringify(["Day job", "Bootcamp"]),
    `the list, oldest first: ${list.map((p) => p.name).join(", ")}`,
  );

  const empty = await failure(ada.client.shelves.create({ name: "   " }));
  check(empty?.status === 400, `a blank name: ${say(empty)}`);
  const blank = await failure(ada.client.shelves.rename(work.id, ""));
  check(blank?.status === 400, `renaming to a blank name: ${say(blank)}`);
});

await step("8. A second account gets 404 on the first's project", async () => {
  await bea.client.auth.signUp(BEA);
  const id = work!.id;
  // Each call starts only when it's awaited: one left waiting while another is checked would reject unhandled, which exits 1.
  for (const [what, call] of [
    ["get", () => bea.client.shelves.get(id)],
    ["rename", () => bea.client.shelves.rename(id, "Mine now")],
    ["delete", () => bea.client.shelves.delete(id)],
  ] as const) {
    const error = await failure(call());
    check(error?.status === 404, `${what}: ${say(error)}`);
  }
  check((await bea.client.shelves.list()).length === 0, "the second account lists none of them");
  check((await ada.client.shelves.get(id)).name === "Day job", "the first account's project is untouched");
});

await step("9. A project's counts come from its cards' status", async () => {
  const projectId = bootcamp!.id;
  const sorted = await sortEnds(ada.client, (await upload(ada.client, projectId, phrasings, "demo-export.json")).id);
  const [a, b, c, d, e] = (await ada.client.cards.list(projectId)) as Card[];
  check(sorted.status === "sorted" && e !== undefined, `the demo export is sorted into ${(await ada.client.cards.list(projectId)).length} cards`);
  /** A cold rep on the card, answered "right" to pass or anything else to fail. */
  const rep = async (card: Card, answer: string) => (await ada.client.reps.check((await ada.client.reps.start(card.id)).rep.id, { answer })).rep;
  await rep(a!, "wrong");
  await rep(b!, "wrong");
  await rep(b!, "right");
  const cPassed = await rep(c!, "right");
  const dPassed = await rep(d!, "right");
  // A borrow on C a millisecond after its pass, and one on D at the very millisecond of its pass.
  const after = [
    { sourceId: "after-c", text: "a newer question on card C", time: new Date(Date.parse(cPassed.checkedAt!) + 1).toISOString(), skill: c!.skill },
    { sourceId: "on-the-dot-d", text: "a newer question on card D", time: dPassed.checkedAt!, skill: d!.skill },
  ];
  for (const { text, skill } of after) newer.set(text, skill);
  const latest = await upload(ada.client, projectId, after.map(({ skill, ...phrasing }) => phrasing), "newer.json");
  await sortEnds(ada.client, latest.id);

  const got = await ada.client.shelves.get(projectId);
  const want = { cards: key.skills.length, borrowed: 2, returned: 2, borrowedAgain: 1 };
  check(JSON.stringify(got.counts) === JSON.stringify(want), `counts ${JSON.stringify(got.counts)}, want ${JSON.stringify(want)}`);
  const statuses = (await ada.client.cards.list(projectId)).map((card) => `${card.skill}: ${card.status}`);
  console.log(`     ${statuses.join("; ")}`);
  check(got.lastUploadAt === latest.createdAt, `last upload ${got.lastUploadAt}`);
  const listed = (await ada.client.shelves.list()).find((p) => p.id === projectId);
  check(JSON.stringify(listed?.counts) === JSON.stringify(want), "the list shows the same counts");
});

await step("10. Deleting a project deletes it and everything in it", async () => {
  // The project holds uploads, phrasings, cards, and reps (step 9).
  const projectId = bootcamp!.id;
  const cards = await Promise.all((await ada.client.cards.list(projectId)).map((card) => ada.client.cards.get(card.id)));
  const held: Record<"uploads" | "cards" | "phrasings" | "reps", string[]> = {
    uploads: (await ada.client.uploads.list(projectId)).uploads.map((u) => u.id),
    cards: cards.map((card) => card.id),
    phrasings: [...cards.flatMap((card) => card.borrows.map((p) => p.id)), ...(await allUnsorted(ada.client, projectId)).map((p) => p.id)],
    reps: cards.flatMap((card) => card.reps.map((r) => r.id)),
  };
  await ada.client.shelves.delete(projectId);
  const got = await failure(ada.client.shelves.get(projectId));
  check(got?.status === 404, `getting it afterwards: ${say(got)}`);
  const again = await failure(ada.client.shelves.delete(projectId));
  check(again?.status === 404, `deleting it again: ${say(again)}`);
  const list = await ada.client.shelves.list();
  check(list.length === 1 && list[0]!.id === work!.id, `the other project stays: ${list.map((p) => p.name).join(", ")}`);

  // No endpoint reaches a deleted project's uploads, phrasings, cards, and
  // reps, so only the database can show they went with it. Without
  // cascades, or with foreign keys off, they stay.
  const store = new Database(app.databasePath, { readonly: true, strict: true });
  const left = Object.entries(held).map(([table, ids]) => {
    const { n } = store.query(`SELECT count(*) AS n FROM ${table} WHERE id IN (SELECT value FROM json_each($ids))`).get({ ids: JSON.stringify(ids) }) as { n: number };
    return [table, n, ids.length] as const;
  });
  store.close();
  check(left.every(([, n, of]) => of > 0 && n === 0), `rows left of those it held: ${left.map(([table, n, of]) => `${table} ${n} of ${of}`).join(", ")}`);
});

await step("11. A cookie request that changes something needs the page's Origin and JSON", async () => {
  const cookie = ada.cookie();
  const post = (headers: Record<string, string>, body = JSON.stringify({ name: "Sneaky" })) =>
    fetch(new URL("/api/v1/projects", app.url), { method: "POST", headers: { cookie, ...headers }, body });
  const cases: [string, Record<string, string>, string | undefined, number][] = [
    ["no Origin", { "content-type": "application/json" }, undefined, 403],
    ["another site's Origin", { "content-type": "application/json", origin: "https://evil.example" }, undefined, 403],
    ["a form's content type", { "content-type": "application/x-www-form-urlencoded", origin: app.url }, "name=Sneaky", 403],
    ["plain text", { "content-type": "text/plain", origin: app.url }, undefined, 403],
  ];
  for (const [what, headers, body, status] of cases) {
    const response = await post(headers, body);
    const error = ((await response.json()) as { error?: string }).error;
    check(response.status === status, `a project made with ${what}: ${response.status} "${error}"`);
  }
  const del = await fetch(new URL(`/api/v1/projects/${work!.id}`, app.url), { method: "DELETE", headers: { cookie } });
  check(del.status === 403, `a delete with no Origin: ${del.status}`);
  const read = await fetch(new URL("/api/v1/projects", app.url), { headers: { cookie } });
  const { projects } = (await read.json()) as { projects: Shelf[] };
  check(read.status === 200, `a read with no Origin is fine: ${read.status}`);
  check(projects.length === 1 && projects[0]!.id === work!.id, `nothing was made or deleted: ${projects.map((p) => p.name).join(", ")}`);
  const made = await post({ "content-type": "application/json", origin: app.url });
  check(made.status === 201, `with the page's Origin and JSON, it's made: ${made.status}`);

  for (const scheme of ["Bearer", "bearer"]) {
    const bearer = await fetch(new URL("/api/v1/projects", app.url), { headers: { cookie, authorization: `${scheme} ab_nope_nope` } });
    check(bearer.status === 401, `with a "${scheme}" key, the cookie is ignored: ${bearer.status}`);
  }
});

await step("12. The app logs only the method, path, status, and duration", async () => {
  const lines = app.log().trim().split("\n").slice(1);
  const odd = lines.filter((line) => !/^(GET|HEAD|POST|PUT|PATCH|DELETE) \/\S* \d{3} \d+ms$/.test(line));
  check(lines.length > 50 && odd.length === 0, `${lines.length} request lines${odd.length ? `, and these others: ${odd.slice(0, 3).join(" | ")}` : ""}`);
  const secrets = [ADA.email, ADA.name, ADA.password, BEA.email, BEA.password, "Day job", "Sneaky"];
  const leaked = secrets.filter((text) => app.log().toLowerCase().includes(text.toLowerCase()));
  check(leaked.length === 0, `no email, name, password, or project name in the logs${leaked.length ? `: ${leaked.join(", ")}` : ""}`);
});

await step("13. Signing up and logging in are throttled per IP address", async () => {
  // Last, since it locks this address out for the rest of the run.
  let tries = 0;
  let throttled: ApiError | null = null;
  while (tries < 30 && throttled?.status !== 429) {
    tries++;
    throttled = await failure(bea.client.auth.logIn({ email: BEA.email, password: "the wrong password" }));
  }
  check(throttled?.status === 429, `after ${tries} more tries: ${say(throttled)}`);
  const right = await failure(bea.client.auth.logIn({ email: BEA.email, password: BEA.password }));
  check(right?.status === 429, `then even the right password: ${say(right)}`);
  const signUp = await failure(app.browser().client.auth.signUp({ name: "Cy", email: "cy@example.com", password: "a long enough password" }));
  check(signUp?.status === 429, `and signing up: ${say(signUp)}`);
});

await app.stop();
model.stop();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nAccounts and projects hold up.");
