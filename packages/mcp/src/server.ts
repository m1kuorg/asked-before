// The stdio MCP server (m1kuorg/basics#50): tools for an agent to list the
// learner's projects and cards, record a question as a capture, and run a
// cold rep in the chat, on the official MCP SDK (v2, app-notes/mcp-sdk.md)
// and @asked-before/sdk. It's configured by its environment (connect.ts):
// the Asked Before server's URL, an API key, and optionally a default
// project, by name or id, for calls that name none. Each tool answers with
// a text for the agent and the same facts as structured content; a failure
// is a tool error carrying Asked Before's message. Nothing goes to stdout
// but the protocol.

import { ApiError, createClient, type Card, type Project } from "@asked-before/sdk";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { MCP_ENV, SERVER_NAME } from "./connect";

const baseUrl = process.env[MCP_ENV.url]?.trim();
const apiKey = process.env[MCP_ENV.apiKey]?.trim();
const defaultProject = process.env[MCP_ENV.project]?.trim() || null;
if (!baseUrl || !apiKey) {
  console.error(`Asked Before's MCP server needs ${MCP_ENV.url}, your Asked Before server's address, and ${MCP_ENV.apiKey}, a key from its Settings page.`);
  process.exit(1);
}
const api = createClient({ baseUrl, apiKey });

const INSTRUCTIONS = `Asked Before keeps the learner's library cards. A card is one skill they asked a chatbot how to do more than once, such as "Undo a git commit", with a borrow for each time they asked. A card is returned when they pass a cold rep, a fresh problem of its skill answered without AI, and borrowed again when they ask it once more after that.

When the learner asks you how to do something, record their question with record_question, in their own words: only what they wrote, never your answer, their code, or secrets. If it lands on a card they asked before, tell them how many times they've borrowed it and offer a cold rep. During a cold rep, show the problem as written, give no hints and no answer, and pass their answer to check_answer exactly as they wrote it.`;

const CardOut = z.object({
  id: z.string(),
  skill: z.string(),
  status: z.enum(["borrowed", "returned", "borrowed_again"]),
  count: z.number(),
  firstBorrowAt: z.string(),
  lastBorrowAt: z.string(),
  returnedAt: z.string().nullable(),
});
const ProjectRef = z.object({ id: z.string(), name: z.string() });
const ProjectArg = z
  .string()
  .min(1)
  .optional()
  .describe(`The project's name or id. Leave it out for the default project${defaultProject ? `, ${defaultProject}` : ""}.`);

const day = (iso: string) => iso.slice(0, 10);
const STATUS: Record<Card["status"], string> = { borrowed: "borrowed", returned: "returned", borrowed_again: "borrowed again" };
const times = (n: number) => (n === 1 ? "once" : `${n} times`);
const status = (card: Card) => (card.status === "returned" ? `returned ${day(card.returnedAt!)}` : STATUS[card.status]);
const cardLine = (card: Card) => `"${card.skill}": borrowed ${times(card.count)}, first ${day(card.firstBorrowAt)}, last ${day(card.lastBorrowAt)}; ${status(card)}. Card id ${card.id}.`;
const cardOut = ({ id, skill, status, count, firstBorrowAt, lastBorrowAt, returnedAt }: Card) => ({ id, skill, status, count, firstBorrowAt, lastBorrowAt, returnedAt });
const ref = ({ id, name }: Project) => ({ id, name });

/** A tool's answer: a text for the agent, and the same facts as structured content. */
const answer = <T extends Record<string, unknown>>(text: string, structuredContent: T) => ({ content: [{ type: "text" as const, text }], structuredContent });

/** Calls Asked Before; a failure becomes a tool error with its message. */
async function ask<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error(`${error.message} Check ${MCP_ENV.apiKey}, or make a new key in Asked Before's Settings.`);
    if (error instanceof ApiError) throw new Error(error.message);
    throw new Error(`Asked Before couldn't be reached at ${baseUrl}.`);
  }
}

const listNames = (projects: Project[]) => (projects.length ? projects.map((p) => `"${p.name}"`).join(", ") : "none yet");

/** The project a call names, by id or name, or else the default one. */
async function projectFor(given: string | undefined): Promise<Project> {
  const projects = await ask(() => api.projects.list());
  const wanted = given?.trim() || defaultProject;
  if (!wanted) throw new Error(`Say which project: the learner's projects are ${listNames(projects)}. Or set ${MCP_ENV.project} to pick a default.`);
  const found = projects.find((p) => p.id === wanted) ?? projects.find((p) => p.name.toLowerCase() === wanted.toLowerCase());
  if (!found) throw new Error(`The learner has no project "${wanted}". Their projects are ${listNames(projects)}.`);
  return found;
}

