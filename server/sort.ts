// The sort (m1kuorg/basics#44, ADR 0002): places an upload's phrasings onto
// its project's cards, or onto new cards, or leaves them unsorted. It runs
// in the server process, one upload at a time per project, in batches of
// SORT_BATCH_SIZE phrasings no sort has seen, each sent with as many of the
// project's most recent unsorted phrasings, so a later borrow can still turn
// an earlier one into a card. Later batches see the cards earlier ones made.
// An unsorted phrasing older than that window is only compared again if it
// falls inside a later batch's window: a known limit.
//
// The model sees the cards as short ids, skills, and three sample phrasings,
// and the phrasings as short ids and their words cut to 300 characters,
// never a time; it only says which phrasings join which card and which form
// new skills. Code checks the answer, asks again with the error up to
// twice, and otherwise fails the sort rather than make a bad card. Progress
// and failures are recorded on the upload, and a failed sort is retried
// from the first phrasing not yet offered. Every request spends one of the
// account's daily model requests (server/model.ts).

import { z } from "zod";
import { config } from "./config";
import { HttpError } from "./http";
import { askStructured, ModelError, type Effort } from "./model";
import * as store from "./store/sorts";
import type { Placement, SortCard, SortPhrasing } from "./store/sorts";

export const MAX_SKILL_NAME = 60;
/** How much of a phrasing the model sees. */
const MAX_TEXT = 300;
/** A batch's first request, and the two asked again when its answer fails a check. */
const TRIES = 3;
/**
 * Tuned with `bun run check:sort` (m1kuorg/basics#44): low, medium, and
 * high all matched the demo export's answer key in 30 of 30 runs, so a
 * larger labeled history decided it. There, low found clearly fewer of the
 * phrasings that ask the same thing, and high found no more than medium in
 * twice the time and tokens. Captures (m1kuorg/basics#50) go lower.
 */
export const SORT_EFFORT: Effort = "medium";

const Answer = z.object({
  joins: z.array(z.object({ cardId: z.string(), phrasingIds: z.array(z.string()) })),
  newSkills: z.array(z.object({ name: z.string(), phrasingIds: z.array(z.string()) })),
});

const SYSTEM = `You sort one person's own messages to a chatbot onto their library cards. A card is one skill the person asked about more than once, and each message on it is one time they asked.

You're given JSON with two lists. "cards" holds the person's existing cards, each { id, skill, samples }: the skill's name and a few of the messages already on it. "phrasings" holds the messages to place, each { id, text }.

A skill is one task the person wanted to know how to do, at the level someone would learn it once to stop asking: the task in general, with its variants. Messages that ask how to do the same task belong to the same skill even when they're worded differently, describe different circumstances, or ask which way or option to use for it. Messages that share only a topic or a tool, but ask how to do different tasks, are different skills.

Place each phrasing in one of three ways:
1. If it asks how to do the skill of an existing card, it joins that card: list its id under the card's id in "joins".
2. Otherwise, if two or more phrasings ask how to do the same skill, and no card has it, they form a new skill: list their ids together in "newSkills", with the skill's name.
3. Otherwise, leave it out. It stays unsorted until a later message asks the same thing.

Use only the ids you were given, and put each phrasing in at most one place. Never make a new skill for a task a card already has; the phrasings join that card instead. A new skill needs at least two phrasings.

Name each new skill the way a reference book would title its entry on the task: a verb and what it acts on, in sentence case, such as "Undo a git commit". Name the task in general, never one instance of it: use "a" or "an", never "the", "last", "my", or "this", and leave out details such as a specific value. Keep names to ${MAX_SKILL_NAME} characters or fewer, on one line.`;

/** An answer that breaks a rule. Its message names ids only, never a phrasing's words or a skill's name. */
class AnswerError extends Error {}

const cut = (text: string) => text.slice(0, MAX_TEXT);

/**
 * Asks the model where a batch's phrasings go, against the project's cards,
 * and checks its answer; one that fails a check is asked again with the
 * error added, up to twice, and then the sort fails with that error.
 */
export async function askPlacement(userId: string, cards: SortCard[], phrasings: SortPhrasing[], effort: Effort): Promise<Placement> {
  const request = JSON.stringify({
    cards: cards.map((card, i) => ({ id: `c${i + 1}`, skill: card.skill, samples: card.samples.map(cut) })),
    phrasings: phrasings.map((phrasing, i) => ({ id: `p${i + 1}`, text: cut(phrasing.text) })),
  });
  let note = "";
  for (let attempt = 1; ; attempt++) {
    const answer = await askStructured(SYSTEM, request + note, Answer, effort, userId);
    try {
      return check(answer, cards, phrasings);
    } catch (error) {
      if (!(error instanceof AnswerError)) throw error;
      if (attempt === TRIES) throw new ModelError(`The model's sort broke a rule ${TRIES} times running. The last time, ${error.message}`);
      note = `\n\nYour last answer broke a rule: ${error.message} Answer again, in full, following every rule.`;
    }
  }
}

