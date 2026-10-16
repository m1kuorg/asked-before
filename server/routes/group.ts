// POST /api/group. Asks the model which of your messages ask how to do the
// same thing, and what to call each skill. It sends only ids and texts and
// never asks for counts or dates: the page's card builder checks the answer
// and counts from the messages' timestamps.

import { z } from "zod";
import { MAX_SKILL_NAME } from "../../src/cards";
import type { GroupResponse } from "../../src/types";
import { askStructured, type Effort } from "../model";

/** Tuned on the demo export with `bun run check:grouping` (m1kuorg/basics#28, m1kuorg/basics#30). */
const GROUP_EFFORT: Effort = "medium";

const Body = z.strictObject({
  messages: z.array(z.strictObject({ id: z.string().min(1), text: z.string().min(1) })),
});

const Grouping = z.object({
  skills: z.array(z.object({ name: z.string(), messageIds: z.array(z.string()) })),
});

const SYSTEM = `You read one person's own messages to a chatbot, given as a JSON list of { id, text }, and find the skills they keep asking about.

A skill is one task the person wanted to know how to do, at the level someone would learn it once to stop asking: the task in general, with its variants. Messages that ask how to do the same task belong to the same skill even when they're worded differently, describe different circumstances, or ask which way or option to use for it. Messages that share only a topic or a tool, but ask how to do different tasks, are different skills.

Return only skills that two or more messages ask about. Leave out every message that no other message asks the same thing as. Put each id in at most one skill, and use only the ids you were given.

Name each skill the way a reference book would title its entry on the task: a verb and what it acts on, in sentence case, such as "Undo a git commit". Name the task in general, never one instance of it: use "a" or "an", never "the", "last", "my", or "this", and leave out details such as a specific value. Keep names to ${MAX_SKILL_NAME} characters or fewer, on one line.`;

export async function group(request: Request): Promise<Response> {
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) {
    return Response.json({ error: "The group request needs { messages: [{ id, text }] } and nothing else." }, { status: 400 });
  }
  const { messages } = body.data;
  if (new Set(messages.map((m) => m.id)).size !== messages.length) {
    return Response.json({ error: "The group request names a message id twice." }, { status: 400 });
  }
  if (messages.length === 0) return Response.json({ skills: [] } satisfies GroupResponse);

  const result: GroupResponse = await askStructured(SYSTEM, JSON.stringify(messages), Grouping, GROUP_EFFORT);
  return Response.json(result);
}
