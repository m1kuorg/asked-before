// The export readers (m1kuorg/basics#43): a ChatGPT or Claude export, as its
// zip or its conversations.json, read into phrasings on your own computer,
// in Bun, Node, or a browser, so that only your own words are uploaded
// (ADR 0001). The source is told from the conversations' shape. A zip is
// read from its directory, inflating only its conversations.json or its
// numbered conversations-NNN.json shards, or the ones in a zip inside it, so
// an export full of images never has to fit in memory. ChatGPT's tree is
// walked from each conversation's current node, so edited-away branches
// don't count. Messages over 2,000 characters (often pasted logs) are
// skipped and counted. A shape the reader can't use fails with an
// ExportError naming the field, never quoting a message. Neither vendor
// publishes a schema, so unknown fields and content types are passed over.

import { Inflate } from "fflate";

export type Source = "chatgpt" | "claude";

/** One of your own messages, as it's uploaded: the export's own message id, your words, and when you sent them (ISO). */
export type Phrasing = { sourceId: string; text: string; time: string };

export type ReadExport = {
  source: Source;
  phrasings: Phrasing[];
  /** Your messages left out for running over MAX_PHRASING_LENGTH characters. */
  skipped: number;
};

/** The longest phrasing, in characters, that's read and uploaded. */
export const MAX_PHRASING_LENGTH = 2000;

/** An export the reader can't use. Its message names the field, never your words. */
export class ExportError extends Error {
  override name = "ExportError";
}

/** Reads an export: a zip or a conversations.json, as a File or Blob, its bytes, or its text. */
export async function readExport(input: Blob | ArrayBuffer | Uint8Array | string): Promise<ReadExport> {
  if (typeof input === "string") return readConversations(parse(input, "The export", "The export isn't valid JSON."));
  const file = input instanceof Blob ? input : new Blob([input as BlobPart]);
  const head = await bytes(file, 0, 2);
  if (head[0] !== 0x50 || head[1] !== 0x4b) return readConversations(parse(await file.text(), "The file", "The file is neither a zip nor JSON."));
  const conversations = await fromZip(file, true);
  if (!conversations) {
    throw new ExportError("There's no conversations.json in this zip. Choose the zip your chatbot emailed you, or the conversations.json inside it.");
  }
  return readConversations(conversations);
}

// JSON.

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

/** The conversations in a file's text: a list, or now and then an object holding one. */
function parse(text: string, what: string, notJson = `${what} isn't valid JSON.`): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new ExportError(notJson);
  }
  if (Array.isArray(data)) return data;
  if (isObject(data) && Array.isArray(data.conversations)) return data.conversations;
  throw new ExportError(`${what} should be a list of conversations.`);
}

type Take = (sourceId: string, text: string, ms: number) => void;

function readConversations(conversations: unknown[]): ReadExport {
  const [first] = conversations;
  if (first === undefined) throw new ExportError("The export holds no conversations.");
  if (!isObject(first)) throw new ExportError("Conversation 1 isn't an object.");
  const source: Source | null = "mapping" in first ? "chatgpt" : "chat_messages" in first || ("messages" in first && "uuid" in first) ? "claude" : null;
  if (!source) {
    throw new ExportError("Conversation 1 has neither a mapping, as ChatGPT's do, nor chat_messages, as Claude's do, so this isn't a ChatGPT or Claude export.");
  }
  const read: ReadExport = { source, phrasings: [], skipped: 0 };
  const take: Take = (sourceId, text, ms) => {
    if (text.length > MAX_PHRASING_LENGTH) read.skipped++;
    else read.phrasings.push({ sourceId, text, time: new Date(ms).toISOString() });
  };
  const readOne = source === "chatgpt" ? chatgptConversation : claudeConversation;
  conversations.forEach((conversation, i) => readOne(conversation, `Conversation ${i + 1}`, take));
  return read;
}

/** Unix seconds as milliseconds, or undefined when absent. */
function seconds(value: unknown, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  const ms = typeof value === "number" ? Math.round(value * 1000) : NaN;
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) throw new ExportError(`${field} isn't a time in seconds.`);
  return ms;
}

/** An ISO date as milliseconds, or undefined when absent. */
function date(value: unknown, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) throw new ExportError(`${field} isn't a date.`);
  return ms;
}

// ChatGPT: each conversation is a tree of message nodes; the branch shown is the path from current_node up to the root.