/**
 * Every id must be one the request sent, and no phrasing placed twice. A
 * new skill named like a card (ignoring case) joins that card, and new
 * skills of the same name are one. A new skill with fewer than two
 * phrasings makes no card, and its phrasings stay unsorted; one that makes
 * a card needs a name of one line of 1 to 60 characters.
 */
function check(answer: z.infer<typeof Answer>, cards: SortCard[], phrasings: SortPhrasing[]): Placement {
  const phrasingOf = new Map(phrasings.map((p, i) => [`p${i + 1}`, p.id]));
  const cardOf = new Map(cards.map((c, i) => [`c${i + 1}`, c.id]));
  const cardNamed = new Map(cards.map((c) => [c.skill.toLowerCase(), c.id]));
  const placed = new Set<string>();
  const take = (ids: string[], where: string) =>
    ids.map((id) => {
      const phrasingId = phrasingOf.get(id);
      if (!phrasingId) throw new AnswerError(`${where} named phrasing ${id}, which isn't one of the phrasings sent.`);
      if (placed.has(id)) throw new AnswerError(`it placed phrasing ${id} twice.`);
      placed.add(id);
      return phrasingId;
    });

  const joins = new Map<string, string[]>();
  const join = (cardId: string, phrasingIds: string[]) => joins.set(cardId, [...(joins.get(cardId) ?? []), ...phrasingIds]);
  for (const { cardId, phrasingIds } of answer.joins) {
    const card = cardOf.get(cardId);
    if (!card) throw new AnswerError(`it named card ${cardId}, which isn't one of the cards sent.`);
    join(card, take(phrasingIds, `card ${cardId}`));
  }

  const skills = new Map<string, { skill: string; at: number; phrasingIds: string[] }>();
  answer.newSkills.forEach(({ name, phrasingIds }, i) => {
    const ids = take(phrasingIds, `new skill ${i + 1}`);
    const skill = name.trim();
    const card = cardNamed.get(skill.toLowerCase());
    if (card) return join(card, ids);
    const same = skill === "" ? `#${i}` : skill.toLowerCase();
    const entry = skills.get(same) ?? { skill, at: i + 1, phrasingIds: [] };
    entry.phrasingIds.push(...ids);
    skills.set(same, entry);
  });
  const newCards = [...skills.values()]
    .filter((entry) => entry.phrasingIds.length >= 2)
    .map(({ skill, at, phrasingIds }) => {
      if (skill === "") throw new AnswerError(`new skill ${at} has no name.`);
      if (/[\r\n]/.test(skill)) throw new AnswerError(`new skill ${at}'s name runs over more than one line.`);
      if (skill.length > MAX_SKILL_NAME) throw new AnswerError(`new skill ${at}'s name is longer than ${MAX_SKILL_NAME} characters.`);
      return { skill, phrasingIds };
    });
  return { joins: [...joins].map(([cardId, phrasingIds]) => ({ cardId, phrasingIds })), newCards };
}

const NOTHING: Placement = { joins: [], newCards: [] };

/** Sorts one upload, batch by batch, until no phrasing of it is left unoffered or it's gone. */
async function sortUpload(upload: store.SortUpload): Promise<void> {
  for (;;) {
    const { fresh, window } = store.nextBatch(upload.id, upload.projectId, config.sortBatchSize);
    if (!fresh.length) return;
    const cards = store.sortCards(upload.projectId);
    const batch = [...fresh, ...window];
    // With no card to join and one phrasing alone, nothing can be placed, so the model isn't asked.
    const placement = cards.length || batch.length > 1 ? await askPlacement(upload.userId, cards, batch, SORT_EFFORT) : NOTHING;
    if (!store.applyPlacement(upload.id, upload.projectId, placement, batch.map((p) => p.id))) return;
  }
}

const sorting = new Set<string>();

/**
 * Sorts the project's waiting uploads in the background, one at a time.
 * While a sort runs, calling it again changes nothing: the running sort
 * takes the next waiting upload after its own. A sort whose project is
 * deleted stops after its current request.
 */
export function sortProject(projectId: string): void {
  if (sorting.has(projectId)) return;
  sorting.add(projectId);
  void (async () => {
    try {
      for (let upload; (upload = store.nextUpload(projectId)); ) {
        store.markSorting(upload.id);
        try {
          await sortUpload(upload);
          store.markSorted(upload.id);
        } catch (error) {
          // A model failure, the daily cap's 429, or a check that failed three times: its message is safe to show. The upload records it; the logs carry requests only.
          store.markFailed(upload.id, error instanceof HttpError ? error.message : "The sort failed on the server.");
        }
      }
    } finally {
      sorting.delete(projectId);
    }
  })();
}

/** At startup: carries on every sort a restart cut off, and starts the ones that were waiting. */
export function resumeSorts(): void {
  for (const projectId of store.projectsToSort()) sortProject(projectId);
}
