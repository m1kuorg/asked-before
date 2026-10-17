// Writes the export readers' fixtures, here beside it: small exports in
// each format the readers take: a ChatGPT and a Claude conversations.json, a
// ChatGPT zip sharded into numbered files, a ChatGPT zip inside a zip, a
// Claude zip, and a zip with no conversations in it. They hold made-up
// messages only. The readers' check (scripts/check-readers.ts) knows what
// each should yield; run this again only to change them, and update that
// check to match.
// Run: bun packages/sdk/fixtures/make.ts

import { zipSync, strToU8 } from "fflate";
import { join } from "node:path";

const OUT = import.meta.dir;

type Node = { id: string; message: Record<string, unknown> | null; parent: string | null; children: string[] };

/** A ChatGPT conversation's mapping from its nodes, each naming its parent; children are filled in. */
function mapping(nodes: [id: string, parent: string | null, message: Record<string, unknown> | null][]): Record<string, Node> {
  const out: Record<string, Node> = {};
  for (const [id, parent, message] of nodes) out[id] = { id, message: message && { id, ...message }, parent, children: [] };
  for (const [id, parent] of nodes) if (parent) out[parent]!.children.push(id);
  return out;
}

const said = (role: string, parts: unknown[], create_time: number | null, extra: Record<string, unknown> = {}) => ({
  author: { role, name: null, metadata: {} },
  create_time,
  update_time: null,
  content: { content_type: "text", parts },
  status: "finished_successfully",
  end_turn: role === "assistant" ? true : null,
  weight: 1,
  metadata: {},
  recipient: "all",
  ...extra,
});

/** A pasted log of 2,001 characters: over the limit, so the reader skips it. */
const LONG_PASTE = `${"FAIL src/cart.test.ts\n".repeat(90)}${"x".repeat(21)}`;
/** A message of exactly 2,000 characters, which the reader keeps. */
const AT_THE_LIMIT = `how do i read this stack trace ${"a".repeat(2000 - 31)}`;
if (LONG_PASTE.length !== 2001 || AT_THE_LIMIT.length !== 2000) throw new Error("The long fixtures are the wrong length.");

const chatgpt = [
  {
    title: "Rerun failed jest tests",
    create_time: 1760000000.5,
    update_time: 1760000300,
    mapping: mapping([
      ["g1-root", null, null],
      ["g1-system", "g1-root", { ...said("system", [""], null), metadata: { is_visually_hidden_from_conversation: true } }],
      [
        "g1-instructions",
        "g1-system",
        {
          ...said("user", [], null),
          content: { content_type: "user_editable_context", user_profile: "I'm learning to code.", user_instructions: "Be brief." },
          metadata: { is_visually_hidden_from_conversation: true, is_user_system_message: true },
        },
      ],
      ["g1-ask", "g1-instructions", said("user", ["how do i rerun only the failed tests in jest"], 1760000010.25)],
      ["g1-answer", "g1-ask", said("assistant", ["Run `jest --onlyFailures`."], 1760000012)],
      // The learner edited their follow-up: this first version is an abandoned branch.
      ["g1-edited-away", "g1-answer", said("user", ["the abandoned branch's question"], 1760000100)],
      ["g1-edited-answer", "g1-edited-away", said("assistant", ["An answer on the abandoned branch."], 1760000101)],
      [
        "g1-follow-up",
        "g1-answer",
        {
          ...said("user", [{ content_type: "image_asset_pointer", asset_pointer: "sediment://file_screenshot" }, "why does this screenshot show a timeout"], 1760000200),
          content: {
            content_type: "multimodal_text",
            parts: [{ content_type: "image_asset_pointer", asset_pointer: "sediment://file_screenshot" }, "why does this screenshot show a timeout"],
          },
        },
      ],
      ["g1-code", "g1-follow-up", { ...said("assistant", ["print(open('log').read())"], 1760000201), recipient: "python", content: { content_type: "code", text: "print(open('log').read())" } }],
      ["g1-tool", "g1-code", { ...said("tool", [], 1760000202), content: { content_type: "execution_output", text: "Timeout after 5000 ms" } }],
      ["g1-final", "g1-tool", said("assistant", ["The test waits on a promise that never settles."], 1760000203)],
    ]),
    moderation_results: [],
    current_node: "g1-final",
    conversation_id: "g1",
    id: "g1",
    default_model_slug: "gpt-5",
  },
  {
    title: "A pasted log",
    create_time: 1760100000,
    update_time: 1760100400,
    mapping: mapping([
      ["g2-root", null, null],
      ["g2-paste", "g2-root", said("user", [LONG_PASTE], 1760100005)],
      ["g2-paste-answer", "g2-paste", said("assistant", ["Three tests time out."], 1760100006)],
      // No create_time of its own: it's dated by its conversation's.
      ["g2-ask", "g2-paste-answer", said("user", ["how do I re-run just the failing jest tests"], null)],
      ["g2-ask-answer", "g2-ask", said("assistant", ["`jest --onlyFailures` again."], 1760100010)],
      ["g2-long", "g2-ask-answer", said("user", [AT_THE_LIMIT], 1760100300)],
      ["g2-long-answer", "g2-long", said("assistant", ["Read it from the top frame down."], 1760100301)],
    ]),
    current_node: "g2-long-answer",
    conversation_id: "g2",
    id: "g2",
  },
];