function chatgptConversation(conversation: unknown, where: string, take: Take): void {
  if (!isObject(conversation)) throw new ExportError(`${where} isn't an object.`);
  const { mapping } = conversation;
  if (!isObject(mapping)) throw new ExportError(`${where}: mapping is missing or isn't an object.`);
  const started = seconds(conversation.create_time, `${where}: create_time`);

  for (const id of currentBranch(conversation.current_node, mapping, where)) {
    const at = `${where}, node ${id}`;
    const node = mapping[id];
    if (!isObject(node)) throw new ExportError(`${at} isn't an object.`);
    const { message } = node;
    if (message === null || message === undefined) continue;
    if (!isObject(message)) throw new ExportError(`${at}: message isn't an object.`);
    if (!isObject(message.author) || typeof message.author.role !== "string") throw new ExportError(`${at}: author.role is missing.`);
    if (message.author.role !== "user") continue;
    if (isObject(message.metadata) && message.metadata.is_visually_hidden_from_conversation === true) continue;
    const { content } = message;
    if (!isObject(content)) throw new ExportError(`${at}: content is missing.`);
    // Custom instructions, memory, and the like aren't something you asked.
    if (content.content_type !== undefined && content.content_type !== "text" && content.content_type !== "multimodal_text") continue;
    if (!Array.isArray(content.parts)) throw new ExportError(`${at}: content.parts isn't a list.`);
    const texts: string[] = [];
    for (const part of content.parts) {
      // An object is an image or a file; only your words are kept.
      if (typeof part === "string") texts.push(part);
      else if (!isObject(part)) throw new ExportError(`${at}: a content part is neither text nor an object.`);
    }
    const text = texts.join("\n").trim();
    if (!text) continue;
    // A message with no create_time of its own is dated by its conversation.
    const ms = seconds(message.create_time, `${at}: create_time`) ?? started;
    if (ms === undefined) throw new ExportError(`${at}: create_time is missing, and so is the conversation's.`);
    take(id, text, ms);
  }
}

/** The node ids from the root down to current_node; with no current_node, every node in the export's order. */
function currentBranch(leaf: unknown, mapping: JsonObject, where: string): string[] {
  if (leaf === null || leaf === undefined) return Object.keys(mapping);
  if (typeof leaf !== "string" || !Object.hasOwn(mapping, leaf)) throw new ExportError(`${where}: current_node names a node that isn't in mapping.`);
  const branch: string[] = [];
  const seen = new Set<string>();
  // Up through each node's parent, stopping at the root, a missing parent, or a loop.
  for (let id: unknown = leaf; typeof id === "string" && Object.hasOwn(mapping, id) && !seen.has(id); ) {
    seen.add(id);
    branch.push(id);
    const node = mapping[id];
    id = isObject(node) ? node.parent : undefined;
  }
  return branch.reverse();
}

// Claude: each conversation is a list of messages, already in order.

function claudeConversation(conversation: unknown, where: string, take: Take): void {
  if (!isObject(conversation)) throw new ExportError(`${where} isn't an object.`);
  const messages = conversation.chat_messages ?? conversation.messages;
  if (!Array.isArray(messages)) throw new ExportError(`${where}: chat_messages is missing or isn't a list.`);
  const started = date(conversation.created_at, `${where}: created_at`);

  messages.forEach((message: unknown, j) => {
    const at = `${where}, message ${j + 1}`;
    if (!isObject(message)) throw new ExportError(`${at} isn't an object.`);
    if (typeof message.sender !== "string") throw new ExportError(`${at}: sender is missing.`);
    if (message.sender !== "human") return;
    if (typeof message.uuid !== "string" || message.uuid === "") throw new ExportError(`${at}: uuid is missing.`);
    const text = claudeText(message, at);
    if (!text) return;
    const ms = date(message.created_at, `${at}: created_at`) ?? started;
    if (ms === undefined) throw new ExportError(`${at}: created_at is missing, and so is the conversation's.`);
    take(message.uuid, text, ms);
  });
}

/** The flat text, or else the text blocks of its content; attachments and files stay behind. */
function claudeText(message: JsonObject, at: string): string {
  if (message.text !== undefined && message.text !== null && typeof message.text !== "string") throw new ExportError(`${at}: text isn't text.`);
  const flat = (message.text ?? "").trim();
  if (flat) return flat;
  if (message.content === undefined || message.content === null) return "";
  if (!Array.isArray(message.content)) throw new ExportError(`${at}: content isn't a list.`);
  const texts: string[] = [];
  for (const block of message.content) {
    if (!isObject(block)) throw new ExportError(`${at}: a content block isn't an object.`);
    if (block.type === "text" && typeof block.text === "string") texts.push(block.text);
  }
  return texts.join("\n").trim();
}

// Zips, read from the central directory at their end, so only the entries wanted are ever read.

/** conversations.json, or a shard, conversations-000.json and on; never shared_conversations.json. */
const CONVERSATIONS = /(^|\/)conversations(-\d+)?\.json$/;
const ZIP = /\.zip$/i;

