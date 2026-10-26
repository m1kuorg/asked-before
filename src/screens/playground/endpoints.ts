// What the playground knows of each endpoint beyond its docs row. The list
// itself is AREAS (src/pages/docs/reference.ts), the one list check:docs
// holds to the server's routes; this adds, by "METHOD /path", the classes
// m1kuorg/basics#77 sets apart: the endpoints that would end or replace this
// session or the account and so don't run here, with the reason and where the
// app does it; what a model-spending one costs, in words, and its second
// click; what a DELETE confirms, naming the object; the notes said before a
// send; the example body, built from the learner's own data; how the SDK
// takes its inputs; and which field an id in its answer fills. An endpoint
// the docs gain and this lacks runs as a plain one, its body {}.

import { AREAS, type Endpoint } from "@/pages/docs/reference";

/** The path's ids a response can fill, by their :param names. */
export type Param = "shelfId" | "uploadId" | "cardId" | "repId" | "keyId";

/** A field a click in a response fills: a path id, or a list's cursor from its `next`. */
export type Fillable = Param | "cursor";

/** What a field is called on screen. */
export const FIELD_NAMES: Record<Fillable, string> = {
  shelfId: "Shelf",
  uploadId: "Upload id",
  cardId: "Card id",
  repId: "Cold rep id",
  keyId: "Key id",
  cursor: "Cursor",
};

/** A query parameter a GET reads beyond limit and cursor, such as search's q: its name, what it's called on screen, its hint, and the value it opens with. */
export type QueryField = { name: string; label: string; hint: string; example?: () => string; /** An id of yours: one that isn't yours is a 404. */ id?: true };

/** A spending endpoint's second click: the question, the action, and its cost in words. */
type Spend = { title: string; action: string; cost: string };

type Extra = {
  /** Why it doesn't run here, and where the app does it instead. */
  off?: { reason: string; where: string; link?: { href: string; label: string } };
  spends?: Spend;
  /** A DELETE's confirmation: the app's verb for it and what goes. */
  deletes?: { verb: "Delete" | "Revoke"; noun: "shelf" | "upload" | "key"; body: string };
  /** Said under the address before it's sent. */
  note?: string;
  /** The example body; none for a POST that reads none ({} is still sent). */
  body?: (own: { shelfName: string | undefined }) => unknown;
  noBody?: true;
  /** The SDK's argument after the path's ids, when it isn't the body itself, such as rename's name. */
  sdkArg?: (body: Record<string, unknown>) => unknown;
  /** What the whole answer is, so its top-level id fills that field. */
  returns?: Param;
  /** The shared guest gets 403 here: the account's own data and its keys. */
  notGuest?: true;
  /** Takes limit and cursor. */
  paged?: true;
  /** The other query parameters it reads, each a text field. */
  query?: QueryField[];
};

const TO_SETTINGS = { href: "/app/settings", label: "Settings, Account" };
const SHARED = "the 20 a day the whole app shares, with everyone";
const SORT_COST = `one per 300 of its new messages, plus one: 2 for the demo export, and none for an empty upload. Each is asked up to twice more when an answer breaks a rule, and they come from ${SHARED}`;
const EXAMPLE_QUESTION = "How do I undo my last git commit but keep the changes?";

