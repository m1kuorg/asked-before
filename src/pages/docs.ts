// The docs page (m1kuorg/basics#51): how to reach your cards from your own
// scripts and agents. It mounts into #app like every screen, from the
// shared parts: the contents in the margin, and in the block the API (its
// credentials, conventions, errors, and daily caps), every endpoint in rows
// by area, the sort window's known limit, the SDK's quickstart, the MCP
// server, and the Claude Code plugin. Setup snippets come from connect.ts
// with this server's address filled in, and the quickstart is the example
// file the docs check runs. `bun run check:docs` holds the endpoint rows to
// the server's route table.

import { MAX_CHUNK, MAX_PHRASING_LENGTH } from "@asked-before/sdk";
import { connectSnippets, MCP_ENV, PLACEHOLDERS, PLUGIN, SERVER_NAME } from "../../packages/mcp/src/connect";
import { codeBlock } from "../parts/code-block";
import { el, link, type Child } from "../parts/dom";
import { frame } from "../parts/frame";
import { count } from "../parts/library";
import { rows, type RowsOptions } from "../parts/rows";
import { sdkQuickstart } from "./sdk-quickstart" with { type: "macro" };

const SERVER = location.origin;
const snippets = connectSnippets(SERVER);

/** A word or line of code inside prose, set in the text family like every code block. */
const code = (text: string) => el("code", undefined, text);
const p = (...children: Child[]) => el("p", undefined, ...children);
const h3 = (title: string) => el("h3", undefined, title);

type Section = { id: string; title: string; body: Child[] };

// The API.

type Who = "Key or session" | "Session only" | "None";
type Endpoint = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; sdk: string; who: Who; does: string };

const KEY = "Key or session";
const SESSION = "Session only";

