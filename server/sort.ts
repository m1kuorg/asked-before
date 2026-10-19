// The sort (m1kuorg/basics#44, ADR 0002): places an upload's phrasings onto
// its shelf's cards, or onto new cards, or leaves them unsorted. It runs
// in each shelf's Durable Object (worker/sorter.ts), one upload at a time
// per shelf and one batch per alarm, in batches of SORT_BATCH_SIZE
// phrasings no sort has seen, each sent with as many of the shelf's most
// recent unsorted phrasings, so a later borrow can still turn an earlier
// one into a card. Later batches see the cards earlier ones made. Once an
// upload's batches are done, its second pass (m1kuorg/basics#56) offers
// the window once more, at a higher effort, against the cards as they
// stand then and each other, so a phrasing an earlier batch left unsorted
// can still join a card a later one made; the upload is sorted once that
// pass is applied. So an upload makes one request per batch and one more:
// the demo export 2, and 2,000 phrasings 8. An unsorted phrasing older
// than that window is only compared again if it falls inside a later
// batch's window: a known limit.
//
// The model sees the cards as short ids, skills, and three sample phrasings,
// and the phrasings as short ids and their words cut to 300 characters,
// never a time; it only says which phrasings join which card and which form
// new skills. An upload's batch is sent in an order that puts phrasings
// sharing rare words side by side (orderByWords). Code checks the answer,
// asks again with the error up to twice, and otherwise fails the sort
// rather than make a bad card. Progress and failures are recorded on the
// upload, and a failed sort is retried from the first phrasing not yet
// offered. A batch a restart or a deploy cuts off runs again. Every request
// spends one of the account's daily model requests (server/model.ts).
//
// A capture (m1kuorg/basics#50) is placed by the same request and checks,
// at a lower effort, against the cards and a shorter window, and keeps
// only where the capture goes (sortCapture).

import { z } from "zod";
import { readConfig, type Env } from "./config";
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
/**
 * An upload's second pass, over the window once its batches are done
 * (m1kuorg/basics#56). With `bun run check:sort-recall 10`, medium found
 * 77.5% of the pairs at 89.7% precision and high 82.4% at 89.2%; xhigh cut
 * off one answer in ten at 64,000 tokens, and max every one.
 */
const SECOND_PASS_EFFORT: Effort = "high";

/** The model's reply to a sort request, before code checks it. */
const Reply = z.object({
  joins: z.array(z.object({ cardId: z.string(), phrasingIds: z.array(z.string()) })),
  newSkills: z.array(z.object({ name: z.string(), phrasingIds: z.array(z.string()) })),
});

/**
 * What a skill is, tuned with `bun run check:sort-recall` (m1kuorg/basics#56)
 * on a made-up history of 469 labeled phrasings. The sentence on a task's
 * variants, with each batch in orderByWords' order, raised the share of
 * pairs of one skill found on one card from 59% to 71%, at precision from
 * 93% to 92%, the means of 10 and 20 runs; the sentence alone found as many
 * at 87%. Card A's phrasing about a commit made on the wrong branch, which
 * the sort without it sometimes left unsorted, stayed on card A in every
 * run since (m1kuorg/basics#66).
 */
const SYSTEM = `You sort one person's own messages to a chatbot onto their library cards. A card is one skill the person asked about more than once, and each message on it is one time they asked.

You're given JSON with two lists. "cards" holds the person's existing cards, each { id, skill, samples }: the skill's name and a few of the messages already on it. "phrasings" holds the messages to place, each { id, text }.

A skill is one task the person wanted to know how to do, at the level someone would learn it once to stop asking: the task in general, with its variants. A task's variants are everything someone learning it would meet: doing it in other circumstances or with other options, choosing between ways to do it, the errors and surprises it throws, and putting it right when it went wrong. Messages that ask how to do the same task belong to the same skill even when they're worded differently, describe different circumstances, or ask which way or option to use for it. Messages that share only a topic or a tool, but ask how to do different tasks, are different skills.

Place each phrasing in one of three ways:
1. If it asks how to do the skill of an existing card, it joins that card: list its id under the card's id in "joins".
2. Otherwise, if two or more phrasings ask how to do the same skill, and no card has it, they form a new skill: list their ids together in "newSkills", with the skill's name.
3. Otherwise, leave it out. It stays unsorted until a later message asks the same thing.

Use only the ids you were given, and put each phrasing in at most one place. Never make a new skill for a task a card already has; the phrasings join that card instead. A new skill needs at least two phrasings.

Name each new skill the way a reference book would title its entry on the task: a verb and what it acts on, in sentence case, such as "Undo a git commit". Name the task in general, never one instance of it: use "a" or "an", never "the", "last", "my", or "this", and leave out details such as a specific value. Keep names to ${MAX_SKILL_NAME} characters or fewer, on one line.`;

