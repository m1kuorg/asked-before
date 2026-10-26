import { createClient, MAX_CHUNK, readExport } from "@asked-before/sdk";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

// Your Asked Before server, and an API key from its Settings page.
const client = createClient({
  baseUrl: process.env.ASKED_BEFORE_URL,
  apiKey: process.env.ASKED_BEFORE_API_KEY,
});

// Read a ChatGPT or Claude export (its .zip or conversations.json) on this
// computer: only your own messages are kept, with when you sent them.
const file = process.argv[2]!;
const { source, phrasings, skipped } = await readExport(await readFile(file));
console.log(`${phrasings.length} of your messages, ${skipped} skipped as too long.`);

// Upload them onto a shelf: create the upload, send its phrasings in
// chunks, then finish it, which starts the sort.
const shelf = await client.shelves.create({ name: "Work" });
let upload = await client.uploads.create(shelf.id, { source, fileName: basename(file) });
for (let i = 0; i < phrasings.length; i += MAX_CHUNK) {
  await client.uploads.append(upload.id, phrasings.slice(i, i + MAX_CHUNK));
}
upload = await client.uploads.finish(upload.id);

// Wait for the sort to place them onto cards.
while (upload.status === "waiting" || upload.status === "sorting") {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  upload = await client.uploads.get(upload.id);
}
if (upload.status === "failed") throw new Error(`The sort failed: ${upload.error}`);

// List the shelf's cards, most asked first, each with its status: the word
// the app shows for it, then the API's name.
const onScreen = { borrowed: "To prove", returned: "Proven", borrowed_again: "Asked since proven" };
for (const card of await client.cards.list(shelf.id)) {
  console.log(`${card.skill}: asked ${card.count} times, ${onScreen[card.status]} (${card.status})`);
}
