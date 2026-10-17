// A stand-in for the Anthropic API, for the checks that read or steer what
// the app sends the model. Start the app with
// startApp({ ANTHROPIC_BASE_URL: model.url }): the Anthropic SDK reads that
// variable, so nothing in the app changes. Every request is recorded, then
// answered by the next queued answer, or else by the stub's default:
// forwarded to the real API with the app's own key (as check:sort does),
// or answered here (as the checks that only need a sort to finish do).
//
//   const model = await startModelStub(forward);
//   model.queue(refuse());                 // the next request fails
//   const held = hold(); model.queue(held.answer);
//   await held.reached; ... held.release(); // answered by `then`, forward by default

export type ModelRequest = {
  /** The request body, as the app sent it. */
  body: { system?: string; messages: { role: string; content: string }[]; output_config?: { effort?: string } };
  /** The system prompt and the first user message's text. */
  system: string;
  user: string;
};

/** How one request is answered. */
export type Answer = (request: ModelRequest, raw: Request, body: string) => Response | Promise<Response>;

export type ModelStub = {
  url: string;
  /** Every request so far, in the order they arrived. */
  requests: ModelRequest[];
  /** Answers the next request not yet answered with `answer`; queued answers go in order. */
  queue: (...answers: Answer[]) => void;
  /** Resolves once `count` requests have arrived. */
  arrived: (count: number, timeoutMs?: number) => Promise<void>;
  stop: () => void;
};

const API = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

/** Sends the request on to the real API, with the app's own headers and key. */
export const forward: Answer = async (_request, raw, body) => {
  const url = new URL(raw.url);
  const headers = new Headers(raw.headers);
  for (const name of ["host", "content-length", "accept-encoding", "connection"]) headers.delete(name);
  const response = await fetch(new URL(url.pathname + url.search, API), { method: raw.method, headers, body });
  // Bun has already decoded the body, so only the type goes back with it.
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
};

/** A finished message whose text is `result` as JSON: the structured output the app asked for, streamed when the app streams. */
export const reply =
  (result: object | ((request: ModelRequest) => object)): Answer =>
  (request) => {
    const text = JSON.stringify(typeof result === "function" ? result(request) : result);
    const usage = { input_tokens: 0, output_tokens: 0 };
    const message = { id: "msg_stub", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_sequence: null };
    if (!(request.body as { stream?: boolean }).stream) {
      return Response.json({ ...message, content: [{ type: "text", text }], stop_reason: "end_turn", usage });
    }
    const events = [
      { type: "message_start", message: { ...message, content: [], stop_reason: null, usage } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } },
      { type: "message_stop" },
    ];
    const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };

/** An API error the SDK doesn't retry. The app reports it as "The model request failed (<status>)." */
export const refuse =
  (status = 400): Answer =>
  () =>
    Response.json({ type: "error", error: { type: "invalid_request_error", message: "Refused by the check's model stub." } }, { status, headers: { "x-should-retry": "false" } });

/** Holds a request unanswered until `release()`, which answers it with `then` (forward by default). */
export function hold(): { answer: Answer; reached: Promise<void>; release: (then?: Answer) => void } {
  let arrive = () => {};
  const reached = new Promise<void>((resolve) => (arrive = resolve));
  let letGo: (then: Answer) => void = () => {};
  const released = new Promise<Answer>((resolve) => (letGo = resolve));
  return {
    reached,
    release: (then = forward) => letGo(then),
    answer: async (request, raw, body) => {
      arrive();
      return (await released)(request, raw, body);
    },
  };
}

/** The sort request's JSON: the cards and phrasings it sends, before any note added on a retry. */
export function sortRequest(request: ModelRequest): {
  cards: { id: string; skill: string; samples: string[] }[];
  phrasings: { id: string; text: string }[];
  note: string;
} {
  const [json, ...rest] = request.user.split("\n\n");
  return { ...JSON.parse(json!), note: rest.join("\n\n") };
}

export async function startModelStub(otherwise: Answer): Promise<ModelStub> {
  const requests: ModelRequest[] = [];
  const queued: Answer[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (raw) => {
      const body = await raw.text();
      const parsed = JSON.parse(body) as ModelRequest["body"];
      const first = parsed.messages[0]?.content;
      const request = { body: parsed, system: parsed.system ?? "", user: typeof first === "string" ? first : JSON.stringify(first) };
      requests.push(request);
      return (queued.shift() ?? otherwise)(request, raw, body);
    },
  });
  return {
    url: server.url.origin,
    requests,
    queue: (...answers) => queued.push(...answers),
    arrived: async (count, timeoutMs = 60_000) => {
      const deadline = Date.now() + timeoutMs;
      while (requests.length < count) {
        if (Date.now() > deadline) throw new Error(`waited ${timeoutMs / 1000}s for model request ${count}; ${requests.length} arrived`);
        await Bun.sleep(25);
      }
    },
    stop: () => void server.stop(true),
  };
}