const EXTRAS: Record<string, Extra> = {
  "POST /auth/signup": { off: { reason: "It would start a new account's session in place of this one.", where: "The sign-up page does it.", link: { href: "/signup", label: "Sign up" } } },
  "POST /auth/login": { off: { reason: "It would replace this session with a new one.", where: "The log-in page does it.", link: { href: "/login", label: "Log in" } } },
  "POST /auth/guest": { off: { reason: "It would replace this session with the shared guest's.", where: "The log-in page does it.", link: { href: "/login", label: "Log in" } } },
  "POST /auth/logout": { off: { reason: "It would end this session, and the playground with it.", where: "Log out sits under your name at the foot of the sidebar." } },
  "PATCH /account": { off: { reason: "A new email ends every other session, and it needs your password, which never leaves the page.", where: "Settings does it.", link: TO_SETTINGS } },
  "POST /account/password": { off: { reason: "It ends every other session, and password tries are throttled.", where: "Settings does it.", link: TO_SETTINGS } },
  "DELETE /account": { off: { reason: "It deletes your account and everything in it, and ends every session.", where: "Settings does it, last.", link: { href: "/app/settings/data", label: "Settings, Your data" } } },
  "GET /account/export": { notGuest: true },
  "GET /keys": { notGuest: true },
  "POST /keys": {
    notGuest: true,
    note: "Its answer holds the new key whole, in the response below, shown this once. It's never put in the code or kept anywhere, and it's gone when you leave. Revoke it in Settings, API keys, once you're done with it.",
    body: () => ({ name: "Playground" }),
    returns: "keyId",
  },
  "DELETE /keys/:keyId": { notGuest: true, deletes: { verb: "Revoke", noun: "key", body: "Anything that uses this key loses access to your shelves at once. It can't be undone." } },
  "POST /shelves": { body: () => ({ name: "Side projects" }), returns: "shelfId" },
  "GET /shelves/:shelfId": { returns: "shelfId" },
  "PATCH /shelves/:shelfId": { body: ({ shelfName }) => ({ name: shelfName ?? "Work" }), sdkArg: (body) => body.name, returns: "shelfId" },
  "DELETE /shelves/:shelfId": { deletes: { verb: "Delete", noun: "shelf", body: "It deletes the shelf and everything on it: its uploads, every message, and its cards with their cold reps. It can't be undone." } },
  "GET /shelves/:shelfId/uploads": { paged: true },
  "POST /shelves/:shelfId/uploads": { body: () => ({ source: "claude", fileName: "conversations.json" }), returns: "uploadId" },
  "GET /uploads/:uploadId": { returns: "uploadId" },
  "POST /uploads/:uploadId/phrasings": {
    note: "Every phrasing it carries counts toward the 8,000 messages a day the whole app takes, shared by everyone.",
    body: () => ({ phrasings: [{ sourceId: "playground-1", text: EXAMPLE_QUESTION, time: new Date().toISOString() }] }),
    sdkArg: (body) => body.phrasings,
    returns: "uploadId",
  },
  "POST /uploads/:uploadId/finish": {
    noBody: true,
    spends: { title: "Finish this upload and start its sort?", action: "Finish and sort", cost: `Finishing it starts its sort, which spends model requests: ${SORT_COST}.` },
    returns: "uploadId",
  },
  "POST /uploads/:uploadId/retry": {
    noBody: true,
    spends: { title: "Sort this upload again?", action: "Sort it again", cost: `It sorts again from the first message no sort has seen, which spends model requests: ${SORT_COST}.` },
    returns: "uploadId",
  },
  "DELETE /uploads/:uploadId": { deletes: { verb: "Delete", noun: "upload", body: "It deletes the upload and its messages. A card left with fewer than two asks goes too, with its cold reps. It can't be undone." } },
  "GET /shelves/:shelfId/unsorted": { paged: true },
  "GET /cards/:cardId": { returns: "cardId" },
  "POST /shelves/:shelfId/captures": {
    body: () => ({ text: EXAMPLE_QUESTION }),
    spends: {
      title: "Record this capture?",
      action: "Record it",
      cost: `It's free when its words match a phrasing on one of the shelf's cards. Otherwise it spends 1 model request, asked up to twice more when an answer breaks a rule, from ${SHARED}. It also counts toward the 8,000 messages a day the whole app takes.`,
    },
  },
  "POST /cards/:cardId/reps": { noBody: true, spends: { title: "Start a cold rep on this card?", action: "Start it", cost: `It spends 1 model request, from ${SHARED}.` } },
  "GET /search": {
    query: [
      { name: "q", label: "Words", hint: "Every one must be in the message: up to 8 words of 2 or more characters.", example: () => "git commit" },
      { name: "shelfId", label: FIELD_NAMES.shelfId, hint: "Leave it empty to search every shelf.", id: true },
    ],
  },
  "GET /analysis": {
    query: [
      { name: "timeZone", label: "Time zone", hint: "The IANA time zone its months are counted in, such as Europe/Berlin. Yours fills it.", example: () => Intl.DateTimeFormat().resolvedOptions().timeZone },
      { name: "shelfId", label: "Shelf", hint: "Count one shelf of yours, or leave it empty for every shelf.", id: true },
    ],
  },
  "POST /reps/:repId/check": {
    body: () => ({ answer: "git reset --soft HEAD~1" }),
    spends: { title: "Check this answer?", action: "Check it", cost: `It spends 1 model request, from ${SHARED}. A cold rep is checked once.` },
  },
};

