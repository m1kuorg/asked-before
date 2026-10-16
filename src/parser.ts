// Reads a chat export in the conversations.json shape (TRD.md, Export format)
// into your own messages. It fails loudly on any shape it doesn't recognize,
// and its errors name the field, never the message text.

import type { Message } from "./types";

export class ExportError extends Error {
  override name = "ExportError";
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseExport(text: string): Message[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ExportError("The chat export isn't valid JSON.");
  }
  if (!Array.isArray(data)) {
    throw new ExportError("The chat export should be a list of conversations.");
  }

  const messages: Message[] = [];
  data.forEach((conversation, index) => {
    const where = `Conversation ${index + 1}`;
    if (!isObject(conversation)) throw new ExportError(`${where} isn't an object.`);

    const conversationId = conversation.conversation_id ?? conversation.id;
    if (typeof conversationId !== "string") {
      throw new ExportError(`${where} has no conversation_id or id.`);
    }
    const conversationTime = conversation.create_time;
    if (typeof conversationTime !== "number" || !Number.isFinite(conversationTime)) {
      throw new ExportError(`${where}: create_time isn't a number.`);
    }
    if (!isObject(conversation.mapping)) {
      throw new ExportError(`${where}: mapping is missing or isn't an object.`);
    }

    for (const [nodeId, node] of Object.entries(conversation.mapping)) {
      const at = `${where}, node ${nodeId}`;
      if (!isObject(node)) throw new ExportError(`${at} isn't an object.`);
      const message = node.message;
      if (message === null || message === undefined) continue;
      if (!isObject(message)) throw new ExportError(`${at}: message isn't an object.`);
      if (!isObject(message.author) || typeof message.author.role !== "string") {
        throw new ExportError(`${at}: author.role is missing.`);
      }
      if (message.author.role !== "user") continue;

      if (!isObject(message.content) || !Array.isArray(message.content.parts)) {
        throw new ExportError(`${at}: content.parts isn't a list.`);
      }
      const texts: string[] = [];
      for (const part of message.content.parts) {
        if (typeof part === "string") texts.push(part);
        else if (!isObject(part)) throw new ExportError(`${at}: a content part is neither text nor an object.`);
      }
      const joined = texts.join("\n").trim();
      if (joined === "") continue;

      // A message with no create_time takes its conversation's.
      const own = message.create_time;
      let time = conversationTime;
      if (typeof own === "number" && Number.isFinite(own)) time = own;
      else if (own !== null && own !== undefined) {
        throw new ExportError(`${at}: create_time isn't a number.`);
      }

      messages.push({ id: `m${messages.length + 1}`, conversationId, text: joined, time });
    }
  });
  return messages;
}
