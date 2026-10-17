// All of an account's data, for its download (m1kuorg/basics#49): the
// account, and each project with its uploads, every phrasing in it, and its
// cards with their lessons and cold reps. Projects, uploads, and cards are
// read through the same functions the API answers with, so the download
// matches what the API shows; the phrasings are read here, all of them,
// whether on a card, unsorted, or still waiting for their sort. It's read
// in one transaction, so a sort or a rep landing meanwhile can't half
// appear. API keys, sessions, and the password hash are never in it.

import type { AccountData, CardData, PhrasingData, Upload } from "@asked-before/sdk";
import { getCard, listCards } from "./cards";
import { db, iso } from "./db";
import { listProjects } from "./projects";
import { listUploads } from "./uploads";
import { getAccount } from "./users";

type PhrasingRow = {
  id: string;
  source_id: string;
  text: string;
  time: number;
  origin: PhrasingData["origin"];
  upload_id: string | null;
  card_id: string | null;
};

const phrasingsOf = db.query(`
  SELECT f.id, f.source_id, f.text, f.time, f.origin, f.upload_id, f.card_id
  FROM phrasings f JOIN projects p ON p.id = f.project_id
  WHERE f.project_id = $projectId AND p.user_id = $userId
  ORDER BY f.time, f.id
`);

const toPhrasing = (row: PhrasingRow): PhrasingData => ({
  id: row.id,
  sourceId: row.source_id,
  text: row.text,
  time: iso(row.time),
  origin: row.origin,
  uploadId: row.upload_id,
  cardId: row.card_id,
});

/** Every one of the project's uploads, oldest first, a page at a time as the API reads them. */
function allUploads(userId: string, projectId: string): Upload[] {
  const all: Upload[] = [];
  let cursor: string | undefined;
  do {
    const page = listUploads(userId, projectId, 500, cursor)!;
    all.push(...page.uploads);
    cursor = page.next ?? undefined;
  } while (cursor);
  return all.reverse();
}

/** The account's data, or null when it has no account. */
export function accountData(userId: string): AccountData | null {
  return db.transaction(() => {
    const account = getAccount(userId);
    if (!account) return null;
    const projects = listProjects(userId).map((project) => ({
      ...project,
      uploads: allUploads(userId, project.id),
      phrasings: (phrasingsOf.all({ userId, projectId: project.id }) as PhrasingRow[]).map(toPhrasing),
      cards: listCards(userId, project.id)!.map((card): CardData => {
        const { lesson, reps } = getCard(userId, card.id)!;
        return { ...card, lesson, reps };
      }),
    }));
    return { exportedAt: iso(Date.now()), account, projects };
  })();
}