export type Entry = Endpoint & Extra & {
  /** "GET /shelves": the endpoint's name here and in ?endpoint=. */
  id: string;
  area: string;
  /** Its :params, in path order. */
  params: Param[];
};

const paramsOf = (path: string) => [...path.matchAll(/:(\w+)/g)].map((match) => match[1] as Param);

/** Every endpoint, by the docs' areas. */
export const GROUPS: { area: string; entries: Entry[] }[] = AREAS.map(({ area, endpoints }) => ({
  area,
  entries: endpoints.map((endpoint) => {
    const id = `${endpoint.method} ${endpoint.path}`;
    return { ...endpoint, ...EXTRAS[id], id, area, params: paramsOf(endpoint.path) };
  }),
}));

export const ENTRIES = GROUPS.flatMap((group) => group.entries);

/** What opens when ?endpoint= names none, or none that exists. */
export const FIRST = ENTRIES.find((entry) => entry.id === "GET /shelves")!;

export const entryOf = (id: string | null) => ENTRIES.find((entry) => entry.id === id);

/** The playground's own address for an endpoint, readable: /app/playground?endpoint=GET%20/shelves/:shelfId. */
export const hrefOf = (entry: Entry) => `/app/playground?endpoint=${encodeURIComponent(entry.id).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;

/** Whether it sends a JSON body: every POST and PATCH does, {} at least, as the server asks of the page. */
export const sendsBody = (entry: Entry) => entry.method === "POST" || entry.method === "PATCH";

/** The endpoints that ask the model while the request waits: a model failure is their 502, and the daily cap their 429. */
const ASKS_MODEL = new Set(["POST /shelves/:shelfId/captures", "POST /cards/:cardId/reps", "POST /reps/:repId/check"]);
/** The ones with a size limit on what they carry: a phrasing, a chunk, a capture, an answer. */
const HAS_LIMIT = new Set(["POST /uploads/:uploadId/phrasings", "POST /shelves/:shelfId/captures", "POST /reps/:repId/check"]);

/**
 * The statuses it can answer, from its docs row and its class: its success
 * (201 or 204 when the docs say so), then the errors of the docs' status
 * table that reach it. A sort's own failure isn't one: it runs after
 * finish answers, and shows on the upload.
 */
export function answers(entry: Entry): number[] {
  const list = [/\b201\b/.test(entry.does) ? 201 : /\b204\b/.test(entry.does) ? 204 : 200];
  if ((sendsBody(entry) && !entry.noBody) || entry.paged || entry.query) list.push(400);
  if (entry.who !== "None") list.push(401);
  if (entry.who === "Session only" || entry.notGuest) list.push(403);
  if (entry.params.length || entry.query?.some((field) => field.id)) list.push(404);
  if (/\b409\b/.test(entry.does)) list.push(409);
  if (HAS_LIMIT.has(entry.id)) list.push(413);
  if (ASKS_MODEL.has(entry.id) || entry.id === "POST /uploads/:uploadId/phrasings") list.push(429);
  if (ASKS_MODEL.has(entry.id)) list.push(502);
  return list;
}

/** The field an id in an answer fills, by the key it sits under. */
const BY_KEY: Record<string, Param> = { shelfId: "shelfId", uploadId: "uploadId", cardId: "cardId", repId: "repId", keyId: "keyId" };

/** What an object under this key is, so its `id` fills that field: a shelf under "shelves" or "shelf", a card under "mostBorrowed". */
const BY_CONTAINER: Record<string, Param> = {
  shelves: "shelfId",
  shelf: "shelfId",
  uploads: "uploadId",
  upload: "uploadId",
  cards: "cardId",
  card: "cardId",
  mostBorrowed: "cardId",
  latestReturns: "cardId",
  reps: "repId",
  rep: "repId",
  keys: "keyId",
};

export const kindOf = (container: string | null): Param | null => (container && BY_CONTAINER[container]) || null;

/** The field a string at `key`, in an object of kind `kind`, fills, if any. */
export function fillsField(key: string, kind: Param | null): Fillable | null {
  if (key === "id") return kind;
  if (key === "next") return "cursor";
  return BY_KEY[key] ?? null;
}
