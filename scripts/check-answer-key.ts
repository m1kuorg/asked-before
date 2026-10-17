// Checks demo/answer-key.json against demo/export.json, and the export against
// what #7 asks of it. Run: bun run check:key

import { ExportError, readExport } from "@asked-before/sdk";
import { demoMessages } from "./lib/demo";

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();
const exportText = await read("../demo/export.json");
const key: { skills: { name: string; messageIds: string[]; count: number; firstMonth: string; lastMonth: string }[]; oneOffs: string[] } =
  JSON.parse(await read("../demo/answer-key.json"));

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
};

// The raw export, read here without the reader.
type RawMessage = { author: { role: string }; create_time?: number | null; content: { parts?: unknown[] } };
type RawNode = { message: RawMessage | null; children: string[] };
type RawConversation = { conversation_id: string; create_time: number; update_time: number; mapping: Record<string, RawNode> };
const raw: RawConversation[] = JSON.parse(exportText);
const nodes = raw.flatMap((c) => Object.values(c.mapping).map((node) => ({ c, node })));
const withMessage = nodes.filter(({ node }) => node.message);
const role = (r: string) => withMessage.filter(({ node }) => node.message!.author.role === r);
const stringParts = (m: RawMessage) => (m.content.parts ?? []).filter((p): p is string => typeof p === "string");
const rawUserTexts = role("user")
  .map(({ node }) => stringParts(node.message!).join("\n").trim())
  .filter((t) => t !== "");
const otherTexts = new Set(
  withMessage.filter(({ node }) => node.message!.author.role !== "user").flatMap(({ node }) => stringParts(node.message!)),
);

console.log("The SDK's reader on the demo export");
const messages = await demoMessages("export.json");
const byId = new Map(messages.map((m) => [m.id, m]));
check(messages.length === rawUserTexts.length, `${messages.length} messages, one per user message with text (${rawUserTexts.length})`);
check(messages.every((m, i) => m.text === rawUserTexts[i]), "each text is the user's own, word for word, in export order");
check(messages.every((m) => !otherTexts.has(m.text)), "no assistant, system, or tool text among them");
const undated = role("user").filter(({ node }) => node.message!.create_time == null);
check(undated.length >= 1, `${undated.length} user message(s) with no create_time`);
for (const { c } of undated) {
  const parsed = messages.find((m) => m.conversationId === c.conversation_id);
  check(parsed?.time === c.create_time, `  it's dated by its conversation's create_time, not its update_time`);
}

console.log("\nThe reader on broken exports fails loudly, naming the field");
// Each breakage edits a copy of the export in place, or returns replacement text.
type Loose = Record<string, unknown>;
const firstUser = (c: RawConversation) =>
  Object.values(c.mapping).find((n) => n.message?.author.role === "user")!.message! as unknown as Loose & { content: Loose };
const breakages: [string, (d: RawConversation[]) => string | void][] = [
  ["not JSON", () => "{ oops"],
  ["a mapping is missing", (d) => { delete (d[2] as Partial<RawConversation>).mapping; }],
  ["a conversation's create_time is text", (d) => { (d[3] as unknown as Loose).create_time = "2025-04-28"; }],
  ["a user message's content.parts isn't a list", (d) => { firstUser(d[4]!).content.parts = "hi"; }],
  ["a user message has no author", (d) => { delete firstUser(d[5]!).author; }],
  ["a user message's create_time is text", (d) => { firstUser(d[6]!).create_time = "yesterday"; }],
  ["a part is a number", (d) => { firstUser(d[7]!).content.parts = [42]; }],
];
for (const [label, breakIt] of breakages) {
  const data = structuredClone(raw);
  const replaced = breakIt(data);
  try {
    await readExport(replaced ?? JSON.stringify(data));
    check(false, `${label}: parsed anyway`);
  } catch (error) {
    check(error instanceof ExportError, `${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("\nThe export's shape");
check(role("system").length >= 1, `${role("system").length} system message(s)`);
check(role("tool").length >= 1, `${role("tool").length} tool message(s)`);
const nonText = withMessage.flatMap(({ node }) => node.message!.content.parts ?? []).filter((p) => typeof p !== "string");
check(nonText.length >= 1, `${nonText.length} non-text part(s)`);
const answered = role("user").every(({ c, node }) => {
  const seen: RawNode[] = [];
  let next = node.children[0];
  while (next) {
    const child = c.mapping[next]!;
    seen.push(child);
    next = child.children[0];
  }
  return seen.some((n) => n.message?.author.role === "assistant");
});
check(answered, "every user message has an assistant answer");
check(!/chatgpt/i.test(exportText), 'the export never says "ChatGPT"');

console.log("\nThe answer key");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (time: number) => {
  const d = new Date(time * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const keyed = [...key.skills.flatMap((s) => s.messageIds), ...key.oneOffs];
check(keyed.every((id) => byId.has(id)), "every id in the key is a parsed message");
check(new Set(keyed).size === keyed.length && keyed.length === messages.length, "every message is in exactly one skill or the one-offs");
for (const skill of key.skills) {
  const times = skill.messageIds.map((id) => byId.get(id)!.time).sort((a, b) => a - b);
  const conversations = new Set(skill.messageIds.map((id) => byId.get(id)!.conversationId));
  check(
    skill.count === times.length &&
      skill.firstMonth === monthOf(times[0]!) &&
      skill.lastMonth === monthOf(times.at(-1)!) &&
      conversations.size === times.length,
    `${skill.name}: ${skill.count}, ${skill.firstMonth} to ${skill.lastMonth}, one conversation each`,
  );
}
const [git, ...others] = key.skills;
const years = new Set(git!.messageIds.map((id) => new Date(byId.get(id)!.time * 1000).getUTCFullYear()));
check(
  git!.name === "Undo a git commit" && git!.count === 9 && git!.firstMonth === "March 2025" && git!.lastMonth === "September 2026" && years.size === 2,
  "card A is Undo a git commit, 9 borrows, March 2025 to September 2026, across the year turn",
);
check(others.length === 4 && others.every((s) => s.count >= 2 && s.count <= 4), "four smaller skills, each asked 2 to 4 times");
const last = (s: (typeof key.skills)[number]) => Math.max(...s.messageIds.map((id) => byId.get(id)!.time));
const ordered = key.skills.every((s, i) => {
  const prev = key.skills[i - 1];
  return !prev || prev.count > s.count || (prev.count === s.count && last(prev) > last(s));
});
check(ordered, "the key is in margin order: count first, a tie to the later last borrow");
const tie = others.some((s, i) => others.findIndex((o) => o.count === s.count) !== i);
console.log(`     the tie rule is ${tie ? "exercised" : "not exercised; every count is distinct"}`);
check(key.oneOffs.length >= 6, `${key.oneOffs.length} one-off questions`);

console.log("\nThe no-repeats export");
const single = await demoMessages("no-repeats.json");
check(single.length >= 3 && new Set(single.map((m) => m.text)).size === single.length, `${single.length} messages, no text asked twice`);

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nThe answer key matches the export.");