function build(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List the learner's Asked Before projects. A project is a named library of their history for one part of their life, such as Work, with its own cards. Gives each project's cards and how many are borrowed, returned, and borrowed again, and says which is the default project. Sends nothing of the learner's.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        projects: z.array(ProjectRef.extend({ demo: z.boolean(), cards: z.number(), borrowed: z.number(), returned: z.number(), borrowedAgain: z.number() })),
        defaultProject: ProjectRef.nullable(),
      }),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const projects = await ask(() => api.projects.list());
      const fallback = defaultProject ? (projects.find((p) => p.id === defaultProject) ?? projects.find((p) => p.name.toLowerCase() === defaultProject.toLowerCase())) : undefined;
      const lines = projects.map(
        (p) =>
          `- "${p.name}"${p.demo ? " (demo data)" : ""}: ${p.counts.cards} cards, ${p.counts.borrowed} borrowed, ${p.counts.returned} returned, ${p.counts.borrowedAgain} borrowed again. Project id ${p.id}.`,
      );
      const which = fallback ? `The default project is "${fallback.name}".` : "No default project is set, so name one in each call.";
      return answer(projects.length ? `The learner's projects:\n${lines.join("\n")}\n${which}` : "The learner has no projects yet. They make one in Asked Before.", {
        projects: projects.map((p) => ({ ...ref(p), demo: p.demo, ...p.counts })),
        defaultProject: fallback ? ref(fallback) : null,
      });
    },
  );

  server.registerTool(
    "list_cards",
    {
      title: "List cards",
      description:
        'List a project\'s cards, most borrowed first. A card is one skill the learner asked about more than once, such as "Undo a git commit", and its count is how many times they borrowed it. A card is borrowed until a cold rep on it passes, then returned, and borrowed again once they ask it after that. Set not_returned to list only the cards still waiting for a cold rep. Sends nothing of the learner\'s.',
      inputSchema: z.object({
        project: ProjectArg,
        not_returned: z.boolean().default(false).describe("Only the cards that aren't returned: borrowed, or borrowed again."),
      }),
      outputSchema: z.object({ project: ProjectRef, cards: z.array(CardOut) }),
      annotations: { readOnlyHint: true },
    },
    async ({ project, not_returned }) => {
      const found = await projectFor(project);
      const cards = (await ask(() => api.cards.list(found.id))).filter((card) => !not_returned || card.status !== "returned");
      const which = not_returned ? "cards not returned" : "cards";
      const text = cards.length
        ? `"${found.name}" has ${cards.length} ${which}, most borrowed first:\n${cards.map((card) => `- ${cardLine(card)}`).join("\n")}`
        : `"${found.name}" has no ${which}.`;
      return answer(text, { project: ref(found), cards: cards.map(cardOut) });
    },
  );

  server.registerTool(
    "record_question",
    {
      title: "Record a question",
      description:
        "Record the learner's how-to question as a capture in one of their projects, and sort it onto their cards at once. Send only the learner's own words, exactly as they asked: never your answer, their code, file contents, or secrets. Says whether it landed on a card they asked before, with how many times they've borrowed it and its status, so you can tell them and offer a cold rep; or that it's new, and waits unsorted until they ask the same thing again. The same words again within ten minutes add no borrow.",
      inputSchema: z.object({
        question: z.string().min(1).max(2000).describe("The learner's question, in their own words, word for word."),
        project: ProjectArg,
      }),
      outputSchema: z.object({
        project: ProjectRef,
        phrasing: z.object({ id: z.string(), text: z.string(), time: z.string() }),
        card: CardOut.nullable(),
        repeat: z.boolean(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ question, project }) => {
      const found = await projectFor(project);
      const capture = await ask(() => api.captures.create(found.id, { text: question }));
      const lines = [
        capture.repeat
          ? `These words were recorded in "${found.name}" less than ten minutes ago, so no borrow was added.`
          : `Recorded in "${found.name}".`,
        capture.card
          ? `It's on the card ${cardLine(capture.card)} Tell the learner they've asked this before, and offer a cold rep on it with start_cold_rep.`
          : "No card asks this yet, so it waits unsorted until the learner asks the same thing again.",
      ];
      const { id, text, time } = capture.phrasing;
      return answer(lines.join(" "), { project: ref(found), phrasing: { id, text, time }, card: capture.card && cardOut(capture.card), repeat: capture.repeat });
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
      const { rep, lesson } = await ask(() => api.reps.start(card_id));
      const text = [
        lesson ? `Lesson:\n${lesson}` : "",
        `Problem:\n${rep.problem}`,
        `Show the learner ${lesson ? "the lesson and " : ""}the problem as written, with no hints. When they answer, pass their answer as they wrote it to check_answer, with rep id ${rep.id}.`,
      ];
      return answer(text.filter(Boolean).join("\n\n"), { repId: rep.id, problem: rep.problem, lesson });
    },
  );

  server.registerTool(
    "check_answer",
    {
      title: "Check an answer",
      description:
        "Check the learner's answer to a cold rep; each cold rep is checked once. Send only the learner's own answer, exactly as they wrote it: never your own, a corrected one, or added hints. Gives the verdict, pass or fail, with the reason, and the card's status: a pass stamps the card returned. After a fail, a new cold rep on the card brings a different problem and the lesson again.",
      inputSchema: z.object({
        rep_id: z.string().min(1).describe("The cold rep's id, from start_cold_rep."),
        answer: z.string().min(1).max(4000).describe("The learner's own answer, word for word."),
      }),
      outputSchema: z.object({ verdict: z.enum(["pass", "fail"]), reason: z.string(), card: CardOut }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ rep_id, answer: given }) => {
      const { rep, card } = await ask(() => api.reps.check(rep_id, { answer: given }));
      const verdict = rep.verdict ?? "fail";
      const text =
        verdict === "pass"
          ? `Passed. ${rep.reason} The card "${card.skill}" is returned, stamped ${day(card.returnedAt!)}.`
          : `Not passed. ${rep.reason} The card "${card.skill}" is still ${STATUS[card.status]}. Another cold rep on it brings a different problem and the lesson again.`;
      return answer(text, { verdict, reason: rep.reason ?? "", card: cardOut(card) });
    },
  );

  return server;
}

serveStdio(build);
