// The demo export and its answer key (demo/), for the sort's checks: the
// export's phrasings as the SDK's reader reads them, named m1, m2, … in
// export order as the key names them; uploading phrasings and waiting for
// their sort, through the SDK; a project's cards and unsorted phrasings
// compared with the key, through the SDK; and keySorter, which answers a
// sort request the way the key sorts the export, for the checks that stub
// the model. It prints ids and skill names, never phrasing text.

import { MAX_CHUNK, readExport, type Client, type Phrasing, type StoredPhrasing, type Upload } from "@asked-before/sdk";
import { join } from "node:path";
import { sortRequest, type ModelRequest } from "./model-stub";

const DEMO = join(import.meta.dir, "..", "..", "demo");

export type KeySkill = { name: string; count: number; firstMonth: string; lastMonth: string; messageIds: string[] };
export const key: { skills: KeySkill[]; oneOffs: string[] } = await Bun.file(join(DEMO, "answer-key.json")).json();

/** The demo export's phrasings, in export order: m1 is the first. */
export const phrasings: Phrasing[] = (await readExport(Bun.file(join(DEMO, "export.json")))).phrasings;
const nameOf = new Map(phrasings.map((p, i) => [p.sourceId, `m${i + 1}`]));
const skillOf = new Map(key.skills.flatMap((skill) => skill.messageIds.map((id) => [phrasings[Number(id.slice(1)) - 1]!.text, skill] as const)));

/** A phrasing's name in the key, such as "m1", from its source id. */
export const named = (sourceId: string) => nameOf.get(sourceId) ?? `(not in the demo export: ${sourceId})`;
/** Names in the key's order: m2 before m10. */
export const idList = (ids: string[]) => [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join(" ");
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
/** An ISO time's month, as the key writes it. */
export const month = (iso: string) => monthYear.format(new Date(iso));

/** Uploads phrasings into a project as the page does: create, append in chunks, finish, which starts the sort. */
export async function upload(client: Client, projectId: string, list: Phrasing[], fileName = "conversations.json"): Promise<Upload> {
  const made = await client.uploads.create(projectId, { source: "chatgpt", fileName });
  for (let i = 0; i < list.length; i += MAX_CHUNK) await client.uploads.append(made.id, list.slice(i, i + MAX_CHUNK));
  return client.uploads.finish(made.id);
}

/** Polls an upload until its sort ends, sorted or failed. */
export async function sortEnds(client: Client, uploadId: string, timeoutMs = 240_000): Promise<Upload> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const upload = await client.uploads.get(uploadId);
    if (upload.status === "sorted" || upload.status === "failed") return upload;
    if (Date.now() > deadline) throw new Error(`the sort was still ${upload.status} after ${timeoutMs / 1000}s (${upload.offered} of ${upload.phrasings} offered)`);
    await Bun.sleep(250);
  }
}

