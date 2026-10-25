// The docs page's tables, as data: every endpoint by the spec's areas (paths
// under /api/v1), the error statuses, and the MCP server's tools and
// settings. The endpoint rows are written by hand, not generated:
// `bun run check:docs` holds them to the server's route table (apiRoutes in
// server/api/index.ts), so a new endpoint needs its row here. The API keeps
// its own words (shelves, cards, borrows, returned): this page documents it.

import { MAX_CHUNK, MAX_PHRASING_LENGTH } from "@asked-before/sdk";
import { MCP_ENV } from "../../../packages/mcp/src/connect";
import { count } from "@/lib/format";

export type Who = "Key or session" | "Session only" | "None";
export type Endpoint = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; sdk: string; who: Who; does: string };

const KEY = "Key or session";
const SESSION = "Session only";

export const AREAS: { area: string; endpoints: Endpoint[] }[] = [
  {
    area: "Auth",
    endpoints: [
      {
        method: "POST",
        path: "/auth/signup",
        sdk: "auth.signUp",
        who: "None",
        does: "Signs up with { name, email, passwordKey } and starts a session: 201 with { account, next }. The SDK takes a password of 10 to 200 characters and sends only its key. An email that has an account already is a 409. It must come from the page, with its Origin, and allows 20 tries from one network in 15 minutes.",
      },
      {
        method: "POST",
        path: "/auth/login",
        sdk: "auth.logIn",
        who: "None",
        does: "Logs in with { email, passwordKey } and starts a session: { account, next }. A wrong email and a wrong password get the same 401. It must come from the page, and shares signing up's tries.",
      },
      {
        method: "POST",
        path: "/auth/guest",
        sdk: "auth.signInAsGuest",
        who: "None",
        does: "Signs in as the shared guest, with no password, and starts a session: { account, next }. Every guest shares the Guest account's shelves, cards, uploads, and cold reps, which are wiped at midnight UTC each day, when the demo shelf comes back already sorted. It must come from the page, and allows 20 tries from one network in 15 minutes, apart from signing up's and logging in's.",
      },
      { method: "POST", path: "/auth/logout", sdk: "auth.logOut", who: SESSION, does: "Ends this session: 204." },
      { method: "GET", path: "/auth/me", sdk: "auth.me", who: KEY, does: "The account: { id, name, email, createdAt, guest }, guest true for the shared guest." },
    ],
  },
  {
    area: "Account",
    endpoints: [
      {
        method: "PATCH",
        path: "/account",
        sdk: "account.update",
        who: SESSION,
        does: "Changes { name, email }, either or both: the account. A new email changes the password's key, so it comes with { currentPasswordKey, newPasswordKey }, the key the current email and the new one each make; the SDK takes the password. A wrong password is a 403, and an email another account has a 409. A new email ends every other session.",
      },
      {
        method: "POST",
        path: "/account/password",
        sdk: "account.changePassword",
        who: SESSION,
        does: "Changes the password with { currentPasswordKey, newPasswordKey }: 204. The SDK takes both passwords, a new one of 10 to 200 characters. A wrong current password is a 403. Every other session ends.",
      },
      {
        method: "GET",
        path: "/account/export",
        sdk: "account.export",
        who: SESSION,
        does: "All your data as one JSON value: the account, and each shelf with its uploads, every phrasing, and its cards with their lessons and cold reps. No API key or password is in it.",
      },
      {
        method: "DELETE",
        path: "/account",
        sdk: "account.delete",
        who: SESSION,
        does: "Deletes the account and everything in it with { passwordKey }, and ends every session: 204. A wrong password is a 403. What it deletes stays in the backups of Cloudflare, Asked Before's host, for up to 30 days.",
      },
    ],
  },
  {
    area: "API keys",
    endpoints: [
      { method: "GET", path: "/keys", sdk: "keys.list", who: SESSION, does: "{ keys }: each key's name, its prefix ab_<id>, and when it was made and last used." },
      { method: "POST", path: "/keys", sdk: "keys.create", who: SESSION, does: "Makes a key named { name }, of 1 to 60 characters: 201 with the whole key, ab_<id>_<secret>, shown this once." },
      { method: "DELETE", path: "/keys/:keyId", sdk: "keys.revoke", who: SESSION, does: "Revokes the key at once: 204." },
    ],
  },
  {
    area: "Shelves",
    endpoints: [
      { method: "GET", path: "/shelves", sdk: "shelves.list", who: KEY, does: "{ shelves }: each with its counts of cards, borrowed, returned, and borrowed again, and when its latest upload was made." },
      { method: "POST", path: "/shelves", sdk: "shelves.create", who: KEY, does: "Makes a shelf named { name }, of 1 to 80 characters, or a demo shelf with demo: true: 201 with the shelf." },
      { method: "GET", path: "/shelves/:shelfId", sdk: "shelves.get", who: KEY, does: "The shelf, with its counts." },
      { method: "PATCH", path: "/shelves/:shelfId", sdk: "shelves.rename", who: SESSION, does: "Renames it with { name }: the shelf." },
      { method: "DELETE", path: "/shelves/:shelfId", sdk: "shelves.delete", who: SESSION, does: "Deletes the shelf and everything on it: 204." },
    ],
  },
  {
    area: "Uploads",
    endpoints: [
      { method: "GET", path: "/shelves/:shelfId/uploads", sdk: "uploads.list", who: KEY, does: "The shelf's uploads, a page at a time, newest first: { uploads, next }." },
      {
        method: "POST",
        path: "/shelves/:shelfId/uploads",
        sdk: "uploads.create",
        who: KEY,
        does: "Starts an upload with { source, fileName }, its source chatgpt or claude: 201 with the upload, receiving.",
      },
      {
        method: "GET",
        path: "/uploads/:uploadId",
        sdk: "uploads.get",
        who: KEY,
        does: "The upload: its status (receiving, waiting, sorting, sorted, or failed), how many of your messages it was sent, the new phrasings among them, how many a sort has offered, and a failed sort's error.",
      },
      {
        method: "POST",
        path: "/uploads/:uploadId/phrasings",
        sdk: "uploads.append",
        who: KEY,
        does: `Appends { phrasings }, up to ${count(MAX_CHUNK)} at a time: the upload. A phrasing whose sourceId the shelf holds already is skipped, so the same export uploaded twice stores nothing new, unless an upload that never finished holds it: then it joins this upload, to be sorted with it. A finished upload is a 409, and a chunk past the daily phrasings a 429 that stores none of it.`,
      },
      {
        method: "POST",
        path: "/uploads/:uploadId/finish",
        sdk: "uploads.finish",
        who: KEY,
        does: "Finishes the upload and starts its shelf's sort: the upload, waiting, or failed in the rare case its sort didn't start, which a retry starts again. Get the upload again to follow the sort. Finishing it twice is a 409.",
      },
      {
        method: "POST",
        path: "/uploads/:uploadId/retry",
        sdk: "uploads.retry",
        who: KEY,
        does: "Sorts a failed upload again, from its first phrasing not yet offered: the upload. Anything but a failed sort is a 409.",
      },
      {
        method: "DELETE",
        path: "/uploads/:uploadId",
        sdk: "uploads.delete",
        who: SESSION,
        does: "Deletes the upload and its phrasings: 204. A card left with fewer than two borrows goes too, with its cold reps, and its last phrasing becomes unsorted.",
      },
    ],
  },
  {
    area: "Cards",
    endpoints: [
      {
        method: "GET",
        path: "/shelves/:shelfId/cards",
        sdk: "cards.list",
        who: KEY,
        does: "{ cards }, most borrowed first, ties to the later last borrow: each card's skill, status, count, first and last borrow, and return stamp.",
      },
      { method: "GET", path: "/shelves/:shelfId/unsorted", sdk: "cards.unsorted", who: KEY, does: "The shelf's unsorted phrasings, a page at a time, newest first: { phrasings, next }." },
      { method: "GET", path: "/cards/:cardId", sdk: "cards.get", who: KEY, does: "The card with its lesson, its borrows, oldest first, and its cold reps." },
    ],
  },
  {
    area: "Captures",
    endpoints: [
      {
        method: "POST",
        path: "/shelves/:shelfId/captures",
        sdk: "captures.create",
        who: KEY,
        does: "Records { text }, one question in your own words, and sorts it at once: 201 with { phrasing, card, alreadyCaptured }, its card the one it landed on, or null while it waits unsorted. The same words on the same shelf within ten minutes give 200 with that earlier capture, and add no borrow. Any other counts toward the daily phrasings.",
      },
    ],
  },
  {
    area: "Cold reps",
    endpoints: [
      {
        method: "POST",
        path: "/cards/:cardId/reps",
        sdk: "reps.start",
        who: KEY,
        does: "Starts a cold rep on the card: 201 with { rep, lesson }, the rep holding a fresh problem, and the lesson on the card's first cold rep or after a failed one, else null.",
      },
      {
        method: "POST",
        path: "/reps/:repId/check",
        sdk: "reps.check",
        who: KEY,
        does: "Checks { answer }, of up to 4,000 characters, once: { rep, card }, the rep with its verdict and reason, and the card, stamped returned after a pass. A rep checked already, or one a newer cold rep on its card replaced, is a 409.",
      },
    ],
  },
  {
    area: "Desk",
    endpoints: [
      {
        method: "GET",
        path: "/desk",
        sdk: "desk.get",
        who: KEY,
        does: "The Desk, across your shelves: your cards' totals by status, up to 10 cards not returned, most borrowed first, your 10 latest borrows, and your 10 latest returns.",
      },
    ],
  },
  {
    area: "Search",
    endpoints: [
      {
        method: "GET",
        path: "/search",
        sdk: "search.get",
        who: KEY,
        does: "Your phrasings with every word of ?q= (up to 8 words of 2 or more characters, anywhere in the text, A to Z in any case), across your shelves or on ?shelfId=: { q, words, searched, total, cards, phrasings }, the cards with a match, most matches first, then those whose skill's name has every word, and up to 50 matches, newest first. A q with no such word is a 400.",
      },
    ],
  },
  {
    area: "Analysis",
    endpoints: [
      {
        method: "GET",
        path: "/analysis",
        sdk: "analysis.get",
        who: KEY,
        does: "How you ask, counted by code from your phrasings' own times, your cards, and your cold reps, across your shelves or on one (?shelfId=): your phrasings, on a card or not, and the re-asks among them (borrows after their card's first); every month from the first to the last in the time zone ?timeZone= names (an IANA name, UTC unless given; the SDK sends the runtime's own); the gaps between one borrow and the card's next, as a median, a middle half, and buckets; up to 10 cards, most borrowed first, with their median gaps; cold reps passed and failed by month; how many returned cards were borrowed again; and each shelf's counts. An unknown time zone is a 400, and a shelf that isn't yours a 404.",
      },
    ],
  },
  {
    area: "Roadmap",
    endpoints: [
      {
        method: "GET",
        path: "/roadmap",
        sdk: "roadmap.get",
        who: KEY,
        does: "Your cards across your shelves on a fixed path of 13 developer areas, Terminal and the OS first and Deploy and DevOps last: { areas, elsewhere }. Each area, in path order and empty ones too, has its id, name, about, counts, and cards, most borrowed first. Each card is placed by the words in its name, by code, not the model: its skill name, lowercased, is split into words on anything but letters, digits, # and +; it goes to the area with the most of those words on its list, the earlier on a tie, with matched listing them; a card with none is elsewhere.",
      },
    ],
  },
  {
    area: "Health",
    endpoints: [{ method: "GET", path: "/health", sdk: "health.check", who: "None", does: "{ ok: true } while the server is up." }],
  },
];

