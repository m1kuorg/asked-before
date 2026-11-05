// Records real-model cold rep problems on card A, the raw material of
// rep-problems.json (m1kuorg/basics#65 and #67), in check:reps' shape: each
// chain is a fresh demo shelf whose card A has five reps in turn, every one
// written from the card's phrasings and its earlier problems. On every
// problem, both known answers are judged: one through the app, as
// check:reps checks it, and the other by sending the app's own check
// request again with that answer. Each line of the output is one problem,
// with the hidden case the model wrote before it and both verdicts, for
// labeling by hand. The sort is the answer key's stand-in, as in check:reps.
// It needs ANTHROPIC_API_KEY.
// Run: bun run scripts/fixtures/record-rep-problems.ts <chains> <out.jsonl> [at once]

import { phrasings, sortEnds, upload } from "../lib/answer-key";
import { startApp } from "../lib/app";
import { forward, startModelStub, type Answer, type ModelRequest } from "../lib/model-stub";
import { checkRequest, kindOf, known, sortsByKey } from "../lib/reps";

const [chains = 10, out, atOnce = 6] = [Number(process.argv[2] ?? 10), process.argv[3], Number(process.argv[4] ?? 6)];
if (!out || !process.env.ANTHROPIC_API_KEY) {
  console.error("Usage: bun run scripts/fixtures/record-rep-problems.ts <chains> <out.jsonl> [at once], with ANTHROPIC_API_KEY set.");
  process.exit(1);
}

/** The structured output's text in a streamed answer. */
const streamedText = (sse: string) =>
  sse
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
    .filter((event) => event.type === "content_block_delta" && event.delta.type === "text_delta")
    .map((event) => event.delta.text)
    .join("");

// Forwards to the real model and keeps each rep's hidden case, found again by its problem.
const caseOf = new Map<string, string>();
const keepCase: Answer = async (request, raw, body) => {
  const answered = await forward(request, raw, body);
  if (kindOf(request) !== "rep" || !answered.ok) return answered;
  const text = await answered.text();
  try {
    const { case: hidden, problem } = JSON.parse(streamedText(text));
    caseOf.set(problem, hidden);
  } catch {
    // An unreadable answer fails the rep in the app, which the chain reports.
  }
  return new Response(text, { status: answered.status, headers: answered.headers });
};

/** The app's check request for `problem`, sent again with `answer`, straight to the real model. */
async function judgeAgain(sent: ModelRequest, answer: string): Promise<{ verdict: string; reason: string }> {
  const { skill, problem } = checkRequest(sent);
  const body = { ...sent.body, messages: [{ role: "user", content: JSON.stringify({ skill, problem, answer }, null, 2) }] };
  const response = await fetch(new URL("/v1/messages", process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"), {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": process.env.ANTHROPIC_API_KEY! },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`the check sent again failed (${response.status})`);
  return JSON.parse(streamedText(await response.text()));
}

const model = await startModelStub(sortsByKey(keepCase));
const app = await startApp({ ANTHROPIC_BASE_URL: model.url });
const ada = app.browser();
await ada.client.auth.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical engine" });
const plan = ["wrong", "right", "wrong", "right", "wrong"] as const;
const lines: string[] = [];

async function chain(c: number) {
  const shelf = await ada.client.shelves.create({ name: `Chain ${c}`, demo: true });
  await sortEnds(ada.client, (await upload(ada.client, shelf.id, phrasings, "demo-export.json")).id);
  const [A] = await ada.client.cards.list(shelf.id);
  for (const [i, label] of plan.entries()) {
    const { rep } = await ada.client.reps.start(A!.id);
    const answer = known[label];
    const checked = (await ada.client.reps.check(rep.id, { answer })).rep;
    const sent = model.requests.find((r) => kindOf(r) === "check" && checkRequest(r).problem === rep.problem && checkRequest(r).answer === answer)!;
    const other = label === "wrong" ? "right" : "wrong";
    const again = await judgeAgain(sent, known[other]);
    const verdicts = { [label]: { verdict: checked.verdict, reason: checked.reason }, [other]: again };
    lines.push(JSON.stringify({ chain: c, rep: i + 1, problem: rep.problem, case: caseOf.get(rep.problem) ?? null, right: verdicts.right, wrong: verdicts.wrong }));
    console.log(`chain ${c} rep ${i + 1}: right ${verdicts.right!.verdict}, wrong ${verdicts.wrong!.verdict}`);
  }
}

try {
  let next = 0;
  await Promise.all(
    Array.from({ length: atOnce }, async () => {
      while (next < chains) {
        const c = ++next;
        await chain(c).catch((error) => console.log(`chain ${c} stopped: ${error}`));
      }
    }),
  );
} finally {
  await app.stop();
  model.stop();
  await Bun.write(out, lines.map((line) => `${line}\n`).join(""));
}
console.log(`${lines.length} problems from ${chains} chains, written to ${out}.`);
