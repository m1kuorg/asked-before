// Runs the parser and the card builder on the demo export, with the answer
// key's groups standing in for the group route, and checks the cards against
// the key; then feeds it broken groupings and expects a GroupingError.
// Run: bun run check:cards

import { buildCards, GroupingError, MAX_SKILL_NAME } from "../src/cards";
import { parseExport } from "../src/parser";
import type { GroupResponse } from "../src/types";

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();
const messages = parseExport(await read("../demo/export.json"));
const key: { skills: { name: string; messageIds: string[]; count: number; firstMonth: string; lastMonth: string }[]; oneOffs: string[] } =
  JSON.parse(await read("../demo/answer-key.json"));

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed++;
};

console.log("Cards from the answer key's groups, plus each one-off as a group of one");
const grouping: GroupResponse = {
  skills: [
    ...key.oneOffs.map((id) => ({ name: "A one-off", messageIds: [id] })),
    ...key.skills.toReversed().map(({ name, messageIds }) => ({ name, messageIds })),
  ],
};
const cards = buildCards(grouping, messages);
const text = new Map(messages.map((m) => [m.id, m.text]));
check(cards.length === key.skills.length, `${cards.length} cards; the one-offs make none`);
cards.forEach((card, i) => {
  const want = key.skills[i]!;
  const dates = card.borrows.map((b) => b.date);
  const ok =
    card.skill === want.name &&
    card.count === want.count &&
    card.firstMonth === want.firstMonth &&
    card.lastMonth === want.lastMonth &&
    card.borrows.length === card.count &&
    dates.every((d, j) => j === 0 || dates[j - 1]! <= d) &&
    card.borrows.every((b) => want.messageIds.includes(b.messageId) && b.text === text.get(b.messageId));
  check(ok, `${String.fromCharCode(65 + i)}  ${card.skill}: ${card.count}, ${card.firstMonth} to ${card.lastMonth}`);
});

console.log("\nBroken groupings make an error, not a card");
const [a, b] = key.skills;
const expectError = (label: string, skills: GroupResponse["skills"]) => {
  try {
    buildCards({ skills }, messages);
    check(false, `${label}: built cards`);
  } catch (error) {
    check(error instanceof GroupingError, `${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
};
expectError("unknown id", [{ name: a!.name, messageIds: [...a!.messageIds, "m999"] }]);
expectError("id in two groups", [
  { name: a!.name, messageIds: a!.messageIds },
  { name: b!.name, messageIds: [...b!.messageIds, a!.messageIds[0]!] },
]);
expectError("id twice in one group", [{ name: a!.name, messageIds: [...a!.messageIds, a!.messageIds[0]!] }]);
expectError(`name over ${MAX_SKILL_NAME} characters`, [{ name: "x".repeat(MAX_SKILL_NAME + 1), messageIds: a!.messageIds }]);
expectError("name on two lines", [{ name: "Undo a git\ncommit", messageIds: a!.messageIds }]);
expectError("empty name", [{ name: "  ", messageIds: a!.messageIds }]);

console.log("\nGroups under two borrows are dropped quietly");
const dropped = buildCards({ skills: [{ name: "x".repeat(MAX_SKILL_NAME + 1), messageIds: [key.oneOffs[0]!] }] }, messages);
check(dropped.length === 0, "a group of one makes no card, and its name isn't checked");
const single = parseExport(await read("../demo/no-repeats.json"));
const none = buildCards({ skills: single.map((m) => ({ name: "Asked once", messageIds: [m.id] })) }, single);
check(none.length === 0, `the no-repeats export makes zero cards (${single.length} messages)`);

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nThe card builder matches the answer key.");
