// Proves the rep and check routes on the demo skill, "Undo a git commit",
// against the running app, which this script starts with `bun server.ts` and
// stops again. It asks for a lesson and five problems in turn, checks the
// known wrong and right answers against each problem, sends bad bodies, forces
// a cut-off and a refusal, and reads the app's logs for message text. It
// prints the lesson, problems, and reasons, which are made-up demo data, so
// they can be read; the app itself must log none of them (part 5).
// Run: PORT=3101 bun run scripts/check-rep-routes.ts (PORT defaults to a free port)

import { join } from "node:path";
import { CHECK_EFFORT } from "../server/routes/check";
import { REP_EFFORT } from "../server/routes/rep";
import { parseExport } from "../src/parser";
import type { CheckRequest, CheckResponse, RepRequest, RepResponse } from "../src/types";

const ROOT = join(import.meta.dir, "..");
const read = (path: string) => Bun.file(join(ROOT, path)).text();
const messages = parseExport(await read("demo/export.json"));
const key: { skills: { name: string; messageIds: string[] }[] } = JSON.parse(await read("demo/answer-key.json"));
const known: { skill: string; wrong: string; right: string } = JSON.parse(await read("demo/known-answers.json"));
const skill = known.skill;
const phrasings = key.skills.find((s) => s.name === skill)!.messageIds.map((id) => messages.find((m) => m.id === id)!.text);

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
};

/** Lowercase words, so a quote is found through changes in case and punctuation. */
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Every run of `n` words in the text. */
const grams = (text: string, n: number) => {
  const w = words(text);
  return new Set(Array.from({ length: Math.max(0, w.length - n + 1) }, (_, i) => w.slice(i, i + n).join(" ")));
};
/** True when `text` shares a run of five words with `source`, or holds all of a shorter one. */
const quotes = (text: string, source: string) => {
  const inText = ` ${words(text).join(" ")} `;
  if (words(source).length < 5) return inText.includes(` ${words(source).join(" ")} `);
  return [...grams(source, 5)].some((gram) => inText.includes(` ${gram} `));
};
/** The share of word triples two texts have in common, from 0 to 1. */
const similarity = (a: string, b: string) => {
  const [x, y] = [grams(a, 3), grams(b, 3)];
  const shared = [...x].filter((g) => y.has(g)).length;
  return shared / (x.size + y.size - shared || 1);
};
/** Problems more alike than this count as a repeat. */
const MAX_SIMILARITY = 0.5;
/** What solves this skill, named or described. A problem that says it gives its answer away. */
const GIVEAWAY = /\b(reset|revert|revers)\w*|--(soft|hard|mixed|amend)\b|cherry-pick|\bHEAD[~^]|\bnew commit\b|\bcancel(s|ed|ing)? out\b|\bbacked out\b/i;

type App = { url: string; log: () => string; stop: () => void };
async function startApp(env: Record<string, string>): Promise<App> {
  const proc = Bun.spawn(["bun", "server.ts"], { cwd: ROOT, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  let log = "";
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) log += decoder.decode(chunk, { stream: true });
  };
  void collect(proc.stdout);
  void collect(proc.stderr);
  const deadline = Date.now() + 10_000;
  let match;
  while (!(match = log.match(/Asked Before is on (\S+)/))) {
    if (proc.exitCode !== null || Date.now() > deadline) throw new Error(`The app didn't start:\n${log}`);
    await Bun.sleep(50);
  }
  return { url: match[1]!, log: () => log, stop: () => proc.kill() };
}

