// The stdio MCP server (m1kuorg/basics#50): tools for an agent to list the
// learner's shelves and cards, record a question as a capture, and run a
// cold rep in the chat, on the official MCP SDK (v2, app-notes/mcp-sdk.md)
// and @asked-before/sdk. It's configured by its environment (connect.ts):
// the Asked Before server's URL, an API key, and optionally a default
// shelf, by name or id, for calls that name none. Each tool answers with
// a text for the agent and the same facts as structured content; a failure
// is a tool error carrying Asked Before's message. Nothing goes to stdout
// but the protocol.

import { ApiError, createClient, MAX_PHRASING_LENGTH, type Card, type CardStatus, type Shelf } from "@asked-before/sdk";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { STATUS_WORDS } from "../../../src/lib/copy";
import { MCP_ENV, SERVER_NAME } from "./connect";

const baseUrl = process.env[MCP_ENV.url]?.trim();
const apiKey = process.env[MCP_ENV.apiKey]?.trim();
const defaultShelf = process.env[MCP_ENV.shelf]?.trim() || null;
if (!baseUrl || !apiKey) {
  console.error(`Asked Before's MCP server needs ${MCP_ENV.url}, your Asked Before server's address, and ${MCP_ENV.apiKey}, a key from its Settings page.`);
  process.exit(1);
}
const api = createClient({ baseUrl, apiKey });

const INSTRUCTIONS = `Asked Before keeps the learner's library cards. A card is one skill they asked a chatbot how to do more than once, such as "Undo a git commit", and its count is how many times they asked. A card is To prove until they pass a cold rep on it, a fresh problem of its skill answered without AI, which marks it Proven; once they ask it again after that, it's Asked since proven, and needs a fresh cold rep.

When the learner asks you how to do something, record their question with record_question, in their own words: only what they wrote, never your answer, their code, or secrets. If it lands on a card they asked before, tell them how many times they've asked it and offer a cold rep. During a cold rep, show the problem as written, give no hints and no answer, and pass their answer to check_answer exactly as they wrote it.`;

/** A card as a tool gives it: the SDK's Card, less its shelf's id, which the tool gives once. */
type CardOutput = Omit<Card, "shelfId">;
const CardOut = z.object({
  id: z.string(),
  skill: z.string(),
  status: z.enum(Object.keys(STATUS_WORDS) as [CardStatus, ...CardStatus[]]),
  count: z.number(),
  firstBorrowAt: z.string(),
  lastBorrowAt: z.string(),
  returnedAt: z.string().nullable(),
}) satisfies z.ZodType<CardOutput>;
const ShelfRef = z.object({ id: z.string(), name: z.string() });
const ShelfArg = z
  .string()
  .min(1)
  .optional()
  .describe(`The shelf's name or id. Leave it out for the default shelf${defaultShelf ? `, ${defaultShelf}` : ""}.`);

const day = (iso: string) => iso.slice(0, 10);
const times = (n: number) => (n === 1 ? "once" : `${n} times`);
/** A card's status in the app's words, with the day it was proven once it has been. */
const status = (card: Card) =>
  card.status === "returned" ? `${STATUS_WORDS.returned} ${day(card.returnedAt!)}` : card.status === "borrowed_again" ? `${STATUS_WORDS.borrowed_again} (proven ${day(card.returnedAt!)})` : STATUS_WORDS.borrowed;
const cardLine = (card: Card) => `"${card.skill}": asked ${times(card.count)}, first ${day(card.firstBorrowAt)}, last ${day(card.lastBorrowAt)}; ${status(card)}. Card id ${card.id}.`;
const cardOut = ({ shelfId, ...card }: Card): CardOutput => card;
const shelfRef = ({ id, name }: Shelf) => ({ id, name });

/** A tool's answer: a text for the agent, and the same facts as structured content. */
const toolResult = <T extends Record<string, unknown>>(text: string, structuredContent: T) => ({ content: [{ type: "text" as const, text }], structuredContent });

/** Calls Asked Before; a failure becomes a tool error with its message. */
async function callApi<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error(`${error.message} Check ${MCP_ENV.apiKey}, or make a new key in Asked Before's Settings.`);
    if (error instanceof ApiError) throw new Error(error.message);
    throw new Error(`Asked Before couldn't be reached at ${baseUrl}.`);
  }
}

