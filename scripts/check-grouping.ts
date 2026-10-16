// Sends the demo export's messages to the running app's group route, the way
// the stack does, and compares each run's cards with the answer key. Prints
// ids and skill names only, never message text.
// Run: bun run start, then bun run check:grouping [runs], with the same PORT.

import { toGroupRequest } from "../src/api";
import { buildCards } from "../src/cards";
import { parseExport } from "../src/parser";
import type { GroupResponse } from "../src/types";

const runs = Number(process.argv[2] ?? 3);
const url = `http://localhost:${process.env.PORT ?? 3000}/api/group`;

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();
const messages = parseExport(await read("../demo/export.json"));
const key: { skills: { name: string; messageIds: string[]; count: number; firstMonth: string; lastMonth: string }[]; oneOffs: string[] } =
  JSON.parse(await read("../demo/answer-key.json"));
const demoSkill = key.skills[0]!;
const body = JSON.stringify(toGroupRequest(messages));

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
const idList = (list: string[]) => [...list].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join(" ");

console.log(`${runs} run(s) against ${url}, ${messages.length} messages\n`);
let missed = 0;
for (let run = 1; run <= runs; run++) {
  const started = performance.now();
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  const data = (await response.json()) as GroupResponse & { error?: string };
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (!response.ok) {
    console.log(`Run ${run}: MISS, ${response.status} ${data.error} (${seconds}s)\n`);
    missed++;
    continue;
  }

  const problems: string[] = [];
  let cards: ReturnType<typeof buildCards> = [];
  try {
    cards = buildCards(data, messages);
  } catch (error) {
    problems.push(`the card builder refused it: ${error instanceof Error ? error.message : String(error)}`);
  }
  const lines = cards.map((card, i) => {
    const letter = String.fromCharCode(65 + i);
    const want = key.skills[i];
    const got = card.borrows.map((b) => b.messageId);
    const ok =
      want !== undefined &&
      sameIds(got, want.messageIds) &&
      card.count === want.count &&
      card.firstMonth === want.firstMonth &&
      card.lastMonth === want.lastMonth;
    if (!ok) problems.push(`card ${letter} doesn't match the key's ${want?.name ?? "nothing"}`);
    return `  ${ok ? "ok  " : "FAIL"} ${letter}  "${card.skill}": ${card.count}, ${card.firstMonth} to ${card.lastMonth} [${idList(got)}]`;
  });
  if (cards.length !== key.skills.length) problems.push(`${cards.length} cards, the key has ${key.skills.length}`);
  const carded = new Set(cards.flatMap((card) => card.borrows.map((b) => b.messageId)));
  const strays = key.oneOffs.filter((id) => carded.has(id));
  if (strays.length) problems.push(`one-offs on a card: ${idList(strays)}`);
  const demoCard = cards.find((card) => card.borrows.some((b) => b.messageId === demoSkill.messageIds[0]));
  const demoTogether = demoCard !== undefined && sameIds(demoCard.borrows.map((b) => b.messageId), demoSkill.messageIds);
  if (!demoTogether) problems.push(`the ${demoSkill.name} phrasings aren't alone on one card`);
  if (cards[0]?.skill !== demoSkill.name) problems.push(`card A is named "${cards[0]?.skill}", not "${demoSkill.name}"`);

  console.log(`Run ${run}: ${problems.length ? "MISS" : "match"} (${seconds}s)`);
  console.log(lines.join("\n"));
  console.log(`  ${demoTogether ? "ok  " : "FAIL"} the ${demoSkill.count} "${demoSkill.name}" phrasings on one card, no strangers`);
  console.log(`  ${strays.length ? "FAIL" : "ok  "} no one-off makes a card (${key.oneOffs.length} one-offs)`);
  for (const problem of problems) console.log(`  - ${problem}`);
  console.log();
  if (problems.length) missed++;
}

if (missed) {
  console.log(`${missed} of ${runs} run(s) missed the answer key.`);
  process.exit(1);
}
console.log(`All ${runs} run(s) match the answer key.`);