/** Every unsorted phrasing in a project, a page at a time, newest first. */
export async function allUnsorted(client: Client, projectId: string, limit = 100): Promise<StoredPhrasing[]> {
  const all: StoredPhrasing[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.cards.unsorted(projectId, { limit, cursor });
    all.push(...page.phrasings);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all;
}

export type Comparison = { lines: string[]; problems: string[] };

/**
 * A project's cards against the key, through the SDK: in margin-key order,
 * each card's borrows are the key's, its count and months match, and each
 * borrow is the export's phrasing word for word with its own time; no
 * one-off is on a card, card A is named as the key names it, and the
 * unsorted phrasings are the one-offs.
 */
export async function compareWithKey(client: Client, projectId: string): Promise<Comparison> {
  const problems: string[] = [];
  const cards = await client.cards.list(projectId);
  const details = await Promise.all(cards.map((card) => client.cards.get(card.id)));
  const lines = details.map((card, i) => {
    const letter = String.fromCharCode(65 + i);
    const want = key.skills[i];
    const got = card.borrows.map((b) => named(b.sourceId));
    const wordForWord = card.borrows.every((b) => {
      const p = phrasings.find((q) => q.sourceId === b.sourceId);
      return p !== undefined && p.text === b.text && Date.parse(p.time) === Date.parse(b.time);
    });
    if (!wordForWord) problems.push(`card ${letter} holds a borrow that isn't the export's phrasing, word for word, at its own time`);
    const ok =
      want !== undefined &&
      sameIds(got, want.messageIds) &&
      card.count === want.count &&
      card.borrows.length === card.count &&
      month(card.firstBorrowAt) === want.firstMonth &&
      month(card.lastBorrowAt) === want.lastMonth &&
      card.status === "borrowed";
    if (!ok) problems.push(`card ${letter} doesn't match the key's ${want?.name ?? "nothing"}`);
    return `  ${ok ? "ok  " : "FAIL"} ${letter}  "${card.skill}": ${card.count}, ${month(card.firstBorrowAt)} to ${month(card.lastBorrowAt)}, ${card.status} [${idList(got)}]`;
  });
  if (cards.length !== key.skills.length) problems.push(`${cards.length} cards, the key has ${key.skills.length}`);

  const carded = new Set(details.flatMap((card) => card.borrows.map((b) => named(b.sourceId))));
  const strays = key.oneOffs.filter((id) => carded.has(id));
  if (strays.length) problems.push(`one-offs on a card: ${idList(strays)}`);
  const demoSkill = key.skills[0]!;
  const demoCard = details.find((card) => card.borrows.some((b) => named(b.sourceId) === demoSkill.messageIds[0]));
  const demoTogether = demoCard !== undefined && sameIds(demoCard.borrows.map((b) => named(b.sourceId)), demoSkill.messageIds);
  if (!demoTogether) problems.push(`the ${demoSkill.name} phrasings aren't alone on one card`);
  if (cards[0]?.skill !== demoSkill.name) problems.push(`card A is named "${cards[0]?.skill}", not "${demoSkill.name}"`);

  const unsorted = (await allUnsorted(client, projectId)).map((p) => named(p.sourceId));
  const unsortedOk = sameIds(unsorted, key.oneOffs);
  if (!unsortedOk) problems.push(`unsorted holds [${idList(unsorted)}], the key's one-offs are [${idList(key.oneOffs)}]`);

  lines.push(`  ${demoTogether ? "ok  " : "FAIL"} the ${demoSkill.count} "${demoSkill.name}" phrasings on one card, no strangers`);
  lines.push(`  ${strays.length ? "FAIL" : "ok  "} no one-off makes a card, and ${unsortedOk ? "unsorted holds exactly the" : "unsorted doesn't hold the"} ${key.oneOffs.length} one-offs`);
  return { lines, problems };
}

/**
 * Answers a sort request the way the key sorts the demo export: a batch's
 * phrasings of a skill join the card that has that skill's name or one of
 * its phrasings as a sample, or else, two or more of them, make it a new
 * skill under the key's name; one-offs are left out.
 */
export const keySorter = (request: ModelRequest) => keySorterWith(new Map())(request);

/** keySorter, with phrasings the demo export doesn't hold placed too: `also` maps a phrasing's words to the key's skill name it asks. */
export const keySorterWith = (also: Map<string, string>) => (request: ModelRequest) => {
  const sent = sortRequest(request);
  const skillOfText = (text: string) => skillOf.get(text) ?? key.skills.find((skill) => skill.name === also.get(text));
  const joins: { cardId: string; phrasingIds: string[] }[] = [];
  const newSkills: { name: string; phrasingIds: string[] }[] = [];
  for (const skill of key.skills) {
    const ids = sent.phrasings.filter((p) => skillOfText(p.text) === skill).map((p) => p.id);
    if (!ids.length) continue;
    const card = sent.cards.find((c) => c.skill === skill.name || c.samples.some((s) => skillOf.get(s) === skill));
    if (card) joins.push({ cardId: card.id, phrasingIds: ids });
    else if (ids.length >= 2) newSkills.push({ name: skill.name, phrasingIds: ids });
  }
  return { joins, newSkills };
};