/** A reply that breaks a rule. Its message names ids only, never a phrasing's words or a skill's name. */
class ReplyError extends Error {}

/** A phrasing as the model sees it, in a sort or a rep: its first 300 characters. */
export const cut = (text: string) => text.slice(0, MAX_TEXT);

/** Words that say nothing about what a phrasing asks, which orderByWords skips. */
const COMMON = new Set(
  "a an the and or but if to of in on at for with by from as is are was were be been it its this that these those i im my me we our you your do does did how what whats why when which who can could should would will just so not no yes vs get got have has had there their them they than then too very all any some into out up down over about like still even also again only one two".split(" "),
);
const WORD = /[\p{L}\p{N}]+/gu;
/** A word without an ending such as a plural's or a tense's, so "commits" reads as "commit". */
const stem = (word: string) =>
  word.endsWith("ing") ? word.slice(0, -3) : word.endsWith("ed") || word.endsWith("es") ? word.slice(0, -2) : word.endsWith("s") ? word.slice(0, -1) : word;
/** How much two phrasings must share to sit side by side: one word held by at most a twentieth of the batch is enough on its own. */
const ENOUGH = 3;
/** How much of a phrasing orderByWords reads: its opening, which says what it asks, before any code or error pasted after. */
const OPENING = 150;

/**
 * A batch in an order that puts phrasings sharing rare words side by side,
 * which the model sorts with fewer misplaced phrasings than the same batch
 * in time order (m1kuorg/basics#56). A phrasing's words are those of its
 * first OPENING characters, lowercase and stemmed, of two characters or
 * more and not common. From the batch's first phrasing, each next one is
 * the phrasing not yet placed that shares the most with the last, each
 * shared word counting more the fewer of the batch's phrasings hold it, and
 * a word in more than a tenth of them not at all; when none shares ENOUGH,
 * the earliest one not yet placed. Only the order changes, never which
 * phrasings are sent. A batch of 600 long phrasings takes about 2 ms of CPU.
 */
function orderByWords<P extends SortPhrasing>(batch: P[]): P[] {
  const n = batch.length;
  const index = new Map<string, number>();
  /** For each word, by its index, the phrasings that hold it, in batch order. */
  const holders: number[][] = [];
  const words = batch.map((phrasing, i) => {
    const mine: number[] = [];
    for (const word of phrasing.text.slice(0, OPENING).toLowerCase().match(WORD) ?? []) {
      if (word.length < 2 || COMMON.has(word)) continue;
      const stemmed = stem(word);
      if (stemmed.length < 2) continue;
      let w = index.get(stemmed);
      if (w === undefined) index.set(stemmed, (w = holders.push([]) - 1));
      const held = holders[w]!;
      if (held[held.length - 1] !== i) {
        held.push(i);
        mine.push(w);
      }
    }
    return mine;
  });
  const weight = holders.map((held) => (held.length > n / 10 ? 0 : Math.log(n / held.length)));
  /** Each phrasing's words that can tie it to another: rare, and held by more than it. */
  const ties = words.map((mine) => mine.filter((w) => weight[w]! > 0 && holders[w]!.length > 1));
  const placed = new Uint8Array(n);
  const score = new Float64Array(n);
  const order: P[] = [];
  let earliest = 0;
  let at = -1;
  while (order.length < n) {
    if (at < 0) {
      while (placed[earliest]) earliest++;
      at = earliest;
    }
    placed[at] = 1;
    order.push(batch[at]!);
    const touched: number[] = [];
    for (const w of ties[at]!) {
      for (const j of holders[w]!) {
        if (placed[j]) continue;
        if (score[j] === 0) touched.push(j);
        score[j] = score[j]! + weight[w]!;
      }
    }
    let next = -1;
    let best = 0;
    for (const j of touched) {
      if (score[j]! > best) [next, best] = [j, score[j]!];
      score[j] = 0;
    }
    at = best >= ENOUGH ? next : -1;
  }
  return order;
}

