// All of an account's data, for its download (m1kuorg/basics#49): the
// account, and each shelf with its uploads, every phrasing in it, and its
// cards with their lessons and cold reps. Shelves, uploads, and cards are
// read through the same functions the API answers with, so the download
// matches what the API shows; the phrasings are read here, all of them,
// whether on a card, unsorted, or still waiting for their sort. It's read
// in one transaction, so a sort or a rep landing meanwhile can't half
// appear. API keys, sessions, and the password hash are never in it.

import type { AccountData, CardData, PhrasingData, Upload } from "@asked-before/sdk";
import { getCard, listCards, toPhrasing, type PhrasingRow } from "./cards";
import { db, iso } from "./db";
import { listShelves } from "./shelves";
import { listUploads } from "./uploads";
import { getAccount } from "./users";

type DataRow = PhrasingRow & { origin: PhrasingData["origin"]; upload_id: string | null; card_id: string | null };

const phrasingsOf = db.query(`
  SELECT f.id, f.source_id, f.text, f.time, f.origin, f.upload_id, f.card_id
  FROM phrasings f JOIN shelves sh ON sh.id = f.shelf_id
  WHERE f.shelf_id = $shelfId AND sh.user_id = $userId
  ORDER BY f.time, f.id
`);

const toPhrasingData = (row: DataRow): PhrasingData => ({ ...toPhrasing(row), origin: row.origin, uploadId: row.upload_id, cardId: row.card_id });

/** Every one of the shelf's uploads, oldest first, a page at a time as the API reads them. */
function allUploads(userId: string, shelfId: string): Upload[] {
  const all: Upload[] = [];
  let cursor: string | undefined;
  do {
    const page = listUploads(userId, shelfId, 500, cursor)!;
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
    const shelves = listShelves(userId).map((shelf) => ({
      ...shelf,
      uploads: allUploads(userId, shelf.id),
      phrasings: (phrasingsOf.all({ userId, shelfId: shelf.id }) as DataRow[]).map(toPhrasingData),
      cards: listCards(userId, shelf.id)!.map((card): CardData => {
        const { lesson, reps } = getCard(userId, card.id)!;
        return { ...card, lesson, reps };
      }),
    }));
    return { exportedAt: iso(Date.now()), account, shelves };
  })();
}
