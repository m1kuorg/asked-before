// The docs page (m1kuorg/basics#51): how to reach your cards from your own
// scripts and agents. It mounts into #app like every screen, from the
// shared parts: the contents in the margin, and in the block the API (its
// credentials, conventions, errors, and daily cap), every endpoint in rows
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
import { rows, type RowsOptions } from "../parts/rows";
import { sdkQuickstart } from "./sdk-quickstart" with { type: "macro" };

const SERVER = location.origin;
const snippets = connectSnippets(SERVER);
const n = (count: number) => count.toLocaleString("en-US");

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
        does: "Signs up with { name, email, password } and starts a session: 201 with { account, next }. A password has 10 to 200 characters, and an email that has an account already is a 409. It must come from the page, with its Origin, and allows 20 tries from one address in 15 minutes.",
      },
      {
        method: "POST",
        path: "/auth/login",
        sdk: "auth.logIn",
        who: "None",
        does: "Logs in with { email, password } and starts a session: { account, next }. A wrong email and a wrong password get the same 401. It must come from the page, and shares signing up's tries.",
      },
      { method: "POST", path: "/auth/logout", sdk: "auth.logOut", who: SESSION, does: "Ends this session: 204." },
      { method: "GET", path: "/auth/me", sdk: "auth.me", who: KEY, does: "The account: { id, name, email, createdAt }." },
    ],
  },
  {
    area: "Account",
    endpoints: [
      { method: "PATCH", path: "/account", sdk: "account.update", who: SESSION, does: "Changes { name, email }, either or both: the account. An email another account has is a 409." },
      {
        method: "POST",
        path: "/account/password",
        sdk: "account.changePassword",
        who: SESSION,
        does: "Changes the password with { currentPassword, newPassword }: 204. A wrong current password is a 403. Every other session ends.",
      },
      {
        method: "GET",
        path: "/account/export",
        sdk: "account.export",
        who: SESSION,
        does: "All your data as one JSON value: the account, and each project with its uploads, every phrasing, and its cards with their lessons and cold reps. No API key or password is in it.",
      },
      { method: "DELETE", path: "/account", sdk: "account.delete", who: SESSION, does: "Deletes the account and everything in it with { password }, and ends every session: 204. A wrong password is a 403." },
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
    area: "Projects",
    endpoints: [
      { method: "GET", path: "/projects", sdk: "projects.list", who: KEY, does: "{ projects }: each with its counts of cards, borrowed, returned, and borrowed again, and when its latest upload was made." },
      { method: "POST", path: "/projects", sdk: "projects.create", who: KEY, does: "Makes a project named { name }, of 1 to 80 characters, or a demo project with demo: true: 201 with the project." },
      { method: "GET", path: "/projects/:projectId", sdk: "projects.get", who: KEY, does: "The project, with its counts." },
      { method: "PATCH", path: "/projects/:projectId", sdk: "projects.rename", who: SESSION, does: "Renames it with { name }: the project." },
      { method: "DELETE", path: "/projects/:projectId", sdk: "projects.delete", who: SESSION, does: "Deletes the project and everything in it: 204." },
    ],
  },
  {
    area: "Uploads",
    endpoints: [
      { method: "GET", path: "/projects/:projectId/uploads", sdk: "uploads.list", who: KEY, does: "The project's uploads, a page at a time, newest first: { uploads, next }." },
      {
        method: "POST",
        path: "/projects/:projectId/uploads",
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
        does: `Appends { phrasings }, up to ${n(MAX_CHUNK)} at a time: the upload. A phrasing whose sourceId the project holds already is skipped, so the same export uploaded twice stores nothing new, unless an upload that never finished holds it: then it joins this upload, to be sorted with it. A finished upload is a 409.`,
      },
      {
        method: "POST",
        path: "/uploads/:uploadId/finish",
        sdk: "uploads.finish",
        who: KEY,
        does: "Finishes the upload and starts its project's sort: the upload, waiting. Get the upload again to follow the sort. Finishing it twice is a 409.",
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
        path: "/projects/:projectId/cards",
        sdk: "cards.list",
        who: KEY,
        does: "{ cards }, most borrowed first, ties to the later last borrow: each card's skill, status, count, first and last borrow, and return stamp.",
      },
      { method: "GET", path: "/projects/:projectId/unsorted", sdk: "cards.unsorted", who: KEY, does: "The project's unsorted phrasings, a page at a time, newest first: { phrasings, next }." },
      { method: "GET", path: "/cards/:cardId", sdk: "cards.get", who: KEY, does: "The card with its lesson, its borrows, oldest first, and its cold reps." },
    ],
  },
  {
    area: "Captures",
    endpoints: [
      {
        method: "POST",
        path: "/projects/:projectId/captures",
        sdk: "captures.create",
        who: KEY,
        does: "Records { text }, one question in your own words, and sorts it at once: 201 with { phrasing, card, alreadyCaptured }, its card the one it landed on, or null while it waits unsorted. The same words in the same project within ten minutes give 200 with that earlier capture, and add no borrow.",
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
    area: "Dashboard",
    endpoints: [
      {
        method: "GET",
        path: "/dashboard",
        sdk: "dashboard.get",
        who: KEY,
        does: "The summary across projects: your cards' totals by status, up to 10 cards not returned, most borrowed first, your 10 latest borrows, and your 10 latest returns.",
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
  ["404", "There's no such endpoint, or the project, upload, card, key, or cold rep isn't yours. Another account's is a 404 at any depth."],
  ["409", "A conflict: an email that has an account, an upload finished already, a retry of a sort that hasn't failed, or a cold rep checked already."],
  ["413", `A phrasing or capture over ${n(MAX_PHRASING_LENGTH)} characters, an append over ${n(MAX_CHUNK)} phrasings, or an answer over 4,000 characters.`],
  ["429", "Too many sign-up or log-in tries from one address, or the account's model requests for the day are spent."],
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
      p("A key can read your projects, cards, uploads, and dashboard, and make projects, uploads, captures, and cold reps. Deleting anything, downloading your data, managing keys, and changing the account need a session: a key gets 403 there."),
      p("The page uses the session cookie that logging in sets, for 30 days. A cookie request that changes something must carry the page's Origin and a JSON body, or it's a 403, so another site can't act for you."),
      h3("Conventions"),
      p("Times are ISO timestamps, and ids are opaque strings. A list comes inside an object, such as { projects }. A list that can grow without bound comes a page at a time, newest first: pass ", code("limit"), " (1 to 100, 50 by default), and ", code("cursor"), ", the ", code("next"), " of the page before, which is null on the last page."),
      p(
        "A phrasing is sent as { sourceId, text, time } and nothing else: the export's own message id, your words, and when you sent them. It has at most ",
        n(MAX_PHRASING_LENGTH),
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
      h3("The daily cap"),
      p(
        "Every model request counts toward your account's daily cap: 300 a day by default (",
        code("DAILY_MODEL_REQUESTS"),
        "), counted per UTC day. A sort makes one request per batch, and up to two more when an answer breaks a rule; a capture the model places makes one; so do starting a cold rep and checking an answer. Past the cap, the request is a 429: a sort fails with that message and can be retried, and a capture is lost unless it's sent again.",
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
        " (300) new phrasings, plus up to as many of the project's most recent unsorted ones, and later batches see the cards earlier ones made. So an older unsorted phrasing is compared again only while it's inside that window. This is a known limit: once 300 or more unsorted phrasings dated after it are in the project, a new phrasing that asks the same thing can wait unsorted beside it instead of making a card.",
      ),
      p("A capture is compared with the project's cards and its 50 most recent unsorted phrasings."),
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
      p("It isn't on npm yet. In a copy of Asked Before it's the workspace package ", code("@asked-before/sdk"), ". To use it in another project, build it in your copy with ", code("bun run build:sdk"), ", which writes JavaScript and type declarations to ", code("packages/sdk/dist"), " for Bun, Node, or a bundler, then add it from there: ", code("bun add /path/to/asked-before/packages/sdk"), "."),
      codeBlock("Quickstart", sdkQuickstart()),
      p("It reads your export, uploads it into a new project, waits for the sort, and lists the project's cards. In a copy of Asked Before it's ", code("packages/sdk/examples/quickstart.ts"), ". Run it with your server's address, a key from Settings, and your export:"),
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
  ["list_projects", "Lists your projects, each with its cards and how many are borrowed, returned, and borrowed again, and says which is the default."],
  ["list_cards", "Lists a project's cards, most borrowed first; with not_returned, only those still waiting for a cold rep."],
  ["record_question", "Records a question in your own words as a capture, and says whether it landed on a card you asked before, with its count and status, or waits unsorted."],
  ["start_cold_rep", "Starts a cold rep on a card: the problem, and the lesson on its first cold rep or after a failed one."],
  ["check_answer", "Checks your answer to a cold rep, as you wrote it: the verdict, the reason, and the card's status."],
];

const SETTINGS: [string, string][] = [
  [MCP_ENV.url, `Your Asked Before server's address, such as ${SERVER}.`],
  [MCP_ENV.apiKey, "An API key from Settings."],
  [MCP_ENV.project, "Optional: the project, by name or id, that the tools use when a call names none."],
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
      p("A tool that works in a project takes it by name or id, or else uses the default project. Recording a question the model has to place, starting a cold rep, and checking an answer each count toward your daily cap. Past it, the tool answers with an error, and a question it couldn't record is lost unless the agent sends it again."),
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
      p(`Add it to ~/.cursor/mcp.json, or to .cursor/mcp.json for one project. ${whichBun}`),
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
      p("Run it in a terminal, with a key from Settings for ", code(PLACEHOLDERS.apiKey), ", then start a new Claude Code session. To pick a default project too, add ", code(`--config ${PLUGIN.options.project}=Work`), "."),
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
