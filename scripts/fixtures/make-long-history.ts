// Writes long-history.json: a made-up, labeled chat history of one imagined
// learner, for check:sort-recall (m1kuorg/basics#56). Claude writes it, so
// no real person's messages are in it, and the file says so. Each skill
// lists the messages that ask how to do it, worded as differently as a
// person would; one-offs are asked once each, some near a skill's topic.
// The committed file is one run of this, relabeled by hand by the rules
// below; rerunning it writes a new history, which needs the same pass, and
// the recall the check measures moves with it.
// Run: bun run scripts/fixtures/make-long-history.ts
//
// The labels follow GLOSSARY.md's Skill and the sort's prompt
// (server/sort.ts), by these rules, applied to every phrasing; the
// phrasings themselves are the run's own (m1kuorg/basics#56):
// 1. A skill is one task someone would learn once to stop asking, named the
//    way a reference book titles its entry: a verb and what it acts on,
//    such as "Undo a git commit".
// 2. A task's variants are part of it: doing it in other circumstances or
//    with other options, choosing between ways to do it, the errors and
//    surprises it throws, and putting it right when it went wrong. Lifting
//    state up and React context are two ways to share state between React
//    components, so they are one skill.
// 3. A broad goal that takes several tasks is not a skill: each phrasing
//    goes to the task it asks about. Preparing for a technical interview
//    splits into what to study, thinking aloud while live coding,
//    practicing problems, and how polished a take-home should be; how long
//    cooked chicken keeps is storing leftovers, not planning meal prep
//    lunches.
// 4. Phrasings that share only a topic or a tool but ask how to do
//    different tasks are different skills: renaming a branch and deleting
//    one, paginating an API and loading the next page in an infinite
//    scroll, a first Jest test and a test of a React component.
// 5. A question about a concept, a fact, or whether something is worth it
//    asks a task of its own; it joins a skill only when that skill's entry
//    would answer it.
// 6. The test for a phrasing in doubt: would someone who had learned the
//    skill, with its variants, still need to ask it? If so, it asks another
//    task.
// 7. A skill needs two phrasings or more. A phrasing alone in its task is a
//    one-off, and one-offs that ask the same task as each other, or as a
//    skill, are labeled with it.
// A second model, Claude Sonnet, reviewed 171 of the labels against these
// rules and agreed with 170; the one it didn't, Prettier's format on save in
// VS Code, became a one-off.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { join } from "node:path";
import { z } from "zod";

const History = z.object({
  skills: z.array(z.object({ name: z.string(), messages: z.array(z.string()) })),
  oneOffs: z.array(z.string()),
});

const PROMPT = `Write the realistic chatbot history of one person: a bootcamp graduate who became a junior web developer, over 18 months, asking a chatbot about code, tools, career, and everyday life.

Return JSON with:
- "skills": 70 recurring skills. Each is one task the person asked how to do more than once, with "name" (titled like a reference book entry, such as "Undo a git commit") and "messages": 2 to 9 of their own messages asking how to do it, as they'd really type them. Vary the wording hard between messages of one skill: different circumstances, error messages pasted in, typos, lowercase, frustration, asking which option to use, a short code snippet. Spread the counts: many skills with 2 or 3 messages, a few with 7 to 9.
- Make at least 20 of the skills near misses of each other: they share a topic or a tool but are different tasks (such as "Undo a git commit" and "Rename a git branch", or "Center an element with CSS" and "Make a CSS grid responsive"), so a careless sorter would merge them.
- "oneOffs": 260 messages each asked only once, on any subject (code, tools, career, cooking, travel, money, health), some of them sharing a topic or tool with a skill but asking a different task.

Every message is the person's own words, 5 to 60 words, never the chatbot's.`;

const NOTE =
  "Made-up data: one imagined learner's chat history, written by Claude (claude-opus-5-5) through scripts/fixtures/make-long-history.ts, for check:sort-recall. No real person wrote these messages. Each skill lists the messages that ask how to do it; oneOffs are asked once each.";

const message = await new Anthropic().messages
  .stream({
    model: "claude-opus-5-5",
    max_tokens: 64000,
    output_config: { effort: "medium", format: zodOutputFormat(History) },
    messages: [{ role: "user", content: PROMPT }],
  })
  .finalMessage();
if (message.stop_reason !== "end_turn") throw new Error(`The history stopped early: ${message.stop_reason}`);
const history = History.parse(JSON.parse(message.content.find((b) => b.type === "text")!.text));
await Bun.write(join(import.meta.dir, "long-history.json"), JSON.stringify({ note: NOTE, ...history }, null, 2) + "\n");
console.log(`${history.skills.length} skills of ${history.skills.reduce((n, s) => n + s.messages.length, 0)} messages, and ${history.oneOffs.length} one-offs`);
