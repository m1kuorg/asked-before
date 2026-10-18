// Checks the SDK's export readers (m1kuorg/basics#43) at their boundary: an
// export in, phrasings out. Each fixture in packages/sdk/fixtures/ (ChatGPT
// and Claude, JSON and zip, numbered shards, a zip inside a zip) must yield
// the phrasings, source ids, and times written out below, with longer
// messages skipped and counted, and ChatGPT's abandoned branch, hidden
// messages, and everyone else's words left out; with no current_node, only
// the branch to the latest leaf counts. The demo export yields its
// 27 phrasings. A broken export fails with an ExportError that names the
// field and never quotes a message. It prints each step's checks and exits
// 1 if any fails, naming the step.
// Run: bun run check:readers

import { ExportError, readExport, type Phrasing, type ReadExport } from "@asked-before/sdk";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const FIXTURES = join(ROOT, "packages", "sdk", "fixtures");
const fixture = (name: string) => Bun.file(join(FIXTURES, name));

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

const AT_THE_LIMIT = `how do i read this stack trace ${"a".repeat(2000 - 31)}`;

const CHATGPT: Phrasing[] = [
  { sourceId: "g1-ask", text: "how do i rerun only the failed tests in jest", time: "2025-10-09T08:53:30.250Z" },
  { sourceId: "g1-follow-up", text: "why does this screenshot show a timeout", time: "2025-10-09T08:56:40.000Z" },
  { sourceId: "g2-ask", text: "how do I re-run just the failing jest tests", time: "2025-10-10T12:40:00.000Z" },
  { sourceId: "g2-long", text: AT_THE_LIMIT, time: "2025-10-10T12:45:00.000Z" },
];

const NO_CURRENT_NODE: Phrasing[] = [
  { sourceId: "g3-ask", text: "how do i squash my commits before merging", time: "2025-10-11T16:26:50.000Z" },
  { sourceId: "g3-follow-up", text: "and how do i push the squashed branch", time: "2025-10-11T16:31:40.000Z" },
];

const CLAUDE: Phrasing[] = [
  { sourceId: "c1-ask", text: "how do i squash my last three commits", time: "2026-05-01T09:00:05.123Z" },
  { sourceId: "c1-follow-up", text: "and how do i undo a rebase", time: "2026-05-01T09:03:00.000Z" },
  { sourceId: "c2-ask", text: "what does git rebase --onto do", time: "2026-06-12T14:10:30.500Z" },
];

/** Words in the fixtures that aren't the learner's own phrasings, or that belong to a branch they left. */
const NEVER = [
  "the abandoned branch's question",
  "a question on a branch left behind",
  "another question on a branch left behind",
  "Run `jest --onlyFailures`.",
  "print(open('log').read())",
  "Timeout after 5000 ms",
  "I'm learning to code.",
  "Rerun failed jest tests",
  "Run git rebase -i HEAD~3",
  "The learner wants interactive rebase.",
  "the attachment's contents",
  "Rebase help",
  "FAIL src/cart.test.ts",
];

const short = (p: Phrasing) => ({ ...p, text: p.text.length > 60 ? `${p.text.slice(0, 30)}… (${p.text.length} characters)` : p.text });

function expect(read: ReadExport, source: string, phrasings: Phrasing[], skipped: number) {
  check(read.source === source, `the source is ${read.source}`);
  check(read.phrasings.length === phrasings.length, `${read.phrasings.length} phrasings (expected ${phrasings.length})`);
  phrasings.forEach((want, i) => {
    const got = read.phrasings[i];
    const same = got !== undefined && got.sourceId === want.sourceId && got.text === want.text && got.time === want.time && Object.keys(got).length === 3;
    check(same, `phrasing ${i + 1}: ${JSON.stringify(short(want))}${same ? "" : `, got ${JSON.stringify(got && short(got))}`}`);
  });
  check(read.skipped === skipped, `${read.skipped} message(s) over 2,000 characters skipped (expected ${skipped})`);
  const leaked = NEVER.filter((words) => read.phrasings.some((p) => p.text.includes(words)));
  check(leaked.length === 0, `no assistant, system, tool, title, attachment, or abandoned-branch words${leaked.length ? `: ${leaked.join(" | ")}` : ""}`);
}

await step("1. A ChatGPT conversations.json: the current branch only, your own words, dated", async () => {
  const text = await fixture("chatgpt.json").text();
  expect(await readExport(text), "chatgpt", CHATGPT, 1);
  check(!(await readExport(text)).phrasings.some((p) => p.sourceId === "g1-edited-away"), "the abandoned branch's message isn't counted");
  expect(await readExport(fixture("chatgpt.json")), "chatgpt", CHATGPT, 1);
  console.log("     (the same file as a Blob)");
});

await step("2. A ChatGPT conversation with no current_node: only the branch to its latest leaf", async () => {
  expect(await readExport(fixture("chatgpt-no-current-node.json")), "chatgpt", NO_CURRENT_NODE, 0);
});

await step("3. A Claude conversations.json: human messages, flat text or content blocks", async () => {
  expect(await readExport(await fixture("claude.json").text()), "claude", CLAUDE, 1);
});

await step("4. A ChatGPT zip sharded into numbered files, beside the shared_conversations.json trap", async () => {
  expect(await readExport(fixture("chatgpt-sharded.zip")), "chatgpt", CHATGPT, 1);
  const bytes = new Uint8Array(await fixture("chatgpt-sharded.zip").arrayBuffer());
  expect(await readExport(bytes), "chatgpt", CHATGPT, 1);
  console.log("     (the same zip as bytes)");
});