const listNames = (shelves: Shelf[]) => (shelves.length ? shelves.map((p) => `"${p.name}"`).join(", ") : "none yet");
/** The shelf with the id `wanted`, or else with that name, ignoring case. */
const shelfNamed = (shelves: Shelf[], wanted: string) => shelves.find((p) => p.id === wanted) ?? shelves.find((p) => p.name.toLowerCase() === wanted.toLowerCase());

/** The shelf a call names, by id or name, or else the default one. */
async function shelfFor(given: string | undefined): Promise<Shelf> {
  const shelves = await callApi(() => api.shelves.list());
  const wanted = given?.trim() || defaultShelf;
  if (!wanted) throw new Error(`Say which shelf: the learner's shelves are ${listNames(shelves)}. Or set ${MCP_ENV.shelf} to pick a default.`);
  const found = shelfNamed(shelves, wanted);
  if (!found) throw new Error(`The learner has no shelf "${wanted}". Their shelves are ${listNames(shelves)}.`);
  return found;
}

function build(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_shelves",
    {
      title: "List shelves",
      description:
        "List the learner's Asked Before shelves. A shelf is one named part of their history, such as Work, holding its own cards. Gives each shelf's cards and how many are To prove, Proven, and Asked since proven, and says which is the default shelf. Sends nothing of the learner's.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        shelves: z.array(ShelfRef.extend({ demo: z.boolean(), cards: z.number(), borrowed: z.number(), returned: z.number(), borrowedAgain: z.number() })),
        defaultShelf: ShelfRef.nullable(),
      }),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const shelves = await callApi(() => api.shelves.list());
      const fallback = defaultShelf ? shelfNamed(shelves, defaultShelf) : undefined;
      const lines = shelves.map(
        (p) =>
          `- "${p.name}"${p.demo ? " (demo data)" : ""}: ${p.counts.cards} cards, ${p.counts.borrowed} To prove, ${p.counts.returned} Proven, ${p.counts.borrowedAgain} Asked since proven. Shelf id ${p.id}.`,
      );
      const which = fallback ? `The default shelf is "${fallback.name}".` : "No default shelf is set, so name one in each call.";
      return toolResult(shelves.length ? `The learner's shelves:\n${lines.join("\n")}\n${which}` : "The learner has no shelves yet. They make one in Asked Before.", {
        shelves: shelves.map((p) => ({ ...shelfRef(p), demo: p.demo, ...p.counts })),
        defaultShelf: fallback ? shelfRef(fallback) : null,
      });
    },
  );

  server.registerTool(
    "list_cards",
    {
      title: "List cards",
      description:
        'List a shelf\'s cards, most asked first. A card is one skill the learner asked about more than once, such as "Undo a git commit", and its count is how many times they asked it. A card is To prove until a cold rep on it passes, then Proven, and Asked since proven once they ask it after that. Set not_returned to list only the cards that need a cold rep: To prove, or Asked since proven. Sends nothing of the learner\'s.',
      inputSchema: z.object({
        shelf: ShelfArg,
        not_returned: z.boolean().default(false).describe("Only the cards that need a cold rep: To prove, or Asked since proven."),
      }),
      outputSchema: z.object({ shelf: ShelfRef, cards: z.array(CardOut) }),
      annotations: { readOnlyHint: true },
    },
    async ({ shelf, not_returned }) => {
      const found = await shelfFor(shelf);
      const cards = (await callApi(() => api.cards.list(found.id))).filter((card) => !not_returned || card.status !== "returned");
      const which = not_returned ? "cards that need a cold rep" : "cards";
      const text = cards.length
        ? `"${found.name}" has ${cards.length} ${which}, most asked first:\n${cards.map((card) => `- ${cardLine(card)}`).join("\n")}`
        : `"${found.name}" has no ${which}.`;
      return toolResult(text, { shelf: shelfRef(found), cards: cards.map(cardOut) });
    },
  );

  server.registerTool(
    "record_question",
    {
      title: "Record a question",
      description:
        "Record the learner's how-to question as a capture on one of their shelves, and sort it onto their cards at once. Send only the learner's own words, exactly as they asked: never your answer, their code, file contents, or secrets. Says whether it landed on a card they asked before, with how many times they've asked it and its status, so you can tell them and offer a cold rep; or that it's new, and waits unsorted until they ask the same thing again. The same words again within ten minutes don't count as another ask.",
      inputSchema: z.object({
        question: z.string().min(1).max(MAX_PHRASING_LENGTH).describe("The learner's question, in their own words, word for word."),
        shelf: ShelfArg,
      }),
      outputSchema: z.object({
        shelf: ShelfRef,
        phrasing: z.object({ id: z.string(), text: z.string(), time: z.string() }),
        card: CardOut.nullable(),
        alreadyCaptured: z.boolean(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ question, shelf }) => {
      const found = await shelfFor(shelf);
      const capture = await callApi(() => api.captures.create(found.id, { text: question }));
      const lines = [
        capture.alreadyCaptured
          ? `These words were recorded on the shelf "${found.name}" less than ten minutes ago, so they weren't counted again.`
          : `Recorded on the shelf "${found.name}".`,
        capture.card
          ? `It's on the card ${cardLine(capture.card)} Tell the learner they've asked this before, and offer a cold rep on it with start_cold_rep.`
          : "No card asks this yet, so it waits unsorted until the learner asks the same thing again.",
      ];
      const { id, text, time } = capture.phrasing;
      return toolResult(lines.join(" "), { shelf: shelfRef(found), phrasing: { id, text, time }, card: capture.card && cardOut(capture.card), alreadyCaptured: capture.alreadyCaptured });
    },
  );

  server.registerTool(
    "start_cold_rep",
    {
      title: "Start a cold rep",
      description:
        "Start a cold rep on a card: a fresh problem of its skill, for the learner to answer without AI. Gives the problem, and the card's lesson on its first cold rep or after a failed one. Show the learner the lesson and the problem as written. Don't hint, explain, or answer the problem, and don't help with it: wait for the learner's own answer, then pass it to check_answer. Sends nothing of the learner's.",
      inputSchema: z.object({ card_id: z.string().min(1).describe("The card's id, from list_cards or record_question.") }),
      outputSchema: z.object({ repId: z.string(), problem: z.string(), lesson: z.string().nullable() }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ card_id }) => {
      const { rep, lesson } = await callApi(() => api.reps.start(card_id));
      const text = [
        lesson ? `Lesson:\n${lesson}` : "",
        `Problem:\n${rep.problem}`,
        `Show the learner ${lesson ? "the lesson and " : ""}the problem as written, with no hints. When they answer, pass their answer as they wrote it to check_answer, with rep id ${rep.id}.`,
      ];
      return toolResult(text.filter(Boolean).join("\n\n"), { repId: rep.id, problem: rep.problem, lesson });
    },
  );

  server.registerTool(
    "check_answer",
    {
      title: "Check an answer",
      description:
        "Check the learner's answer to a cold rep; each cold rep is checked once. Send only the learner's own answer, exactly as they wrote it: never your own, a corrected one, or added hints. Gives the verdict, pass or fail, with the reason, and the card's status: a pass marks the card Proven. After a fail, a new cold rep on the card brings a different problem and the lesson again.",
      inputSchema: z.object({
        rep_id: z.string().min(1).describe("The cold rep's id, from start_cold_rep."),
        answer: z.string().min(1).describe("The learner's own answer, word for word."),
      }),
      outputSchema: z.object({ verdict: z.enum(["pass", "fail"]), reason: z.string(), card: CardOut }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ rep_id, answer }) => {
      const { rep, card } = await callApi(() => api.reps.check(rep_id, { answer }));
      const verdict = rep.verdict!;
      const text =
        verdict === "pass"
          ? `Passed. ${rep.reason} The card "${card.skill}" is Proven, stamped ${day(card.returnedAt!)}.`
          : `Not passed. ${rep.reason} The card "${card.skill}" is still ${STATUS_WORDS[card.status]}. Another cold rep on it brings a different problem and the lesson again.`;
      return toolResult(text, { verdict, reason: rep.reason!, card: cardOut(card) });
    },
  );

  return server;
}

serveStdio(build);