export const STATUSES: [string, string][] = [
  ["400", "The body or query isn't valid. The message names the first problem."],
  ["401", "No session or key came with the request, the key is wrong or revoked, or the email or password is wrong."],
  ["403", "An API key on an endpoint that needs a session; the shared guest on the account's endpoints or its keys; a cookie request that changes something without the page's Origin or a JSON body; or a wrong password when changing it or deleting the account."],
  ["404", "There's no such endpoint, or the shelf, upload, card, key, or cold rep isn't yours. Another account's is a 404 at any depth."],
  ["409", "A conflict: an email that has an account, an upload finished already, a retry of a sort that hasn't failed, or a cold rep checked already."],
  ["413", `A phrasing or capture over ${count(MAX_PHRASING_LENGTH)} characters, an append over ${count(MAX_CHUNK)} phrasings, or an answer over 4,000 characters.`],
  ["429", "Too many sign-up or log-in tries from one network, guest sign-ins from one network, or password tries on one account, 20 in 15 minutes; or one of the app's daily caps is spent, its model requests or its phrasings, for everyone."],
  ["500", "The server failed. Its message says nothing more."],
  ["502", "The model failed. Nothing was stored, so send the request again."],
];

export const TOOLS: [string, string][] = [
  ["list_shelves", "Lists your shelves, each with its cards and how many are borrowed, returned, and borrowed again, and says which is the default."],
  ["list_cards", "Lists a shelf's cards, most borrowed first; with not_returned, only those still waiting for a cold rep."],
  ["record_question", "Records a question in your own words as a capture, and says whether it landed on a card you asked before, with its count and status, or waits unsorted."],
  ["start_cold_rep", "Starts a cold rep on a card: the problem, and the lesson on its first cold rep or after a failed one."],
  ["check_answer", "Checks your answer to a cold rep, as you wrote it: the verdict, the reason, and the card's status."],
];

/** The MCP server's settings; `server` is this page's own address, for the example. */
export const mcpSettings = (server: string): [string, string][] => [
  [MCP_ENV.url, `Your Asked Before server's address, such as ${server}.`],
  [MCP_ENV.apiKey, "An API key from Settings."],
  [MCP_ENV.shelf, "Optional: the shelf, by name or id, that the tools use when a call names none."],
];