/**
 * Asks the model where a batch's phrasings go, against the shelf's cards,
 * and checks its answer; one that fails a check is asked again with the
 * error added, up to twice, and then the sort fails with that error.
 */
export async function askPlacement(env: Env, userId: string, cards: SortCard[], phrasings: SortPhrasing[], effort: Effort): Promise<Placement> {
  const request = JSON.stringify({
    cards: cards.map((card, i) => ({ id: `c${i + 1}`, skill: card.skill, samples: card.samples.map(cut) })),
    phrasings: phrasings.map((phrasing, i) => ({ id: `p${i + 1}`, text: cut(phrasing.text) })),
  });
  let note = "";
  for (let attempt = 1; ; attempt++) {
    const reply = await askStructured(env, userId, SYSTEM, request + note, Reply, effort);
    try {
      return check(reply, cards, phrasings);
    } catch (error) {
      if (!(error instanceof ReplyError)) throw error;
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
function check(reply: z.infer<typeof Reply>, cards: SortCard[], phrasings: SortPhrasing[]): Placement {
  const phrasingOf = new Map(phrasings.map((p, i) => [`p${i + 1}`, p.id]));
  const cardOf = new Map(cards.map((c, i) => [`c${i + 1}`, c.id]));
  const cardNamed = new Map(cards.map((c) => [c.skill.toLowerCase(), c.id]));
  const placed = new Set<string>();
  const take = (ids: string[], where: string) =>
    ids.map((id) => {
      const phrasingId = phrasingOf.get(id);
      if (!phrasingId) throw new ReplyError(`${where} named phrasing ${id}, which isn't one of the phrasings sent.`);
      if (placed.has(id)) throw new ReplyError(`it placed phrasing ${id} twice.`);
      placed.add(id);
      return phrasingId;
    });

  const joins = new Map<string, string[]>();
  const join = (cardId: string, phrasingIds: string[]) => joins.set(cardId, [...(joins.get(cardId) ?? []), ...phrasingIds]);
  for (const { cardId, phrasingIds } of reply.joins) {
    const card = cardOf.get(cardId);
    if (!card) throw new ReplyError(`it named card ${cardId}, which isn't one of the cards sent.`);
    join(card, take(phrasingIds, `card ${cardId}`));
  }

  const skills = new Map<string, { skill: string; at: number; phrasingIds: string[] }>();
  reply.newSkills.forEach(({ name, phrasingIds }, i) => {
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
      if (skill === "") throw new ReplyError(`new skill ${at} has no name.`);
      if (/[\r\n]/.test(skill)) throw new ReplyError(`new skill ${at}'s name runs over more than one line.`);
      if (skill.length > MAX_SKILL_NAME) throw new ReplyError(`new skill ${at}'s name is longer than ${MAX_SKILL_NAME} characters.`);
      return { skill, phrasingIds };
    });
  return { joins: [...joins].map(([cardId, phrasingIds]) => ({ cardId, phrasingIds })), newCards };
}

const NOTHING: Placement = { joins: [], newCards: [] };

/**
 * Lower than the upload sort's medium (SORT_EFFORT), since the agent waits
 * on a capture in the same turn. Tuned with `bun run check:capture-sort 3`
 * (m1kuorg/basics#50): low and medium both placed 60 of 60 captures, fresh
 * rephrasings of the demo export's five skills and questions none of them
 * ask, with medians of 1.7s and 1.8s. The slowest low capture took 2.7s in
 * one set of runs and 5.0s in another; the slowest medium one, 3.3s.
 */
export const CAPTURE_EFFORT: Effort = "low";

/**
 * How many of the shelf's most recent unsorted phrasings a capture is
 * compared with. With the sort's 300, a capture behind a long unsorted
 * history took up to 12s, the model's answer busy placing the others.
 */
export const CAPTURE_WINDOW = 50;

/** Asks the sort where a capture goes, and keeps only that: the card it joins, or the new card it makes. */
export async function sortCapture(env: Env, userId: string, shelfId: string, capture: SortPhrasing): Promise<Placement> {
  const { cards, window } = await store.captureView(env.DB, shelfId, CAPTURE_WINDOW);
  const batch = [capture, ...window];
  // With no card to join and nothing unsorted, it can only wait unsorted, so the model isn't asked.
  if (!cards.length && batch.length === 1) return NOTHING;
  const { joins, newCards } = await askPlacement(env, userId, cards, batch, CAPTURE_EFFORT);
  const holds = (ids: string[]) => ids.includes(capture.id);
  return {
    joins: joins.filter((join) => holds(join.phrasingIds)).map((join) => ({ cardId: join.cardId, phrasingIds: [capture.id] })),
    newCards: newCards.filter((card) => holds(card.phrasingIds)),
  };
}

/**
 * One batch of the shelf's sort, for one alarm of its Durable Object: it
 * takes the shelf's next upload, one cut off first, and places up to
 * SORT_BATCH_SIZE of its phrasings no sort has seen; once none is left,
 * the alarm after is its second pass, which marks it sorted. A failure, a
 * model's or the daily cap's 429 or a check that failed three times, is
 * recorded on the upload, which a retry carries on. Whether the shelf has
 * an upload still to sort, so the Durable Object runs again; none when the
 * shelf or the account is gone, which ends its sort quietly.
 */
export async function sortNextBatch(env: Env, shelfId: string): Promise<boolean> {
  const upload = await store.startNext(env.DB, shelfId);
  if (!upload) return false;
  try {
    const { fresh, window, cards, brought } = await store.nextBatch(env.DB, upload, readConfig(env).sortBatchSize);
    // With none of its phrasings left to offer, this is the upload's second pass: the window again, against the cards as they stand now. An upload that brought nothing has none.
    const last = fresh.length === 0;
    const batch = last ? (brought ? window : []) : [...fresh, ...window];
    // With nothing to offer, or no card to join and one phrasing alone, nothing can be placed, so the model isn't asked.
    const ask = batch.length > 0 && (cards.length > 0 || batch.length > 1);
    const placement = ask ? await askPlacement(env, upload.userId, cards, orderByWords(batch), last ? SECOND_PASS_EFFORT : SORT_EFFORT) : NOTHING;
    return await store.applyPlacement(env.DB, upload, placement, batch.map((p) => p.id), last);
  } catch (error) {
    // Its message is safe to show. The upload records it; the logs carry requests only.
    return store.markFailed(env.DB, upload, error instanceof HttpError ? error.message : "The sort failed on the server.");
  }
}

/** How long an upload waits or sorts with no progress before the cron starts its shelf's sort again. */
export const STALLED_MS = 10 * 60 * 1000;

/**
 * The Worker's cron (worker/index.ts), every five minutes: starts the sort
 * again on each shelf with an upload waiting or sorting that has made no
 * progress in the STALLED_MS before `now`, as when the request that
 * finished it died before starting its sort, or its alarm's database
 * failed. Starting a sort that's under way only wakes it again once its
 * batch is done. Nothing escapes it and nothing is logged: a shelf it
 * couldn't start is tried again on the next run.
 */
export async function resumeStalledSorts(env: Env, now: number): Promise<void> {
  try {
    const shelves = await store.stalledShelves(env.DB, now - STALLED_MS);
    await Promise.allSettled(shelves.map(async (shelfId) => env.SORTER.getByName(shelfId).start()));
  } catch {
    // The database failed; the next run reads it again.
  }
}
