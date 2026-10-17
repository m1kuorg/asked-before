// A demo export (demo/), read by the SDK's export reader into the proof of
// concept's message shape, for check:key, which checks the answer key
// against the export: ids m1, m2, … in export order, as the answer key
// names them, each with its conversation's id and its time in Unix seconds.

import { readExport } from "@asked-before/sdk";
import { join } from "node:path";

/** One of your own messages. `time` is Unix seconds. */
export type Message = { id: string; conversationId: string; text: string; time: number };

const DEMO = join(import.meta.dir, "..", "..", "demo");

/** Reads demo/<name>, such as "export.json". */
export async function demoMessages(name: string): Promise<Message[]> {
  const file = Bun.file(join(DEMO, name));
  const conversations: { conversation_id: string; mapping: Record<string, unknown> }[] = await file.json();
  const conversationOf = new Map(conversations.flatMap((c) => Object.keys(c.mapping).map((nodeId) => [nodeId, c.conversation_id] as const)));
  const { phrasings } = await readExport(file);
  return phrasings.map((p, i) => ({ id: `m${i + 1}`, conversationId: conversationOf.get(p.sourceId)!, text: p.text, time: Date.parse(p.time) / 1000 }));
}