const timings: Record<string, number[]> = { "/api/rep": [], "/api/check": [] };
async function post<T>(app: App, path: string, body: unknown) {
  const started = performance.now();
  const response = await fetch(new URL(path, app.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  const ms = Math.round(performance.now() - started);
  if (response.ok) timings[path]?.push(ms);
  return { status: response.status, data, ms };
}

const app = await startApp({ PORT: process.env.PORT ?? "0" });
console.log(`The app is on ${app.url}; rep effort ${REP_EFFORT}, check effort ${CHECK_EFFORT}.`);
console.log(`${skill}: ${phrasings.length} phrasings from the demo export.\n`);

// Every text the model saw or wrote, to look for in the logs at the end.
const seen: string[] = [...phrasings, known.wrong, known.right];
const problems: string[] = [];
let lesson = "";

async function nextRep(withLesson: boolean) {
  const body: RepRequest = { skill, phrasings, earlierProblems: problems, withLesson };
  const { status, data, ms } = await post<RepResponse>(app, "/api/rep", body);
  if (status !== 200) {
    check(false, `rep ${problems.length + 1} answered ${status}: ${data.error}`);
    return false;
  }
  const n = problems.length + 1;
  if (withLesson) {
    lesson = data.lesson ?? "";
    seen.push(lesson);
    console.log(`Lesson (${ms}ms, ${words(lesson).length} words):\n  ${lesson}\n`);
    check(lesson !== "", "the first rep brings a lesson");
  } else {
    check(!("lesson" in data), `rep ${n} brings no lesson`);
  }
  const problem = data.problem;
  console.log(`Problem ${n} (${ms}ms):\n  ${problem}`);
  const closest = Math.max(0, ...problems.map((p) => similarity(problem, p)));
  check(closest < MAX_SIMILARITY, `problem ${n} differs from every earlier problem (closest shares ${Math.round(closest * 100)}% of word triples)`);
  const quoted = phrasings.filter((p) => quotes(problem, p));
  check(quoted.length === 0, `problem ${n} quotes no phrasing${quoted.length ? `: ${quoted.join(" | ")}` : ""}`);
  const giveaway = problem.match(GIVEAWAY);
  check(!giveaway, `problem ${n} names or describes no fix${giveaway ? `: ${giveaway[0]}` : ""}`);
  console.log();
  problems.push(problem);
  seen.push(problem);
  return true;
}

console.log("1. A lesson and three problems in turn, each rep given the earlier problems");
let answered = await nextRep(true);
for (let i = 0; answered && i < 2; i++) answered = await nextRep(false);

console.log("2. Two more problems, then the known answers on all five");
for (let i = 0; answered && i < 2; i++) answered = await nextRep(false);
for (const [n, problem] of problems.entries()) {
  for (const [label, answer, want] of [
    ["wrong", known.wrong, "fail"],
    ["right", known.right, "pass"],
  ] as const) {
    const body: CheckRequest = { skill, problem, answer };
    const { status, data, ms } = await post<CheckResponse>(app, "/api/check", body);
    if (status !== 200) {
      check(false, `problem ${n + 1}, ${label} answer: ${status} ${data.error}`);
      continue;
    }
    seen.push(data.reason);
    const named = label === "wrong" ? /stash/i.test(data.reason) : true;
    check(data.verdict === want && named, `problem ${n + 1}, ${label} answer: ${data.verdict} (${ms}ms) ${data.reason}`);
  }
}

console.log("\n3. Bad bodies get a 400 from the route itself");
const bad: [string, string, unknown][] = [
  ["/api/rep", "not JSON", "{ oops"],
  ["/api/rep", "no withLesson", { skill, phrasings, earlierProblems: [] }],
  ["/api/rep", "no phrasings", { skill, phrasings: [], earlierProblems: [], withLesson: true }],
  ["/api/rep", "an extra key", { skill, phrasings, earlierProblems: [], withLesson: true, answer: "x" }],
  ["/api/check", "an empty answer", { skill, problem: "A problem.", answer: "  " }],
  ["/api/check", "a numeric problem", { skill, problem: 7, answer: "An answer." }],
];
for (const [path, label, body] of bad) {
  const { status, data } = await post(app, path, body);
  check(status === 400 && typeof data.error === "string", `${path}, ${label}: ${status} ${data.error}`);
}

console.log("\n4. A cut-off or refused model reply comes back as an error, not a result");
// A debug-only proxy that lives in this script: the second app instance reaches
// the API through it. In "cut" mode it forwards the real request with a tiny
// max_tokens; in "refuse" mode it answers with a stubbed refusal.
const CUT_MAX_TOKENS = 16;
let mode: "cut" | "refuse" = "cut";
let upstreamStop = "";
const proxy = Bun.serve({
  port: 0,
  async fetch(request) {
    const body = (await request.json()) as Record<string, unknown>;
    if (mode === "refuse") {
      upstreamStop = "refusal (stubbed)";
      return Response.json({
        id: "msg_stub",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [],
        stop_reason: "refusal",
        stop_sequence: null,
        stop_details: { type: "refusal", category: null, explanation: null },
        usage: { input_tokens: 0, output_tokens: 0 },
      });
    }
    const headers = new Headers(request.headers);
    for (const name of ["host", "content-length", "accept-encoding"]) headers.delete(name);
    const { pathname, search } = new URL(request.url);
    const upstream = await fetch(`https://api.anthropic.com${pathname}${search}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, max_tokens: CUT_MAX_TOKENS }),
    });
    const text = await upstream.text();
    const reply = JSON.parse(text);
    upstreamStop = `${upstream.status} ${reply.stop_reason ?? reply.error?.type}`;
    return new Response(text, { status: upstream.status, headers: { "content-type": "application/json" } });
  },
});
const forced = await startApp({ PORT: "0", ANTHROPIC_BASE_URL: proxy.url.href.replace(/\/$/, "") });
const forcedRep: RepRequest = { skill, phrasings, earlierProblems: [], withLesson: true };
const forcedCheck: CheckRequest = { skill, problem: problems[0] ?? "Undo your last commit.", answer: known.right };
const forcedCalls: [string, RepRequest | CheckRequest][] = [
  ["/api/rep", forcedRep],
  ["/api/check", forcedCheck],
];
for (const m of ["cut", "refuse"] as const) {
  mode = m;
  for (const [path, body] of forcedCalls) {
    const { status, data } = await post(forced, path, body);
    const label = m === "cut" ? `max_tokens ${CUT_MAX_TOKENS}` : "refusal";
    const isError = status === 502 && typeof data.error === "string" && !("problem" in data) && !("verdict" in data);
    check(isError, `${path}, ${label}: the API said ${upstreamStop}; the app answered ${status} ${JSON.stringify(data)}`);
  }
}
forced.stop();
proxy.stop();

console.log("\n5. The app's logs hold no phrasing, lesson, problem, answer, or reason");
app.stop();
const logs = app.log() + forced.log();
const leaked = seen.filter((text) => quotes(logs, text));
check(leaked.length === 0, `${seen.length} texts looked for, ${leaked.length} found in the logs`);
console.log(logs.trim().replace(/^/gm, "     "));

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
console.log(`\nMean latency: rep ${mean(timings["/api/rep"]!)}ms over ${timings["/api/rep"]!.length}, check ${mean(timings["/api/check"]!)}ms over ${timings["/api/check"]!.length}.`);
if (failed) {
  console.log(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log("The rep and check routes hold up on the demo skill.");
