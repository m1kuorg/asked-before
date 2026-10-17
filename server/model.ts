// The one Anthropic client, shared by every route that asks the model. Every
// request is a structured output from claude-haiku-5-5 with effort set
// explicitly. A request made for an account first spends one of its daily
// model requests (store/usage.ts), or fails with 429. A route lets a
// ModelError propagate; serve() answers it with 502 { error }. Requests are
// streamed, so a long answer (a sort batch of hundreds of phrasings) has
// room to finish; only the final message is read.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { HttpError } from "./http";
import { spendModelRequest } from "./store/usage";

export const MODEL = "claude-haiku-5-5";
/**
 * Room for the answer and the thinking before it. A sort batch of 300 to
 * 600 phrasings at medium effort has taken up to 20,000 output tokens
 * (m1kuorg/basics#44), past the 16,000 an unstreamed request could hold.
 */
const MAX_TOKENS = 64000;

export type Effort = NonNullable<Anthropic.OutputConfig["effort"]>;
/**
 * The default effort. A route that tunes its own on the demo export passes it
 * to askStructured instead (spec.md, Decisions and Open Issues).
 */
export const EFFORT: Effort = "medium";

/** A request that gave no usable result. Its message is safe to show and holds no message text. */
export class ModelError extends HttpError {
  override name = "ModelError";
  constructor(message: string) {
    super(502, message);
  }
}

let client: Anthropic | undefined;

export async function askStructured<S extends z.ZodType>(
  system: string,
  userText: string,
  schema: S,
  effort: Effort = EFFORT,
  /** The account the request is for. The proof of concept's routes have none. */
  userId?: string,
): Promise<z.infer<S>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ModelError("The server has no ANTHROPIC_API_KEY. Set it in .env, as the README says.");
  }
  if (userId) spendModelRequest(userId);
  client ??= new Anthropic();
  const format = zodOutputFormat(schema);

  // The stream is sent the schema without its parse(): the stream helper
  // would parse the text before the stop reason can be checked, so an answer
  // cut off mid-JSON would read as unparseable instead of cut off.
  let response;
  try {
    response = await client.messages
      .stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: userText }],
        output_config: { effort, format: { type: format.type, schema: format.schema } },
      })
      .finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionError) throw new ModelError("The model couldn't be reached.");
    if (error instanceof Anthropic.APIError) throw new ModelError(`The model request failed (${error.status}).`);
    throw new ModelError("The model request failed.");
  }
  if (response.stop_reason === "refusal") throw new ModelError("The model declined to answer.");
  if (response.stop_reason === "max_tokens") throw new ModelError("The model's answer was cut off.");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (text === undefined) throw new ModelError("The model's answer didn't match the expected shape.");
  try {
    return format.parse(text);
  } catch {
    throw new ModelError("The model's answer couldn't be read.");
  }
}