const DAMAGED = "This zip can't be read: it's damaged, or it was cut short while downloading.";

type Entry = { name: string; flags: number; method: number; size: number; offset: number };

async function bytes(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

const view = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** The conversations in a zip's own files or, at the top, in a zip inside it; null when there are none. */
async function fromZip(zip: Blob, top: boolean): Promise<unknown[] | null> {
  const entries = await directory(zip);
  const byName = (a: Entry, b: Entry) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const files = entries.filter((e) => CONVERSATIONS.test(e.name)).sort(byName);
  if (files.length) {
    const conversations: unknown[] = [];
    for (const file of files) for (const conversation of parse(await (await unpack(zip, file)).text(), file.name)) conversations.push(conversation);
    return conversations;
  }
  if (!top) return null;
  // The privacy portal wraps the shards in an inner zip.
  for (const inner of entries.filter((e) => ZIP.test(e.name)).sort(byName)) {
    const found = await fromZip(await unpack(zip, inner), false);
    if (found) return found;
  }
  return null;
}

/** The zip's entries, from its central directory (Zip64 too). */
async function directory(zip: Blob): Promise<Entry[]> {
  const tailStart = Math.max(0, zip.size - (22 + 0xffff));
  const tail = await bytes(zip, tailStart, zip.size);
  const t = view(tail);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (t.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ExportError(DAMAGED);
  let size = t.getUint32(end + 12, true);
  let start = t.getUint32(end + 16, true);
  if (size === 0xffffffff || start === 0xffffffff || t.getUint16(end + 10, true) === 0xffff) {
    const locator = end - 20;
    if (locator < 0 || t.getUint32(locator, true) !== 0x07064b50) throw new ExportError(DAMAGED);
    const at = Number(t.getBigUint64(locator + 8, true));
    const record = view(await bytes(zip, at, at + 56));
    if (record.byteLength < 56 || record.getUint32(0, true) !== 0x06064b50) throw new ExportError(DAMAGED);
    size = Number(record.getBigUint64(40, true));
    start = Number(record.getBigUint64(48, true));
  }
  const listing = await bytes(zip, start, start + size);
  if (listing.length < size) throw new ExportError(DAMAGED);
  const d = view(listing);
  const names = new TextDecoder();
  const entries: Entry[] = [];
  for (let i = 0; i + 46 <= listing.length && d.getUint32(i, true) === 0x02014b50; ) {
    const nameLength = d.getUint16(i + 28, true);
    const extraLength = d.getUint16(i + 30, true);
    const entry: Entry = {
      name: names.decode(listing.subarray(i + 46, i + 46 + nameLength)),
      flags: d.getUint16(i + 8, true),
      method: d.getUint16(i + 10, true),
      size: d.getUint32(i + 20, true),
      offset: d.getUint32(i + 42, true),
    };
    // Zip64 keeps a large entry's sizes and offset in its extra field, in this order, for each one marked 0xffffffff.
    const uncompressed = d.getUint32(i + 24, true);
    for (let e = i + 46 + nameLength, stop = e + extraLength; e + 4 <= stop; e += 4 + d.getUint16(e + 2, true)) {
      if (d.getUint16(e, true) !== 0x0001) continue;
      let p = e + 4;
      if (uncompressed === 0xffffffff) p += 8;
      if (entry.size === 0xffffffff) (entry.size = Number(d.getBigUint64(p, true))), (p += 8);
      if (entry.offset === 0xffffffff) entry.offset = Number(d.getBigUint64(p, true));
    }
    entries.push(entry);
    i += 46 + nameLength + extraLength + d.getUint16(i + 32, true);
  }
  return entries;
}

/** One entry's contents, inflated chunk by chunk as they're read. */
async function unpack(zip: Blob, entry: Entry): Promise<Blob> {
  const local = await bytes(zip, entry.offset, entry.offset + 30);
  if (local.length < 30 || view(local).getUint32(0, true) !== 0x04034b50) throw new ExportError(DAMAGED);
  if (entry.flags & 1) throw new ExportError(`${entry.name} in this zip is encrypted, so it can't be read.`);
  const start = entry.offset + 30 + view(local).getUint16(26, true) + view(local).getUint16(28, true);
  const data = zip.slice(start, start + entry.size);
  if (data.size < entry.size) throw new ExportError(DAMAGED);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new ExportError(`${entry.name} in this zip is packed in a way this reader can't unpack.`);

  const out: Uint8Array[] = [];
  const inflater = new Inflate((chunk) => out.push(chunk));
  const reader = data.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      inflater.push(value);
    }
    inflater.push(new Uint8Array(0), true);
  } catch {
    throw new ExportError(`${entry.name} in this zip is damaged, so it can't be unpacked.`);
  }
  return new Blob(out as BlobPart[]);
}