const claude = [
  {
    uuid: "c1",
    name: "Rebase help",
    summary: "",
    created_at: "2026-05-01T09:00:00.000000Z",
    updated_at: "2026-05-01T09:10:00.000000Z",
    account: { uuid: "account-1" },
    chat_messages: [
      {
        uuid: "c1-ask",
        text: "how do i squash my last three commits",
        content: [{ type: "text", text: "how do i squash my last three commits", citations: [] }],
        sender: "human",
        created_at: "2026-05-01T09:00:05.123456Z",
        updated_at: "2026-05-01T09:00:05.123456Z",
        attachments: [],
        files: [],
      },
      {
        uuid: "c1-answer",
        text: "Run git rebase -i HEAD~3 and mark the last two as squash.",
        content: [
          { type: "thinking", thinking: "The learner wants interactive rebase." },
          { type: "text", text: "Run git rebase -i HEAD~3 and mark the last two as squash." },
        ],
        sender: "assistant",
        created_at: "2026-05-01T09:00:09.000000Z",
        updated_at: "2026-05-01T09:00:09.000000Z",
        attachments: [],
        files: [],
      },
      {
        // A newer export leaves the flat text empty and puts the words in content blocks. The attachment's contents stay behind.
        uuid: "c1-follow-up",
        text: "",
        content: [{ type: "text", text: "and how do i undo a rebase", citations: [] }],
        sender: "human",
        created_at: "2026-05-01T09:03:00Z",
        updated_at: "2026-05-01T09:03:00Z",
        attachments: [{ file_name: "reflog.txt", file_size: 120, file_type: "text/plain", extracted_content: "the attachment's contents" }],
        files: [],
      },
      {
        uuid: "c1-follow-up-answer",
        text: "",
        content: [
          { type: "tool_use", name: "artifacts", input: { content: "git reset --hard ORIG_HEAD" } },
          { type: "text", text: "Use git reflog to find where you were." },
        ],
        sender: "assistant",
        created_at: "2026-05-01T09:03:04Z",
        updated_at: "2026-05-01T09:03:04Z",
        attachments: [],
        files: [],
      },
    ],
  },
  {
    uuid: "c2",
    name: "",
    created_at: "2026-06-12T14:00:00.000Z",
    updated_at: "2026-06-12T14:20:00.000Z",
    chat_messages: [
      {
        uuid: "c2-paste",
        text: LONG_PASTE,
        content: [{ type: "text", text: LONG_PASTE }],
        sender: "human",
        created_at: "2026-06-12T14:00:01.000Z",
        updated_at: "2026-06-12T14:00:01.000Z",
        attachments: [],
        files: [],
      },
      {
        // Only a file, with no words: nothing to send, and not counted as skipped.
        uuid: "c2-file-only",
        text: "",
        content: [],
        sender: "human",
        created_at: "2026-06-12T14:05:00.000Z",
        updated_at: "2026-06-12T14:05:00.000Z",
        attachments: [],
        files: [{ file_uuid: "file-1", file_name: "screenshot.png", file_kind: "image" }],
      },
      {
        uuid: "c2-ask",
        text: "what does git rebase --onto do",
        content: [{ type: "text", text: "what does git rebase --onto do" }],
        sender: "human",
        created_at: "2026-06-12T14:10:30.5Z",
        updated_at: "2026-06-12T14:10:30.5Z",
        attachments: [],
        files: [],
      },
    ],
  },
];

const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
const write = (name: string, data: Uint8Array) => Bun.write(join(OUT, name), data);
/** The shared_conversations.json trap: its name ends in conversations.json, but it holds only stubs. */
const shared = [{ id: "share-1", conversation_id: "g1", title: "Rerun failed jest tests", is_anonymous: true }];
const IMAGE = new Uint8Array(4096).map((_, i) => (i * 37) % 256);
const MTIME = new Date("2026-10-17T00:00:00Z");

await write("chatgpt.json", json(chatgpt));
await write("claude.json", json(claude));
// The shards are stored out of order, beside the trap, an image, and the other files a ChatGPT zip holds.
await write(
  "chatgpt-sharded.zip",
  zipSync(
    {
      "conversations-001.json": json([chatgpt[1]]),
      "shared_conversations.json": json(shared),
      "conversations-000.json": json([chatgpt[0]]),
      "user.json": json({ id: "user-1", email: "ada@example.com" }),
      "chat.html": strToU8("<html><body>An offline viewer.</body></html>"),
      "dalle-generations": { "file-1.webp": [IMAGE, { level: 0 }] },
    },
    { mtime: MTIME },
  ),
);
const inner = zipSync({ "conversations.json": json(chatgpt) }, { mtime: MTIME });
await write("chatgpt-nested.zip", zipSync({ "Conversations__ada-chatgpt-0001.zip": [inner, { level: 0 }], "user.json": json({ id: "user-1" }) }, { mtime: MTIME }));
await write(
  "claude.zip",
  zipSync({ "conversations.json": json(claude), "users.json": json([{ uuid: "account-1", full_name: "Ada" }]), "projects.json": json([]) }, { mtime: MTIME }),
);
// A zip with no conversations file, only the trap and the account.
await write("no-conversations.zip", zipSync({ "shared_conversations.json": json(shared), "user.json": json({ id: "user-1" }) }, { mtime: MTIME }));
console.log(`Wrote the fixtures to ${OUT}`);
