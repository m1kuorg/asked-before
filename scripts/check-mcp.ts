// Checks the MCP server (m1kuorg/basics#50) over stdio with the official
// MCP client, launched as the setup snippets launch it (connect.ts), with
// a real API key on a fresh copy of the app. The demo export's upload is
// sorted by a stand-in in this script as the answer key says (the sort has
// its own check); every capture, cold rep, and check goes on to the real
// model. The server lists five tools described in the glossary's words,
// saying only the learner's own words are sent; it lists the demo shelf
// and its cards, records a rephrasing of undoing the last commit onto card
// A with its count up by one, adds no borrow for the same words again,
// leaves a question nothing matches unsorted and says so, starts a cold
// rep on card A, and passes the known right answer, stamping it returned.
// Then failures as tool errors, a default shelf, a bad key, an
// unreachable server, missing settings, and no avoided word anywhere. It
// prints each tool's text, which holds made-up demo data, and exits 1 if
// any check fails, naming the step. It needs ANTHROPIC_API_KEY, and makes
// 4 model calls in under a minute.
// Run: bun run check:mcp

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { join } from "node:path";
import { ENTRY_IN_CLONE, MCP_ENV } from "../packages/mcp/src/connect";
import { key, phrasings, sortEnds, upload } from "./lib/answer-key";
import { startApp } from "./lib/app";
import { forward, startModelStub } from "./lib/model-stub";
import { kindOf, known, sortsByKey } from "./lib/reps";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("check:mcp asks the real model: set ANTHROPIC_API_KEY.");
  process.exit(1);
}

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

const ROOT = join(import.meta.dir, "..");
const ENTRY = join(ROOT, ENTRY_IN_CLONE);
const glossary = await Bun.file(join(ROOT, "GLOSSARY.md")).text();

