// POST /api/rep. Writes a cold rep for one card: always a fresh problem of
// the card's skill, plus the lesson when the page asks for it (the card's
// first rep). It logs nothing; a ModelError propagates to server.ts.

import { z } from "zod";
import type { RepRequest, RepResponse } from "../../src/types";
import { askStructured, type Effort } from "../model";

/** Tuned on the demo skill with `bun run scripts/check-rep-routes.ts` (m1kuorg/basics#27). */
export const REP_EFFORT: Effort = "medium";

const Body = z.strictObject({
  skill: z.string().trim().min(1),
  phrasings: z.array(z.string().trim().min(1)).min(1),
  earlierProblems: z.array(z.string()),
  withLesson: z.boolean(),
}) satisfies z.ZodType<RepRequest>;

const Problem = z
  .string()
  .min(1)
  .describe("The new problem: a concrete situation, written to the learner as you, ending by asking what they would do.");
const Lesson = z
  .string()
  .min(1)
  .describe("The lesson: the skill's general method and how to choose between its common cases, in plain text.");
const WithLesson = z.object({ lesson: Lesson, problem: Problem });
const ProblemOnly = z.object({ problem: Problem });

const SYSTEM = `You write cold reps for Asked Before, an app for someone who keeps asking a chatbot the same question. Each card is one skill they asked about again and again. A cold rep is a fresh problem of that skill, which they answer on their own, without AI, in one plain text box.

You get the skill, their own past phrasings of the question, and the problems this card has already had.

Write one new problem:
- A concrete, everyday situation where they need the skill, written to them as "you", ending by asking what they would do: the commands or steps, and nothing more. Never ask for an explanation, the output, a message to type, or what things look like afterwards. One to three sentences, under 60 words.
- Its goal is the skill itself, as its name says, not a neighbouring task that needs other knowledge. Keep to the skill's common, standard cases, solvable with the usual tools in a few lines of plain text, with one clearly right approach.
- Make it a new scenario, in your own words. Don't reword, quote, or borrow wording from any of their phrasings, and don't repeat or closely echo an earlier problem: when there are earlier problems, pick a case of the skill they haven't covered, one with a different right answer where the skill has one.
- Don't give the answer away: they must come up with the method themselves. Say only the situation and the result they want, as they would see it (their files, their branch, their teammates' copies), never what the fix does or how it works: no commands, functions, flags, or steps, nothing like "use X" or "try X", and nothing like "a new commit that cancels it out" or "move the branch back".

When asked for a lesson, write that too: a short explanation of the skill as a whole, three or four sentences and at most 80 words, that teaches the general method, naming the actual commands, functions, or tools, and how to choose between its common cases, so it helps with any problem on this skill. Don't mention this problem's scenario.

Plain text only, in both: no Markdown, lists, headings, or code fences. Write commands inline.`;

export async function rep(request: Request): Promise<Response> {
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) {
    return Response.json(
      { error: "A rep needs { skill, phrasings, earlierProblems, withLesson } and nothing else, with a skill and at least one phrasing." },
      { status: 400 },
    );
  }
  const { skill, phrasings, earlierProblems, withLesson } = body.data;
  const userText = `${JSON.stringify({ skill, phrasings, earlierProblems }, null, 2)}

${withLesson ? "Write the lesson and the first problem." : "Write the next problem only."}`;

  const result: RepResponse = await askStructured(SYSTEM, userText, withLesson ? WithLesson : ProblemOnly, REP_EFFORT);
  return Response.json(result);
}
