// The one Anthropic client, shared by the three routes. Every request is a
// structured output from claude-haiku-5-5 with effort set explicitly. A route
// lets a ModelError propagate; server.ts answers it with 502 { error }.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = "claude-haiku-5-5";

export type Effort = NonNullable<Anthropic.OutputConfig["effort"]>;
/**
 * The default effort. A route that tunes its own on the demo export passes it
 * to askStructured instead (spec.md, Decisions and Open Issues).
 */
export const EFFORT: Effort = "medium";

/** A request that gave no usable result. Its message is safe to show and holds no message text. */
export class ModelError extends Error {
  override name = "ModelError";
}

let client: Anthropic | undefined;

export async function askStructured<S extends z.ZodType>(
  system: string,
  userText: string,
  schema: S,
  effort: Effort = EFFORT,
): Promise<z.infer<S>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ModelError("The server has no ANTHROPIC_API_KEY. Set it in .env, as the README says.");
  }
  client ??= new Anthropic();
  const format = zodOutputFormat(schema);

  // messages.create, not messages.parse: parse() reads the text before the
  // stop reason can be checked, so an answer cut off mid-JSON would read as
  // unparseable instead of cut off.
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: userText }],
      output_config: { effort, format },
    });
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
