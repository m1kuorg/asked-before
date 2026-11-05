// The cold rep checks' shared pieces (m1kuorg/basics#46): the demo skill's
// known answers (demo/known-answers.json, never served); telling the app's
// model requests apart and reading what a rep or check request sent; the
// model stand-in's answers to them; and a small export holding phrasings
// the demo export doesn't, read by the SDK's reader as the page reads one.
//
//   const model = await startModelStub(sortsByKey());   // sorts as the key does; reps and checks go to the real model
//   model.queue(repReply("A problem.", "A lesson."), verdictReply("fail", "A reason."));

import { readExport, type ReadExport } from "@asked-before/sdk";
import { join } from "node:path";
import { keySorterWith } from "./answer-key";
import { forward, reply, type Answer, type ModelRequest } from "./model-stub";

export const known: { skill: string; wrong: string; right: string } = await Bun.file(join(import.meta.dir, "..", "..", "demo", "known-answers.json")).json();

export type Kind = "sort" | "rep" | "check";

/** Which of the app's model requests this is, by its system prompt. */
export function kindOf(request: ModelRequest): Kind {
  if (request.system.startsWith("You sort ")) return "sort";
  if (request.system.startsWith("You write cold reps")) return "rep";
  if (request.system.startsWith("You check cold reps")) return "check";
  throw new Error("a model request that's neither a sort, a rep, nor a check");
}

const ASKS_LESSON = "Write the lesson and the first problem.";

/** What a rep request sent: the skill, the card's phrasings, its earlier problems, and whether it asked for the lesson. */
export function repRequest(request: ModelRequest): { skill: string; phrasings: string[]; earlierProblems: string[]; withLesson: boolean } {
  const at = request.user.lastIndexOf("\n\n");
  return { ...JSON.parse(request.user.slice(0, at)), withLesson: request.user.slice(at + 2) === ASKS_LESSON };
}

/** What a check request sent: { skill, problem, answer }. */
export const checkRequest = (request: ModelRequest): { skill: string; problem: string; answer: string } => JSON.parse(request.user);

/**
 * The stand-in's answer when nothing is queued: a sort request as the
 * answer key sorts (with `also`, phrasings' words mapped to the key's skill
 * names), and a rep or check request by `otherwise`, the real model unless
 * a check says else.
 */
export const sortsByKey =
  (otherwise: Answer = forward, also = new Map<string, string>()): Answer =>
  (request, raw, body) =>
    (kindOf(request) === "sort" ? reply(keySorterWith(also)) : otherwise)(request, raw, body);

/** A rep request's answer: `problem`, and `lesson` when the request asks for one. */
export const repReply = (problem: string, lesson = "A stand-in's lesson."): Answer =>
  reply((request) => (repRequest(request).withLesson ? { lesson, case: "A stand-in's case.", problem } : { case: "A stand-in's case.", problem }));

/** A check request's answer. */
export const verdictReply = (verdict: "pass" | "fail", reason: string): Answer => reply({ reason, verdict });

/** A streamed answer that stops for `reason` before any usable text: a refusal, or one cut off at max_tokens. */
export const stopped =
  (reason: "refusal" | "max_tokens"): Answer =>
  () => {
    const usage = { input_tokens: 0, output_tokens: 0 };
    const events = [
      { type: "message_start", message: { id: "msg_stub", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [], stop_reason: null, stop_sequence: null, usage } },
      ...(reason === "max_tokens"
        ? [
            { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: '{"case":"' } },
            { type: "content_block_stop", index: 0 },
          ]
        : []),
      { type: "message_delta", delta: { stop_reason: reason, stop_sequence: null }, usage: { output_tokens: 0 } },
      { type: "message_stop" },
    ];
    return new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
  };

/** A small Claude export: one conversation in which you asked each of `asks` at its time, each answered by the chatbot, read by the SDK's reader. */
export function smallExport(asks: { text: string; time: Date }[]): Promise<ReadExport> {
  const at = (time: Date) => time.toISOString();
  const conversation = {
    uuid: `small-${asks[0]!.time.getTime()}`,
    name: "A newer question",
    created_at: at(asks[0]!.time),
    updated_at: at(asks.at(-1)!.time),
    chat_messages: asks.flatMap(({ text, time }, i) => [
      { uuid: `small-${time.getTime()}-${i}-ask`, text, content: [{ type: "text", text }], sender: "human", created_at: at(time), updated_at: at(time) },
      { uuid: `small-${time.getTime()}-${i}-answer`, text: "The chatbot's answer, which never leaves the reader.", sender: "assistant", created_at: at(time), updated_at: at(time) },
    ]),
  };
  return readExport(JSON.stringify([conversation]));
}