await step("5. A ChatGPT zip inside a zip, as the privacy portal sends it", async () => {
  expect(await readExport(fixture("chatgpt-nested.zip")), "chatgpt", CHATGPT, 1);
});

await step("6. A Claude zip", async () => {
  expect(await readExport(fixture("claude.zip")), "claude", CLAUDE, 1);
});

await step("7. The demo export: 27 phrasings, each with its node's id", async () => {
  const read = await readExport(Bun.file(join(ROOT, "demo", "export.json")));
  check(read.source === "chatgpt" && read.skipped === 0, `source ${read.source}, ${read.skipped} skipped`);
  check(read.phrasings.length === 27, `${read.phrasings.length} phrasings`);
  check(new Set(read.phrasings.map((p) => p.sourceId)).size === read.phrasings.length, "every source id is different");
  const first = read.phrasings[0];
  check(
    first?.sourceId === "d199914c-35c9-4bb5-943d-33033b7639a2" && first.text === "how do i undo my last git commit" && first.time === "2025-03-04T09:12:40.000Z",
    `the first is the git question, dated by its conversation: ${JSON.stringify(first)}`,
  );
});

await step("8. A broken export fails with an ExportError naming the field, never quoting a message", async () => {
  const demo: Record<string, any>[] = await Bun.file(join(ROOT, "demo", "export.json")).json();
  const claude: Record<string, any>[] = await fixture("claude.json").json();
  const firstUser = (c: Record<string, any>) => Object.values<any>(c.mapping).find((n) => n.message?.author?.role === "user").message;
  const cutShort = new Uint8Array(await fixture("claude.zip").arrayBuffer()).subarray(0, 40);
  const noConversations = new Uint8Array(await fixture("no-conversations.zip").arrayBuffer());
  const cases: [string, () => string | Uint8Array, RegExp][] = [
    ["not JSON", () => "{ oops", /JSON/],
    ["not a list of conversations", () => JSON.stringify({ chats: [] }), /list of conversations/],
    ["no conversations at all", () => "[]", /no conversations/],
    ["neither ChatGPT's nor Claude's", () => JSON.stringify([{ title: "x" }]), /mapping.*chat_messages/],
    ["a zip with no conversations file", () => noConversations, /conversations\.json/],
    ["a zip that's cut short", () => cutShort, /zip/i],
    ["ChatGPT: conversation 3's mapping is missing", () => edit(demo, (d) => delete d[2]!.mapping), /Conversation 3\b.*mapping/],
    ["ChatGPT: a conversation's create_time is text", () => edit(demo, (d) => (d[3]!.create_time = "2025-04-28")), /Conversation 4\b.*create_time/],
    ["ChatGPT: content.parts isn't a list", () => edit(demo, (d) => (firstUser(d[4]!).content.parts = "hi")), /Conversation 5\b.*content\.parts/],
    ["ChatGPT: a message has no author", () => edit(demo, (d) => delete firstUser(d[5]!).author), /Conversation 6\b.*author\.role/],
    ["ChatGPT: a message's create_time is text", () => edit(demo, (d) => (firstUser(d[6]!).create_time = "yesterday")), /Conversation 7\b.*create_time/],
    ["ChatGPT: a part is a number", () => edit(demo, (d) => (firstUser(d[7]!).content.parts = [42])), /Conversation 8\b.*content part/],
    ["ChatGPT: current_node names no node", () => edit(demo, (d) => (d[8]!.current_node = "nowhere")), /Conversation 9\b.*current_node/],
    ["Claude: chat_messages isn't a list", () => edit(claude, (d) => (d[1]!.chat_messages = {})), /Conversation 2\b.*chat_messages/],
    ["Claude: a message has no sender", () => edit(claude, (d) => delete d[0]!.chat_messages[0].sender), /Conversation 1\b.*message 1\b.*sender/],
    ["Claude: a message has no uuid", () => edit(claude, (d) => delete d[0]!.chat_messages[2].uuid), /Conversation 1\b.*message 3\b.*uuid/],
    ["Claude: a message's created_at isn't a date", () => edit(claude, (d) => (d[1]!.chat_messages[2].created_at = "soon")), /Conversation 2\b.*message 3\b.*created_at/],
  ];
  const words = [...demo.flatMap((c) => Object.values<any>(c.mapping).flatMap((n) => n.message?.content?.parts ?? [])), ...NEVER, ...CLAUDE.map((p) => p.text)]
    .filter((p): p is string => typeof p === "string" && p.length > 8);
  for (const [label, make, names] of cases) {
    try {
      await readExport(make());
      check(false, `${label}: read anyway`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const quoted = words.find((w) => message.includes(w));
      check(error instanceof ExportError && names.test(message) && !quoted, `${label}: ${error instanceof ExportError ? "ExportError" : "not an ExportError"} "${message}"${quoted ? ", quoting a message" : ""}`);
    }
  }
});

function edit<T>(data: T, change: (copy: T) => unknown): string {
  const copy = structuredClone(data);
  change(copy);
  return JSON.stringify(copy);
}

console.log(failures.length ? `\n${failures.length} check(s) failed:\n${failures.join("\n")}` : "\nevery check passed");
process.exit(failures.length ? 1 : 0);
