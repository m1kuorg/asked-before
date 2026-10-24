// Every line of copy with product, legal, or privacy weight, word for word
// (inventory.md, "Copy with product, legal, or privacy weight"), and the
// redesign's status words and queue words (brief sections 2 and 7). Import
// these rather than retyping them; checks compare several exactly. No JSX and
// no "@/" imports here: scripts/check-upload-page.ts imports this file too.

import type { CardStatus, Source } from "@asked-before/sdk";

/** Wherever your messages are about to leave, or have left: the upload page, the shelf, the card, the landing page. */
export const PRIVACY_LINE =
  "Only your own messages, with when you sent them, leave this computer. The chatbot's answers and your titles never do, and the model sees your words only, never your dates.";
export const LANDING_PRIVACY_NOTE = "System and tool messages stay too. The server logs requests, never your words.";
export const READ_LOCALLY = "It's read here, on this computer.";

export const BACKUPS_YOUR_DATA =
  "Download everything Asked Before keeps for you as one JSON file: your account, your shelves and their uploads, every phrasing, and your cards with their lessons and cold reps. Your API keys and password aren't in it. Anything you delete stays in the backups of Cloudflare, Asked Before's host, for up to 30 days.";
export const BACKUPS_DELETING =
  "Deleting your account deletes everything Asked Before keeps for you, though it stays in the backups of Cloudflare, Asked Before's host, for up to 30 days. It can't be undone, so download your data first if you want to keep it.";
export const BACKUPS_DOCS = "What it deletes stays in the backups of Cloudflare, Asked Before's host, for up to 30 days.";

/** What the database holds, row by row: the privacy page's "What the database holds" and Your data's "What Asked Before keeps". */
export const DATABASE_HOLDS: [what: string, kept: string][] = [
  ["Your account", "Your name, your email, and a salted SHA-256 of your password's key."],
  ["Shelves and uploads", "Each shelf's name, and each upload's file name, which chatbot's export it was, and how its sort went."],
  ["Messages", "Each one's words, when you sent it, and the export's id for it."],
  ["Cards and cold reps", "Each card's skill and lesson, and each cold rep's problem, your answer, its verdict, and the reason."],
  ["API keys", "Each key's name, when it was made and last used, and a SHA-256 of its secret, never the secret."],
  ["Sessions", "A SHA-256 of each cookie's token, never the token, and when the session ends."],
  [
    "Tries",
    "For signing up, logging in, and signing in as a guest, the network a try came from (an IPv4 address, or an IPv6 address's /64) and its count; for a password check in Settings, a count for your account. Each is kept for a window of 15 minutes, and the next try after it ends deletes it.",
  ],
];

/** Beside a demo shelf's name, and on every piece of demo content, wherever it shows. */
export const DEMO_DATA = "Demo data";

export const GUEST_NAME = "Shared guest";
/** Wherever signing in as a guest is offered: log in, sign up, the landing page. */
export const GUEST_NOTE =
  "Every guest shares one workspace, with the demo shelf already sorted: guests see each other's uploads and cold reps, and it's wiped daily at midnight UTC.";
/** Under "Shared guest" in the app's user row, as visible text. */
export const GUEST_LINE = "Every guest shares this workspace, and it's wiped daily at midnight UTC.";
export const GUEST_UPLOAD_WARNING =
  "You're signed in as the shared guest, so every guest will see what you upload here, with its cards and cold reps. The guest workspace is wiped daily at midnight UTC, though Cloudflare's backups keep it for up to 30 days. Sign up to keep an export to yourself.";
export const GUEST_SETTINGS_TITLE = "Settings are for your own account";
export const GUEST_SETTINGS_BODY =
  "Sign up for an account of your own to have a profile, a password, API keys for your agents, and shelves only you see, which you can download or delete.";

/** The server's own messages for the daily caps and the throttle; shown as they arrive, quoted here for checks and the landing's FAQ. */
export const MODEL_CAP = "Asked Before has used today's model requests for everyone. More open at midnight UTC.";
export const PHRASINGS_CAP = "These phrasings would pass what Asked Before can take today for everyone. More open at midnight UTC.";
export const THROTTLE = "Too many tries. Wait a few minutes, then try again.";

export const API_KEY_SHOWN_ONCE = "Copy this key now: it's shown only this once. Anything that has it can reach your shelves.";
export const API_KEY_POWERS =
  "A key can read your shelves and add to them, but it can't rename or delete anything, download your data, manage keys, or change your account.";

/** What the MCP server does, first in the docs' MCP section and as Connect your AI's lede. */
export const MCP_SERVER_DOES = "Asked Before's MCP server lets an agent record your how-to questions as captures, as you ask them, and run cold reps in the chat.";
/** What the MCP server's tools ask the agent to send, in the docs, Connect your AI, and the privacy page: "Its" of the server, "Their" of it and the plugin. */
export const onlyYourWords = (whose: "Its" | "Their") => `${whose} tools tell the agent to send only your own words: never its answer, your code, or secrets.`;
/** Which MCP tools spend the app's model requests, in the docs' MCP section and Connect your AI's rail. */
export const MCP_MODEL_REQUESTS =
  "Recording a question the model has to place, starting a cold rep, and checking an answer each count toward the app's daily cap of model requests, which is for the whole app, guests included.";

export const SESSION_LOG_IN = "Once you log in, this browser stays logged in for 30 days, or until you log out.";
export const SESSION_SIGN_UP = "Once you sign up, this browser stays logged in for 30 days, or until you log out.";

/** The cold rep's answer box label. */
export const ANSWER_LABEL = "Your answer, in your own words, without AI";

/** What any failure that isn't the API's own answer says: the network, or the server unreachable. */
export const CONNECTION_FAILURE = "Asked Before couldn't be reached. Check your connection, then try again.";

export const NOT_FOUND_TITLE = "This page doesn't exist";
export const NOT_FOUND_BODY = "Nothing is filed at this address. It may be mistyped, or the page may have moved.";

/** The new status words, by the API's status (brief section 2). StatusPill and status.ts use them. */
export const STATUS_WORDS: Record<CardStatus, string> = {
  borrowed: "To prove",
  returned: "Proven",
  borrowed_again: "Asked since proven",
};
export const STATUS_NOTE =
  "A card stays To prove until you pass a cold rep on it, which marks it Proven. Ask it again after that and it's Asked since proven, and needs a fresh cold rep.";
/** Said once, on Home. */
export const COLD_REP_GLOSS = "a cold rep is a fresh problem of the same skill, answered without AI";

/** The one verb for the rep action; its accessible name names the card. */
export const START_REP = "Start a cold rep";
export const startRepName = (skill: string) => `Start a cold rep on ${skill}`;

/** The queue (To prove plus Asked since proven): "4 cards need a cold rep", "1 card needs a cold rep". */
export const needRep = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "card needs" : "cards need"} a cold rep`;
/** The Shelves table's column for that queue. */
export const NEED_REP_COLUMN = "Need a rep";
/** The shelf's view of messages nothing else asks yet (never "asked once": the sort misses some repeats). */
export const NOT_ON_A_CARD = "Not on a card";

/** Each export's chatbot, by name. */
export const SOURCE_NAMES: Record<Source, string> = { chatgpt: "ChatGPT", claude: "Claude" };
