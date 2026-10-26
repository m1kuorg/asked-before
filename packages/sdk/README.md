# Asked Before SDK

`@asked-before/sdk` is the TypeScript client for Asked Before's HTTP API, version 1: one method per endpoint, with typed inputs and results. It also has the export readers, which read a ChatGPT or Claude export into your own phrasings on your computer, in Bun, Node, or a browser, so a script sends only your own words, as the upload page does. The page itself reaches the server through it.

Contents:

1. [Install it](#install-it)
1. [Quickstart](#quickstart)
1. [The client](#the-client)
1. [Errors](#errors)
1. [The export readers](#the-export-readers)

## Install it

It isn't on npm yet. In a copy of Asked Before it's the workspace package `@asked-before/sdk`, run from its TypeScript sources. To use it in your own code, build it in your copy, which writes JavaScript and type declarations to `packages/sdk/dist`, then add it from there:

```sh
cd /path/to/asked-before && bun run build:sdk
cd /path/to/your-app && bun add /path/to/asked-before/packages/sdk
```

The build is what your code imports, in Bun, Node, or a bundler for the browser, with its types under both bundler and Node module resolution. Build it again after you pull a newer copy.

## Quickstart

This reads your export, uploads it onto a new shelf, waits for the sort, and lists the shelf's cards:

```ts
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
```

Run it with your Asked Before server's address, an API key from its Settings page, and your export. In a copy of Asked Before it's `packages/sdk/examples/quickstart.ts`: `bun run check:docs` runs it there, and `bun run check:sdk` runs it in a scratch package against the build, in Bun and in Node.

```sh
ASKED_BEFORE_URL=https://asked-before.example ASKED_BEFORE_API_KEY=YOUR_API_KEY \
  bun quickstart.ts conversations.json
```

Node 23.6 or later runs it too, as `node quickstart.ts conversations.json`.

## The client

`createClient({ baseUrl, apiKey })` makes a client for the server at `baseUrl` that sends `apiKey` as a Bearer token. In the page, `createClient()` calls its own origin with the session cookie instead. Pass `fetch` to send requests through your own.

The client has one group of methods per area of the API: `auth`, `account`, `keys`, `shelves`, `uploads`, `cards`, `captures`, `reps`, `desk`, and `health`. Each method calls one endpoint, such as `shelves.list()` for `GET /api/v1/shelves`. The docs page at `/docs` on any Asked Before server lists every endpoint with its method, the credential it needs, and what it answers.

A list comes back as an array, such as `Shelf[]`. A list that can grow without bound, `uploads.list` or `cards.unsorted`, comes a page at a time, newest first: pass `{ limit, cursor }`, with the `next` of the page before as the cursor, until `next` is null.

An API key can read shelves, cards, uploads, and the Desk, and make shelves, uploads, captures, and cold reps. Renaming a shelf, deleting anything, downloading your data, managing keys, and changing the account need a session, so a key gets 403 there.

A password never leaves your computer. `auth.signUp`, `auth.logIn`, and the `account` methods that take a password send the key `passwordKey(password, email)` derives from it with scrypt instead, which takes about a tenth of a second. A new email changes that key, so `account.update` needs the password with a new email. The SDK holds a new password to 10 to 200 characters, and throws `ApiError` with a 400 before sending anything when it breaks that.

## Errors

A failed request throws `ApiError`, with the HTTP `status` and the server's `message`:

```ts
import { ApiError } from "@asked-before/sdk";

try {
  await client.cards.get(cardId);
} catch (error) {
  if (error instanceof ApiError && error.status === 404) console.log("There's no such card.");
  else throw error;
}
```

## The export readers

`readExport(input)` takes a chat export as a `File` or `Blob`, its bytes, or its JSON text, and gives `{ source, phrasings, skipped }`:

- `source` is `"chatgpt"` or `"claude"`, told from the conversations' shape.
- `phrasings` are your own messages as `{ sourceId, text, time }`: the export's own message id, your words, and when you sent them. Nothing else is read: no answers, titles, or system and tool messages.
- `skipped` counts your messages over `MAX_PHRASING_LENGTH` (2,000) characters, often pasted logs, which are left out.

A zip is read from its directory, inflating only its `conversations.json` or its numbered `conversations-NNN.json` shards, so an export full of images never has to fit in memory. ChatGPT's conversations are walked from their current message, so edited-away branches don't count. An export the reader can't use throws `ExportError`, whose message names the field, never your words.

Send phrasings with `uploads.append`, at most `MAX_CHUNK` (500) at a time. Every phrasing an upload is sent, and each capture, counts toward the server's daily caps; past one, a request throws `ApiError` with a 429, and a chunk stores none of its phrasings.
