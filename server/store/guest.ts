// The guest workspace's daily reset (m1kuorg/basics#73): once each UTC
// day, the shared Guest account's shelves, with their uploads, phrasings,
// cards, and reps, are deleted, and its demo shelf is given back already
// sorted, from demo/sorted.json, the demo export as the real sort once
// placed it, so the reset asks the model nothing. The cron runs it every
// five minutes (worker/index.ts), so the first run after midnight UTC
// resets the day, and so does signing in as a guest (api/auth.ts), so a
// workspace the cron hasn't reached yet, as on `bun run dev`, has its demo
// shelf too. `site_usage.guest_reset` marks the day done; every other run
// that day reads that one row and writes nothing. Guests' sessions are
// left alone, so every guest stays signed in.
// Deleting a phrasing writes about 6 of D1's rows, with its indexes and its
// upload's record of it, so the phrasings deleted count toward the new
// day's phrasings (store/usage.ts), and the cap keeps the wipe inside D1's
// rows written a day too.

import sorted from "../../demo/sorted.json";
import { newId, slices, type Db } from "./db";
import { GUEST_ID } from "./users";

type SortedDemo = {
  upload: { source: "chatgpt" | "claude"; fileName: string };
  cards: { skill: string; phrasings: string[] }[];
  phrasings: { sourceId: string; text: string; time: string }[];
};

const DEMO: SortedDemo = sorted as SortedDemo;

/** Resets the guest workspace, unless it has been reset already on `now`'s UTC day. One batch, so it's whole or nothing. */
export async function resetGuestWorkspace(db: Db, now: number): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  if (await db.prepare("SELECT 1 FROM site_usage WHERE day = ?1 AND guest_reset = 1").bind(day).first()) return;

  const at = Date.now();
  const shelfId = newId();
  const uploadId = newId();
  const cardOf = new Map<string, string>();
  const cards = DEMO.cards.map(({ skill, phrasings }) => {
    const id = newId();
    for (const sourceId of phrasings) cardOf.set(sourceId, id);
    return [id, skill];
  });
  const phrasings = DEMO.phrasings.map(({ sourceId, text, time }) => [newId(), sourceId, text, Date.parse(time), cardOf.get(sourceId) ?? null]);

  // Every statement holds only while the day isn't reset yet: the deletes and the shelf by saying so, and the rest
  // by the new shelf they're made in, which only this batch can have made.
  const due = "NOT EXISTS (SELECT 1 FROM site_usage WHERE day = ?1 AND guest_reset = 1)";
  const guestShelves = "SELECT id FROM shelves WHERE user_id = ?2";
  await db.batch([
    db
      .prepare(
        `INSERT INTO site_usage (day, phrasings) SELECT ?1, n FROM (SELECT count(*) AS n FROM phrasings WHERE shelf_id IN (${guestShelves})) WHERE ${due}
         ON CONFLICT (day) DO UPDATE SET phrasings = phrasings + excluded.phrasings`,
      )
      .bind(day, GUEST_ID),
    // The phrasings go before their cards, so deleting a card needn't empty each one's card_id on the way.
    db.prepare(`DELETE FROM phrasings WHERE shelf_id IN (${guestShelves}) AND ${due}`).bind(day, GUEST_ID),
    db.prepare(`DELETE FROM shelves WHERE user_id = ?2 AND ${due}`).bind(day, GUEST_ID),
    db.prepare(`INSERT INTO shelves (id, user_id, name, demo, created_at) SELECT ?3, id, 'Demo', 1, ?4 FROM users WHERE id = ?2 AND ${due}`).bind(day, GUEST_ID, shelfId, at),
    db
      .prepare("INSERT INTO uploads (id, shelf_id, source, file_name, status, created_at, finished_at) SELECT ?2, id, ?3, ?4, 'sorted', ?5, ?5 FROM shelves WHERE id = ?1")
      .bind(shelfId, uploadId, DEMO.upload.source, DEMO.upload.fileName, at),
    ...slices(cards).map((list) =>
      db.prepare("INSERT INTO cards (id, shelf_id, skill, created_at) SELECT j.value ->> 0, s.id, j.value ->> 1, ?3 FROM shelves s, json_each(?2) j WHERE s.id = ?1").bind(shelfId, list, at),
    ),
    ...slices(phrasings).flatMap((list) => [
      db.prepare("INSERT INTO upload_messages (upload_id, source_id) SELECT u.id, j.value ->> 1 FROM uploads u, json_each(?2) j WHERE u.id = ?1").bind(uploadId, list),
      db
        .prepare(
          `INSERT INTO phrasings (id, shelf_id, origin, upload_id, source_id, text, time, card_id, offered_at, created_at)
           SELECT j.value ->> 0, u.shelf_id, 'export', u.id, j.value ->> 1, j.value ->> 2, j.value ->> 3, j.value ->> 4, ?3, ?3
           FROM uploads u, json_each(?2) j WHERE u.id = ?1`,
        )
        .bind(uploadId, list, at),
    ]),
    db.prepare(`INSERT INTO site_usage (day, guest_reset) SELECT ?1, 1 WHERE ${due} ON CONFLICT (day) DO UPDATE SET guest_reset = 1`).bind(day),
  ]);
}