/** Starts the MCP server with `env`, as an agent would, and connects the official client to it. */
async function connect(env: Record<string, string>) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [ENTRY], env, stderr: "pipe" });
  const client = new Client({ name: "check-mcp", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

type Result = { isError: boolean; text: string; data: any };
/** Every text the server sent an agent: descriptions, instructions, and tool answers. */
const said: string[] = [];
/** Calls a tool, and reads its text and structured content. */
async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Result> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text?: string }[]).map((c) => c.text ?? "").join("\n");
  const data = result.structuredContent as any;
  // The model wrote the problem, the lesson, and the reason, so only the server's own words around them count.
  said.push([data?.problem, data?.lesson, data?.reason].reduce((rest: string, model?: string) => (model ? rest.replace(model, "") : rest), text));
  return { isError: result.isError === true, text, data };
}
/** A JSON Schema's property names, at any depth, as words: alreadyCaptured and not_returned read "already captured" and "not returned". */
const fieldNames = (schema: unknown): string => {
  if (!schema || typeof schema !== "object") return "";
  const { properties, ...rest } = schema as { properties?: Record<string, unknown> };
  const own = Object.keys(properties ?? {}).map((name) => name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
  return [...own, ...Object.values(properties ?? {}).map(fieldNames), ...Object.values(rest).map(fieldNames)].filter(Boolean).join(" ");
};
const indent = (text: string) => text.replace(/^/gm, "       ");

// The demo export's upload is sorted as the answer key says (the sort has its own check); every capture, rep, and check goes to the real model.
let demoSorted = false;
const sortDemo = sortsByKey();
const model = await startModelStub((request, raw, body) => (demoSorted ? forward : sortDemo)(request, raw, body));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const mcps: Client[] = [];

try {
  const ada = app.browser().client;
  await ada.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
  const demo = await ada.shelves.create({ name: "Demo", demo: true });
  await sortEnds(ada, (await upload(ada, demo.id, phrasings, "demo-export.json")).id);
  demoSorted = true;
  const { key: apiKey } = await ada.keys.create({ name: "Claude Code" });
  let mcp: Client;

  await step("1. The server starts over stdio and lists its five tools, described in the library's words", async () => {
    mcp = await connect({ [MCP_ENV.url]: app.url, [MCP_ENV.apiKey]: apiKey });
    mcps.push(mcp);
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name).sort();
    check(names.join() === "check_answer,list_cards,list_shelves,record_question,start_cold_rep", `tools: ${names.join(", ")}, on protocol ${mcp.getNegotiatedProtocolVersion()}`);
    const instructions = mcp.getInstructions() ?? "";
    said.push(instructions, ...tools.flatMap((t) => [t.title ?? "", t.description ?? "", fieldNames(t.inputSchema), fieldNames(t.outputSchema)]));
    const terms = [...glossary.matchAll(/^\*\*(.+)\*\*:$/gm)].map((m) => m[1]!.toLowerCase());
    const bare = tools.filter((t) => !terms.some((term) => (t.description ?? "").toLowerCase().includes(term)));
    check(bare.length === 0, `each description names the glossary's ${terms.filter((term) => tools.some((t) => (t.description ?? "").toLowerCase().includes(term))).join(", ")}${bare.length ? `; not ${bare.map((t) => t.name).join(", ")}` : ""}`);
    const describe = (name: string) => tools.find((t) => t.name === name)?.description ?? "";
    check(/only the learner's own words/.test(describe("record_question")) && /never your answer, their code, file contents, or secrets/.test(describe("record_question")), "record_question says only the learner's own words are sent, never the agent's answer, code, or secrets");
    check(/only the learner's own answer, exactly as they wrote it/.test(describe("check_answer")) && /Don't hint, explain, or answer/.test(describe("start_cold_rep")), "check_answer sends only their own answer as written, and start_cold_rep gives no hints");
    check(/record_question/.test(instructions) && /own words/.test(instructions), "the server's instructions say when to record a question, in the learner's own words");
    const record = tools.find((t) => t.name === "record_question")?.inputSchema as { required?: string[] } | undefined;
    check(record?.required?.join() === "question", `record_question needs only the question: ${record?.required?.join(", ")}`);
  });

  let cardA = "";

  await step("2. list_shelves gives the demo shelf, labeled demo data, with its counts", async () => {
    const { isError, text, data } = await call(mcp, "list_shelves");
    console.log(indent(text));
    const shelf = data?.shelves?.[0];
    check(!isError && data.shelves.length === 1 && shelf.id === demo.id && shelf.demo && shelf.cards === 5 && shelf.borrowed === 5, `the demo shelf: ${shelf?.cards} cards, ${shelf?.borrowed} borrowed`);
    check(/"Demo" \(demo data\)/.test(text) && data.defaultShelf === null && /No default shelf/.test(text), "its text labels it demo data, and says no default shelf is set");
  });

  await step("3. list_cards gives the demo shelf's cards, most borrowed first, with card A first", async () => {
    const { isError, text, data } = await call(mcp, "list_cards", { shelf: "demo" });
    console.log(indent(text));
    const [a] = data?.cards ?? [];
    cardA = a?.id ?? "";
    const want = key.skills[0]!;
    check(!isError && data.cards.length === key.skills.length && a.skill === want.name && a.count === want.count && a.status === "borrowed", `card A: "${a?.skill}", ${a?.count} borrows, ${a?.status}, of ${data?.cards?.length} cards`);
    check(data.cards.map((c: { skill: string }) => c.skill).join() === key.skills.map((k) => k.name).join(), "in the answer key's margin order");
    const byId = await call(mcp, "list_cards", { shelf: demo.id });
    check(byId.data?.cards?.length === key.skills.length, "a shelf's id works as well as its name");
  });

  const rephrasing = "how do I undo the commit I just made? I haven't pushed it yet";

  await step("4. record_question with a rephrasing of undoing the last commit lands on card A, its count up by one", async () => {
    const before = model.requests.length;
    const { isError, text, data } = await call(mcp, "record_question", { question: rephrasing, shelf: "Demo" });
    console.log(indent(text));
    const sent = model.requests.slice(before);
    check(sent.length === 1 && kindOf(sent[0]!) === "sort" && sent[0]!.body.output_config?.effort === "low", `${sent.length} model request, a sort at effort ${sent[0]?.body.output_config?.effort}, sent to the real model`);
    check(!isError && data.card?.id === cardA && data.card.count === key.skills[0]!.count + 1 && !data.alreadyCaptured, `card A, now ${data?.card?.count} borrows, already captured ${data?.alreadyCaptured}`);
    check(data.phrasing?.text === rephrasing && /borrowed 10 times/.test(text) && /start_cold_rep/.test(text), "it kept the words as sent, and its text gives the count and offers a cold rep");
  });

  await step("5. Recording the same words again within ten minutes adds no borrow", async () => {
    const before = model.requests.length;
    const { isError, text, data } = await call(mcp, "record_question", { question: rephrasing, shelf: "Demo" });
    console.log(indent(text));
    check(!isError && data.alreadyCaptured && data.card?.count === 10 && model.requests.length === before, `already captured ${data?.alreadyCaptured}, card A still ${data?.card?.count}, ${model.requests.length - before} model requests`);
    check(/no borrow was added/.test(text), "its text says no borrow was added");
    const cards = await call(mcp, "list_cards", { shelf: "Demo" });
    check(cards.data?.cards?.[0]?.count === 10, `list_cards gives card A ${cards.data?.cards?.[0]?.count} borrows`);
  });

  await step("6. Recording a question nothing matches leaves it unsorted, and says so", async () => {
    const question = "how do I tune a ukulele by ear";
    const { isError, text, data } = await call(mcp, "record_question", { question, shelf: "Demo" });
    console.log(indent(text));
    check(!isError && data.card === null && /waits unsorted/.test(text), `card ${data?.card?.skill ?? null}; its text says it waits unsorted`);
    const unsorted = await ada.cards.unsorted(demo.id);
    check(unsorted.phrasings[0]?.text === question, "it's the demo shelf's newest unsorted phrasing");
  });

  let repId = "";

  await step("7. start_cold_rep on card A gives a problem and, on its first rep, the lesson", async () => {
    const { isError, text, data } = await call(mcp, "start_cold_rep", { card_id: cardA });
    console.log(indent(text));
    repId = data?.repId ?? "";
    check(!isError && data.problem.length > 0 && (data.lesson ?? "").length > 0, `a problem of ${data?.problem?.length} characters and a lesson of ${data?.lesson?.length}`);
    check(text.includes(data.problem) && text.includes(repId) && /check_answer/.test(text), "its text holds the problem, the rep id, and says to pass the answer to check_answer");
  });

  await step("8. check_answer with the known right answer passes, and stamps card A returned", async () => {
    const { isError, text, data } = await call(mcp, "check_answer", { rep_id: repId, answer: known.right });
    console.log(indent(text));
    check(!isError && data.verdict === "pass" && data.card.id === cardA && data.card.status === "returned", `${data?.verdict}, card A ${data?.card?.status}`);
    check(/^Passed\./.test(text) && /is returned, stamped \d{4}-\d{2}-\d{2}/.test(text), "its text says so, with the stamp");
    const open = await call(mcp, "list_cards", { shelf: "Demo", not_returned: true });
    const skills = (open.data?.cards ?? []).map((c: { skill: string }) => c.skill);
    check(skills.length === key.skills.length - 1 && !skills.includes(key.skills[0]!.name), `not_returned lists ${skills.length} cards, without card A`);
  });

  await step("9. A failure is a tool error carrying Asked Before's message", async () => {
    const twice = await call(mcp, "check_answer", { rep_id: repId, answer: known.wrong });
    check(twice.isError && /checked already/.test(twice.text), `checking the rep again: ${twice.text}`);
    const missing = await call(mcp, "start_cold_rep", { card_id: "no-such-card" });
    check(missing.isError && missing.text === "There's no such card.", `a card that isn't there: ${missing.text}`);
    await ada.shelves.create({ name: "Work" });
    const unnamed = await call(mcp, "record_question", { question: "how do I squash commits" });
    check(unnamed.isError && /Say which shelf/.test(unnamed.text) && /"Demo", "Work"|"Work", "Demo"/.test(unnamed.text) && unnamed.text.includes(MCP_ENV.shelf), `no shelf and no default: ${unnamed.text}`);
    const nope = await call(mcp, "list_cards", { shelf: "Bootcamp" });
    check(nope.isError && /no shelf "Bootcamp"/.test(nope.text), `a shelf that isn't there: ${nope.text}`);
    const long = await call(mcp, "record_question", { question: "x".repeat(2001), shelf: "Demo" });
    check(long.isError && /Input validation error/.test(long.text), `a question of 2,001 characters: ${long.text.slice(0, 90)}`);
  });

  await step("10. With a default shelf, a call can leave the shelf out; a bad key or a missing setting says what to fix", async () => {
    const withDefault = await connect({ [MCP_ENV.url]: app.url, [MCP_ENV.apiKey]: apiKey, [MCP_ENV.shelf]: "Demo" });
    mcps.push(withDefault);
    const shelves = await call(withDefault, "list_shelves");
    check(shelves.data?.defaultShelf?.id === demo.id && /The default shelf is "Demo"/.test(shelves.text), `list_shelves names the default: ${shelves.data?.defaultShelf?.name}`);
    const recorded = await call(withDefault, "record_question", { question: rephrasing });
    check(!recorded.isError && recorded.data.shelf.id === demo.id && recorded.data.alreadyCaptured, `record_question with no shelf went to ${recorded.data?.shelf?.name}, already captured ${recorded.data?.alreadyCaptured}`);

    const badKey = await connect({ [MCP_ENV.url]: app.url, [MCP_ENV.apiKey]: "ab_0000000000000000_00000000000000000000000000000000" });
    mcps.push(badKey);
    const refused = await call(badKey, "list_shelves");
    check(refused.isError && refused.text.includes("That API key isn't valid.") && refused.text.includes(MCP_ENV.apiKey), `a bad key: ${refused.text}`);
    const away = await connect({ [MCP_ENV.url]: "http://127.0.0.1:9", [MCP_ENV.apiKey]: apiKey });
    mcps.push(away);
    const unreachable = await call(away, "list_shelves");
    check(unreachable.isError && /couldn't be reached at http:\/\/127\.0\.0\.1:9/.test(unreachable.text), `a server that isn't there: ${unreachable.text}`);

    const bare = Bun.spawn([process.execPath, ENTRY], { env: { PATH: process.env.PATH ?? "" }, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([bare.exited, new Response(bare.stderr).text()]);
    check(code === 1 && stderr.includes(MCP_ENV.url) && stderr.includes(MCP_ENV.apiKey), `with no settings it exits ${code}: ${stderr.trim()}`);
  });

  await step("11. Nothing the server says, field names included, uses a word the glossary says to avoid", async () => {
    const avoid = [...glossary.matchAll(/^_Avoid_: (.+)$/gm)].flatMap((m) => m[1]!.replace(/\([^)]*\)/g, "").split(",").map((w) => w.trim().toLowerCase()));
    const found = avoid.filter((word) => said.some((text) => new RegExp(`\\b${word}\\b`, "i").test(text)));
    check(found.length === 0, `${avoid.length} avoided words, in ${said.length} descriptions, field names, and answers: ${found.length ? found.join(", ") : "none used"}`);
  });
} finally {
  await Promise.all(mcps.map((client) => client.close()));
  await app.stop();
  model.stop();
}

current = "12. The app's logs hold none of the learner's words";
console.log(`\n${current}`);
const words = ["haven't pushed it yet", "tune a ukulele", known.right.slice(0, 40)];
const leaked = words.filter((text) => app.log().includes(text));
check(leaked.length === 0, `${words.length} looked for, ${leaked.length} found`);

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nThe MCP server holds up.");