/** Every endpoint, by the spec's areas; paths are under /api/v1. */
const AREAS: { area: string; endpoints: Endpoint[] }[] = [
  {
    area: "Auth",
    endpoints: [
      {
        method: "POST",
        path: "/auth/signup",
        sdk: "auth.signUp",
        who: "None",
        does: "Signs up with { name, email, passwordKey } and starts a session: 201 with { account, next }. The SDK takes a password of 10 to 200 characters and sends only its key. An email that has an account already is a 409. It must come from the page, with its Origin, and allows 20 tries from one network in 15 minutes, and 3 accounts from one network a day.",
      },
      {
        method: "POST",
        path: "/auth/login",
        sdk: "auth.logIn",
        who: "None",
        does: "Logs in with { email, passwordKey } and starts a session: { account, next }. A wrong email and a wrong password get the same 401. It must come from the page, and shares signing up's tries.",
      },
      { method: "POST", path: "/auth/logout", sdk: "auth.logOut", who: SESSION, does: "Ends this session: 204." },
      { method: "GET", path: "/auth/me", sdk: "auth.me", who: KEY, does: "The account: { id, name, email, createdAt }." },
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
      { method: "DELETE", path: "/account", sdk: "account.delete", who: SESSION, does: "Deletes the account and everything in it with { passwordKey }, and ends every session: 204. A wrong password is a 403. What it deletes stays in the backups of Cloudflare, Asked Before's host, for up to 30 days." },
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
    area: "Health",
    endpoints: [{ method: "GET", path: "/health", sdk: "health.check", who: "None", does: "{ ok: true } while the server is up." }],
  },
];

const STATUSES: [string, string][] = [
  ["400", "The body or query isn't valid. The message names the first problem."],
  ["401", "No session or key came with the request, the key is wrong or revoked, or the email or password is wrong."],
  ["403", "An API key on an endpoint that needs a session; a cookie request that changes something without the page's Origin or a JSON body; or a wrong password when changing it or deleting the account."],
  ["404", "There's no such endpoint, or the shelf, upload, card, key, or cold rep isn't yours. Another account's is a 404 at any depth."],
  ["409", "A conflict: an email that has an account, an upload finished already, a retry of a sort that hasn't failed, or a cold rep checked already."],
  ["413", `A phrasing or capture over ${count(MAX_PHRASING_LENGTH)} characters, an append over ${count(MAX_CHUNK)} phrasings, or an answer over 4,000 characters.`],
  ["429", "Too many sign-up or log-in tries from one network, or password tries on one account, 20 in 15 minutes; a network's accounts for the day are made; or a daily cap is spent: the account's or the app's model requests, or its phrasings, or the share of the app's that accounts made today get."],
  ["500", "The server failed. Its message says nothing more."],
  ["502", "The model failed. Nothing was stored, so send the request again."],
];

/** A list of rows, with the class the docs page sets its columns by. */
function table<T>(className: string, options: RowsOptions<T>): HTMLTableElement {
  const node = rows(options);
  node.classList.add(className);
  return node;
}

function api(): Section {
  return {
    id: "api",
    title: "The API",
    body: [
      p("The page, the SDK, and the MCP server all use one HTTP API, version 1. It speaks JSON under ", code(`${SERVER}/api/v1`), ", and a failure is a status other than 2xx with { error }, a message safe to show."),
      h3("Credentials"),
      p(
        "Scripts and agents send an API key from Settings with every request, as ",
        code("Authorization: Bearer ab_<id>_<secret>"),
        ". When a key comes with a request, the session cookie is ignored. A wrong or revoked key is a 401.",
      ),
      p("A key can read your shelves, cards, uploads, and the Desk, and make shelves, uploads, captures, and cold reps. Deleting anything, downloading your data, managing keys, and changing the account need a session: a key gets 403 there."),
      p("The page uses the session cookie that logging in sets, for 30 days. A cookie request that changes something must carry the page's Origin and a JSON body, or it's a 403, so another site can't act for you."),
      p(
        "Your password never leaves your computer. Wherever the API takes it, it takes a password key instead: scrypt of the password, in Unicode's NFC form, with N=2^14, r=8, and p=5, salted with ",
        code("asked-before/1:"),
        " and the account's email, trimmed and lowercased, as 32 bytes in 64 lowercase hex digits. The SDK derives it, and exports ",
        code("passwordKey(password, email)"),
        " for any other client.",
      ),
      h3("Conventions"),
      p("Times are ISO timestamps, and ids are opaque strings. A list comes inside an object, such as { shelves }. A list that can grow without bound comes a page at a time, newest first: pass ", code("limit"), " (1 to 100, 50 by default), and ", code("cursor"), ", the ", code("next"), " of the page before, which is null on the last page."),
      p(
        "A phrasing is sent as { sourceId, text, time } and nothing else: the export's own message id, your words, and when you sent them. It has at most ",
        count(MAX_PHRASING_LENGTH),
        " characters, and a time more than 5 minutes after the server's clock is a 400. A card's status is ",
        code("borrowed"),
        ", ",
        code("returned"),
        ", or ",
        code("borrowed_again"),
        ".",
      ),
      h3("Errors"),
      table("docs-statuses", { caption: "Error statuses", columns: [{ label: "Status", className: "is-status", cell: ([status]) => status }, { label: "When", cell: ([, when]) => when }], items: STATUSES }),
      h3("The daily caps"),
      p("Daily caps, each counted per UTC day, keep Asked Before inside Cloudflare's free plan, and keep new accounts from spending a day's share for everyone else. Each is a setting of the server's, given here with its default."),
      p(
        "Every model request counts toward your account's cap, 10 a day (",
        code("DAILY_MODEL_REQUESTS"),
        "), and the app's, 200 a day across every account (",
        code("SITE_DAILY_MODEL_REQUESTS"),
        "). An upload's sort makes one request per batch of up to 300 phrasings, and one more for its last pass over the unsorted, each asked up to twice more when an answer breaks a rule: so the demo export takes 2, and an upload of 2,000 phrasings 8. A capture the model places makes one; so do starting a cold rep and checking an answer.",
      ),
      p(
        "Every phrasing sent counts toward your account's cap, 1,000 a day, uploads and captures together (",
        code("DAILY_PHRASINGS"),
        "), and the app's, 8,000 a day across every account (",
        code("SITE_DAILY_PHRASINGS"),
        "). A chunk counts every phrasing it carries, even one the shelf holds already, since recording that the upload sent it writes too. So an export bigger than a day's phrasings is carried on the next day in the same upload, with Try again on the upload page.",
      ),
      p(
        "An account on its first day, the UTC day it was made, reaches only part of the app's caps: 100 a day of the app's model requests (",
        code("FIRST_DAY_SITE_DAILY_MODEL_REQUESTS"),
        "), and 4,000 a day of its phrasings (",
        code("FIRST_DAY_SITE_DAILY_PHRASINGS"),
        "). Once the app has counted that many today, across every account, an account made today gets a 429, while older accounts carry on up to the app's whole cap.",
      ),
      p("Past a cap, the request is a 429 and counts toward neither: a chunk stores none of its phrasings and can be sent again, a sort fails with that message and can be retried, and a capture is lost unless it's sent again. More open at midnight UTC."),
      p(
        "Signing up and logging in count tries by network: an IPv4 address, or an IPv6 address's /64, since one connection is usually given a whole /64. Sign-ups are capped at 3 a day from one network (",
        code("NETWORK_DAILY_SIGNUPS"),
        "), counting only the accounts made.",
      ),
    ],
  };
}

function endpoints(): Section {
  return {
    id: "endpoints",
    title: "Endpoints",
    body: [
      p("Every path is under ", code("/api/v1"), ". Each row gives the SDK's method under its path, and the credential it needs: an API key or a session, a session only, or none."),
      ...AREAS.flatMap(({ area, endpoints }) => [
        h3(area),
        table("docs-endpoints", {
          caption: `${area} endpoints`,
          columns: [
            { label: "Endpoint", className: "is-endpoint", cell: (e) => [el("span", "docs-endpoint", el("b", undefined, e.method), " ", e.path), el("span", "docs-sdk", `${e.sdk}()`)] },
            { label: "Credential", className: "is-who", cell: (e) => e.who },
            { label: "What it does", cell: (e) => e.does },
          ],
          items: endpoints,
        }),
      ]),
    ],
  };
}

function sortWindow(): Section {
  return {
    id: "sort-window",
    title: "The sort window",
    body: [
      p(
        "An upload is sorted in batches. Each batch carries up to ",
        code("SORT_BATCH_SIZE"),
        " (300) new phrasings, plus up to as many of the shelf's most recent unsorted ones, and later batches see the cards earlier ones made. Once the batches are done, a last pass offers those most recent unsorted phrasings again, against the cards as they stand then and each other, so one an earlier batch left unsorted can still join a card a later batch made. So an older unsorted phrasing is compared again only while it's inside that window. This is a known limit: once 300 or more unsorted phrasings dated after it are on the shelf, a new phrasing that asks the same thing can wait unsorted beside it instead of making a card.",
      ),
      p("A capture is compared with the shelf's cards and its 50 most recent unsorted phrasings."),
    ],
  };
}

// The SDK.

function sdk(): Section {
  return {
    id: "sdk",
    title: "The SDK",
    body: [
      p("The TypeScript SDK has one method per endpoint, with typed inputs and results. It also has the export readers the upload page uses: they read a ChatGPT or Claude export on your computer, in Bun, Node, or a browser, so a script sends only your own words, as the page does."),
      p("It isn't on npm yet. In a copy of Asked Before it's the workspace package ", code("@asked-before/sdk"), ". To use it in your own code, build it in your copy with ", code("bun run build:sdk"), ", which writes JavaScript and type declarations to ", code("packages/sdk/dist"), " for Bun, Node, or a bundler, then add it from there: ", code("bun add /path/to/asked-before/packages/sdk"), "."),
      codeBlock("Quickstart", sdkQuickstart()),
      p("It reads your export, uploads it onto a new shelf, waits for the sort, and lists the shelf's cards. In a copy of Asked Before it's ", code("packages/sdk/examples/quickstart.ts"), ". Run it with your server's address, a key from Settings, and your export:"),
      codeBlock("Run the quickstart", `ASKED_BEFORE_URL=${SERVER} ASKED_BEFORE_API_KEY=${PLACEHOLDERS.apiKey} \\\n  bun quickstart.ts conversations.json`),
      p("Node 23.6 or later runs it too, as ", code("node quickstart.ts conversations.json"), "."),
      h3("Errors"),
      p(
        "A failed request throws ",
        code("ApiError"),
        ", with the HTTP status and the server's message, as in ",
        code("error instanceof ApiError && error.status === 404"),
        ". An export the readers can't use throws ",
        code("ExportError"),
        ", whose message names the field, never your words.",
      ),
    ],
  };
}

// The MCP server.

const TOOLS: [string, string][] = [
  ["list_shelves", "Lists your shelves, each with its cards and how many are borrowed, returned, and borrowed again, and says which is the default."],
  ["list_cards", "Lists a shelf's cards, most borrowed first; with not_returned, only those still waiting for a cold rep."],
  ["record_question", "Records a question in your own words as a capture, and says whether it landed on a card you asked before, with its count and status, or waits unsorted."],
  ["start_cold_rep", "Starts a cold rep on a card: the problem, and the lesson on its first cold rep or after a failed one."],
  ["check_answer", "Checks your answer to a cold rep, as you wrote it: the verdict, the reason, and the card's status."],
];

const SETTINGS: [string, string][] = [
  [MCP_ENV.url, `Your Asked Before server's address, such as ${SERVER}.`],
  [MCP_ENV.apiKey, "An API key from Settings."],
  [MCP_ENV.shelf, "Optional: the shelf, by name or id, that the tools use when a call names none."],
];

function mcp(): Section {
  const whichBun = `For ${PLACEHOLDERS.bun}, put the path that the command "which bun" prints.`;
  return {
    id: "mcp",
    title: "The MCP server",
    body: [
      p("Asked Before's MCP server lets an agent record your how-to questions as captures, as you ask them, and run cold reps in the chat. It runs on your computer over stdio and reaches your Asked Before server with an API key. Its tools tell the agent to send only your own words: never its answer, your code, or secrets."),
      h3("Tools"),
      table("docs-tools", { caption: "The MCP server's tools", columns: [{ label: "Tool", className: "is-name", cell: ([name]) => code(name) }, { label: "What it does", cell: ([, does]) => does }], items: TOOLS }),
      p("A tool that works on a shelf takes it by name or id, or else uses the default shelf. Recording a question the model has to place, starting a cold rep, and checking an answer each count toward your daily cap. Past it, the tool answers with an error, and a question it couldn't record is lost unless the agent sends it again."),
      h3("Settings"),
      table("docs-tools", { caption: "The MCP server's settings", columns: [{ label: "Setting", className: "is-name", cell: ([name]) => code(name) }, { label: "What it holds", cell: ([, holds]) => holds }], items: SETTINGS }),
      p("Without the address or the key, the server exits at once, naming them."),
      h3("Set it up"),
      p(
        "In Claude Code, install ",
        link("the plugin", "#plugin"),
        ". Without it, and in Claude Desktop and Cursor, the server runs from a copy of Asked Before: clone it and run bun install. In each snippet, put your copy's folder for ",
        code(PLACEHOLDERS.clone),
        ", and a key from Settings for ",
        code(PLACEHOLDERS.apiKey),
        ".",
      ),
      codeBlock("Claude Code without the plugin", snippets.claudeCode),
      p("Run it in a terminal."),
      codeBlock("Claude Desktop", snippets.claudeDesktop),
      p(`In Claude Desktop, open Settings, then Developer, then Edit Config, and add it to claude_desktop_config.json. ${whichBun} Then restart Claude Desktop.`),
      codeBlock("Cursor", snippets.cursor),
      p(`Add it to ~/.cursor/mcp.json, or to .cursor/mcp.json in one repository. ${whichBun}`),
    ],
  };
}

// The Claude Code plugin.

function plugin(): Section {
  const tool = `mcp__plugin_${PLUGIN.id.split("@")[0]}_${SERVER_NAME}__`;
  return {
    id: "plugin",
    title: "The Claude Code plugin",
    body: [
      p(
        "The Asked Before plugin brings the MCP server and a skill to Claude Code in one install. It comes from the marketplace in Asked Before's repository on GitHub, ",
        code(PLUGIN.marketplace),
        ", and carries a single-file build of the server, which runs on Node.js 20 or later.",
      ),
      codeBlock("Claude Code plugin", snippets.claudeCodePlugin),
      p("Run it in a terminal, with a key from Settings for ", code(PLACEHOLDERS.apiKey), ", then start a new Claude Code session. To pick a default shelf too, add ", code(`--config ${PLUGIN.options.shelf}=Work`), "."),
      h3("The skill"),
      p("The skill tells Claude Code when to use the tools:"),
      el(
        "ul",
        "docs-list",
        el("li", undefined, "When you ask how to do something, it records your question in your own words, never its answer, your code, or secrets."),
        el("li", undefined, "When the question is on a card you asked before, it says how many times you've borrowed it, and offers a cold rep before it answers."),
        el("li", undefined, "During a cold rep, it shows the problem as written, gives no hints and no answer, and passes on your answer as you wrote it."),
      ),
      h3("Permissions"),
      p("Claude Code asks before it uses a tool, unless a permission rule allows it. In permission rules, the tools are named ", code(`${tool}<tool>`), ", such as ", code(`${tool}record_question`), "."),
      h3("From a copy"),
      p("After a change to the MCP server or the SDK, ", code("bun run build:plugin"), " rebuilds the plugin's server, and ", code("bun run check:plugin"), " checks the plugin and its server."),
    ],
  };
}

const sections = [api(), endpoints(), sortWindow(), sdk(), mcp(), plugin()];

const root = document.querySelector<HTMLElement>("#app")!;
const { block } = frame(root, [
  el("h2", undefined, "Contents"),
  el("ol", "docs-contents", ...sections.map(({ id, title }) => el("li", undefined, link(title, `#${id}`)))),
  p("Every endpoint here is under ", code(`${SERVER}/api/v1`), ", this server's API."),
]);
block.append(
  el("h1", undefined, "Docs"),
  p("How to reach your cards from your own scripts and agents: the API, the SDK, the MCP server, and the Claude Code plugin."),
  ...sections.map(({ id, title, body }) => {
    const node = el("section", "docs-section", el("h2", undefined, title), ...body);
    node.id = id;
    return node;
  }),
);
// The page is drawn after load, so a link to a section scrolls once it's there.
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
