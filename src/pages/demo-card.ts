// Card A of the demo export, for the landing page. It runs as a Bun macro
// when the pages are bundled (`with { type: "macro" }` in landing.ts), so the
// bundle carries only this one card's skill and borrows, never the answer key
// or the rest of the export. It reads the export the way the proof of
// concept's reader numbered it (each non-empty message of the user's, m1, m2,
// and so on, in file order), and also accepts the export's own message ids,
// so the answer key can name either.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DemoCard = { skill: string; borrows: { text: string; at: string }[] };

type Node = { id?: string; message?: { id?: string; author?: { role?: string }; create_time?: number | null; content?: { parts?: unknown[] } } | null };
type Conversation = { create_time: number; mapping: Record<string, Node> };

const DEMO = join(import.meta.dir, "..", "..", "demo");

export function demoCard(): DemoCard {
  const conversations: Conversation[] = JSON.parse(readFileSync(join(DEMO, "export.json"), "utf8"));
  const key: { skills: { name: string; messageIds: string[] }[] } = JSON.parse(readFileSync(join(DEMO, "answer-key.json"), "utf8"));

  const byId = new Map<string, { text: string; time: number }>();
  let n = 0;
  for (const conversation of conversations) {
    for (const [nodeId, node] of Object.entries(conversation.mapping)) {
      const message = node.message;
      if (message?.author?.role !== "user") continue;
      const text = (message.content?.parts ?? []).filter((part): part is string => typeof part === "string").join("\n").trim();
      if (!text) continue;
      const phrasing = { text, time: message.create_time ?? conversation.create_time };
      byId.set(`m${++n}`, phrasing);
      byId.set(message.id ?? nodeId, phrasing);
    }
  }

  const [a] = key.skills;
  if (!a) throw new Error("The demo answer key has no card A.");
  const borrows = a.messageIds.map((id) => {
    const phrasing = byId.get(id);
    if (!phrasing) throw new Error(`The demo answer key names a message the demo export doesn't have: ${id}.`);
    return phrasing;
  });
  return {
    skill: a.name,
    borrows: borrows.sort((x, y) => x.time - y.time).map(({ text, time }) => ({ text, at: new Date(time * 1000).toISOString() })),
  };
}
