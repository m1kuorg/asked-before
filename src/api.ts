// The group request's body, as the proof of concept's stack sent it; the
// grouping check (scripts/check-grouping.ts) sends it until m1kuorg/basics#44
// replaces that check. The page itself reaches the server only through the SDK.

import type { GroupRequest, Message } from "./types";

/** The group request: your message ids and texts, and nothing else. */
export const toGroupRequest = (messages: Message[]): GroupRequest => ({
  messages: messages.map(({ id, text }) => ({ id, text })),
});
