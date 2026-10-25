// The privacy page's ten sections, every one in the page at once, as the
// docs page's are: what leaves your computer, what the model sees, what's
// stored and where, the one cookie, no analytics or third parties, the logs,
// the guest workspace, API keys, downloading and deleting, and backups; and
// its rail, "In short", six of their facts, each linking to its section.
// Every sentence is what the code does or what the docs, the landing, and
// the app already say; the comment over each section names its sources.
// The lines with privacy weight come from copy.ts, word for word, and the
// numbers and names from the code that holds them. Of Anthropic and
// Cloudflare it says only what Asked Before's own code and README record:
// who they are, and Cloudflare's backup window. check:chrome reads the
// sections, and compares the table in the first with the landing's.

import type { ReactNode } from "react";
import { cn } from "cn";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "../../../server/security";
import { TextLink } from "@/components/text-link";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_KEY_POWERS, DATABASE_HOLDS, GUEST_NOTE, onlyYourWords } from "@/lib/copy";
import { count } from "@/lib/format";
import { MAX_PHRASING_LENGTH } from "@asked-before/sdk";
import type { Section } from "../read-mode/page";
import { C, H3, P, Panel } from "../read-mode/prose";

/** The model the server asks, as server/model.ts names it; check:chrome holds the two together. */
export const MODEL_ID = "claude-haiku-5-5";

/** Every line the server logs, as server/http.ts's answer() writes it; check:chrome holds the two together. */
export const LOG_LINE = "<method> <path> <status> <duration>ms";

/** How long the session lasts, as server/store/sessions.ts's SESSION_DAYS sets it (check:chrome holds the two together): the cookie section and the rail say it. */
const SESSION_LASTS = "30 days, or until you log out";
/** LANDING_PRIVACY_NOTE's second sentence: the logs section opens with it, and the rail says it. */
const LOGS_NOTE = "The server logs requests, never your words.";


/**
 * What leaves your computer, and what the model sees of it: the landing's proof table, row for row
 * (src/pages/landing/chapters.tsx, PROOF_ROWS; check:chrome compares the two pages' tables).
 */
const LEAVES: [what: string, leaves: string, model: string][] = [
  ["Your own messages", "Yes", "Your words only"],
  ["When you sent them", "Yes", "Never"],
  ["Each message's id in the export, so a re-upload isn't counted twice", "Yes", "Never"],
  ["The chatbot's answers", "Never", "Never"],
  ["Conversation titles", "Never", "Never"],
  ["System and tool messages", "Never", "Never"],
  [`Messages over ${count(MAX_PHRASING_LENGTH)} characters`, "Never", "Never"],
];

/** The table on the panel tone, as the docs set theirs. Under 768px each row stacks: what it is, then its two answers, each naming its column. */
function LeavesTable() {
  return (
    <Panel>
      <Table className="privacy-leaves table-fixed max-md:block">
        <TableCaption className="sr-only">What leaves your computer when you upload a chat export, and what the model sees</TableCaption>
        <TableHeader className="max-md:sr-only">
          <TableRow>
            <TableHead className="text-sm">What</TableHead>
            <TableHead className="w-[10.5rem] text-sm">Leaves your computer</TableHead>
            <TableHead className="w-[8rem] text-sm">The model sees it</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-md:block">
          {LEAVES.map(([what, leaves, model]) => (
            <TableRow key={what} className="max-md:flex max-md:flex-col max-md:gap-1 max-md:py-4">
              <TableCell className="align-top font-medium whitespace-normal max-md:p-0">{what}</TableCell>
              <TableCell className="align-top max-md:p-0 max-md:text-muted-foreground max-md:before:content-['Leaves_your_computer:_']">{leaves}</TableCell>
              <TableCell className="align-top max-md:p-0 max-md:text-muted-foreground max-md:before:content-['The_model_sees_it:_']">{model}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** Reference material on the panel tone, as the docs' tables are: a name, then what it is. `code` sets the names in the monospace. */
function Pairs({ caption, name, what, rows, code = false }: { caption: string; name: string; what: string; rows: [string, ReactNode][]; code?: boolean }) {
  return (
    <Panel>
      <Table className="table-fixed">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={cn("text-sm sm:w-[13rem]", code ? "w-[42%]" : "w-[36%]")}>{name}</TableHead>
            <TableHead className="text-sm">{what}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="align-top font-medium break-words whitespace-normal">
                {code ? (
                  <code translate="no" className="whitespace-nowrap">
                    {key}
                  </code>
                ) : (
                  key
                )}
              </TableCell>
              <TableCell className="align-top whitespace-normal">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

// Sources: READ_LOCALLY (src/lib/copy.ts: "It's read here, on this computer.") and the upload page's preview (src/screens/upload/preview.tsx: what it reads,
// and the messages over MAX_PHRASING_LENGTH that stay); the landing's proof table; the docs' Conventions (a phrasing is
// { sourceId, text, time }) and MCP server (what its tools tell the agent, and check_answer's answer); the upload's
// { source, fileName } (packages/sdk/src/uploads.ts); the docs' Credentials and server/passwords.ts.
const leaves: Section = {
  id: "leaves",
  title: "What leaves your computer",
  body: (
    <>
      <P>
        When you upload a chat export, it's read on your computer, and the page shows you what it will send before anything is sent. Only your own messages go, each as its words, when you sent it, and the export's own id for it. The upload itself carries the export's file name and which chatbot it came from.
      </P>
      <LeavesTable />
      <P>A message over {count(MAX_PHRASING_LENGTH)} characters, often a pasted log or file, stays on your computer too.</P>
      <H3>From your agent</H3>
      <P>The MCP server and the Claude Code plugin send a question as you ask it, as a capture: your words, which the server dates as they arrive. When you answer a cold rep through them, they send your answer as you wrote it. {onlyYourWords("Their")}</P>
      <H3>Your password</H3>
      <P>Your password never leaves your computer. The page derives a key from it with scrypt and sends that in its place, and the server keeps only a salted SHA-256 of the key.</P>
    </>
  ),
};

// Sources: server/model.ts (MODEL, and askStructured: every request is the server's, with its own key); server/sort.ts
// (a sort sees phrasings cut to 300 characters, the cards as skills and three phrasings, never a time; a capture's
// window, CAPTURE_WINDOW); server/api/captures.ts (the same words as a card's phrasing join it without the model);
// server/reps.ts (writeRep: the skill, up to 20 phrasings, the earlier problems; judge: the skill, the problem, the
// answer); PRIVACY_LINE.
const model: Section = {
  id: "model",
  title: "What the model sees",
  body: (
    <>
      <P>
        The model is Claude, <C>{MODEL_ID}</C>, from Anthropic, which Asked Before's server asks through Anthropic's API with its own key. Your browser never talks to it. It sees your words only, never your dates, and only what each request needs:
      </P>
      <Pairs
        caption="What each model request sees"
        name="Request"
        what="What the model sees"
        rows={[
          ["Sorting an upload", "The words of its messages and of the shelf's most recent unsorted ones, each cut to its first 300 characters, and the shelf's cards, each as its skill and three of its messages."],
          ["Placing a capture", "Its words, the same way, against the shelf's cards and its 50 most recent unsorted messages. Words that match a message on a card join that card without asking the model."],
          ["Writing a cold rep", "The card's skill, the first 300 characters of each of its 20 most recent messages, and the problems it was given before."],
          ["Checking your answer", "The card's skill, the problem, and your answer as you wrote it."],
        ]}
      />
      <P>No request carries your name, your email, a time, or your account.</P>
    </>
  ),
};

// Sources: wrangler.jsonc (d1_databases: the one D1 database); migrations/0001_schema.sql (each table's columns);
// server/passwords.ts (the password key's salted SHA-256); server/store/keys.ts and server/store/sessions.ts (only
// hashes); server/store/throttle.ts and server/api/auth.ts (tries counted per network, or per account for a password
// check, in 15-minute windows, swept by the next try once they've ended); "Cloudflare, Asked Before's host" is copy.ts's.
const stored: Section = {
  id: "stored",
  title: "What's stored",
  body: (
    <>
      <P>Everything Asked Before keeps about you is in one database on Cloudflare D1. Cloudflare is Asked Before's host. Each shelf's sort also keeps an alarm, and nothing of yours, in a Durable Object of its own.</P>
      <Pairs
        caption="What the database holds"
        name="What"
        what="What's kept"
        rows={DATABASE_HOLDS}
      />
    </>
  ),
};

// Sources: server/auth.ts (cookieName: __Host-session on https, session otherwise; sessionCookie: Path=/, HttpOnly,
// SameSite=Lax, Secure on https); server/store/sessions.ts (SESSION_DAYS, the token's SHA-256); SESSION_LOG_IN
// (src/lib/copy.ts); src/lib/signed-in.ts (the local storage hint); src/screens/card/rep-panel.tsx (the answer's
// draft in sessionStorage until it's checked).
const cookie: Section = {
  id: "cookie",
  title: "The one cookie",
  body: (
    <>
      <P>Logging in, signing up, or signing in as a guest sets one cookie, the session:</P>
      <Pairs
        caption="The session cookie"
        name="Its name and flags"
        what="What they mean"
        code
        rows={[
          [
            "__Host-session",
            <>
              Its name. It holds a random token, and the server keeps only the token's SHA-256. A copy of Asked Before whose address isn't https names it <C>session</C>.
            </>,
          ],
          ["Path=/", "Every page and API answer of Asked Before's address gets it."],
          ["Max-Age", `${SESSION_LASTS}.`],
          ["HttpOnly", "No script on the page can read it."],
          ["Secure", "It's sent only over https; a copy whose address isn't https leaves this out."],
          ["SameSite=Lax", "Other sites' requests don't carry it, only a link you follow to Asked Before."],
        ]}
      />
      <P>
        The page also keeps one note in your browser's local storage, <C>asked-before:signed-in</C>, which says only that this browser signed in, so the landing page can offer to open the app. It holds no token, and logging out removes it.
      </P>
      <P>
        While you write the answer to a cold rep, the card's page keeps it in this tab's session storage, so a reload doesn't lose it, and removes it once the answer is checked.
      </P>
    </>
  ),
};

// Sources: server/security.ts (CONTENT_SECURITY_POLICY and SECURITY_HEADERS, on every page through _headers and on
// every API answer through server/http.ts); src/styles/globals.css (the fonts are files at /fonts/).
const thirdParties: Section = {
  id: "no-analytics",
  title: "No analytics",
  body: (
    <>
      <P>There are no analytics, ads, or trackers, and nothing on the pages comes from another site: even the fonts are files Asked Before serves itself. Every page, and every answer from the API, comes with this content security policy, so your browser itself won't load anything from another address or let the page's scripts reach one:</P>
      {/* One directive a line, so none breaks inside a word; check:chrome joins them back into the header. */}
      <figure className="privacy-csp flex min-w-0 flex-col gap-2">
        <figcaption className="text-sm font-medium">Content security policy</figcaption>
        <pre translate="no" className="overflow-x-auto rounded-2xl bg-muted p-5 text-sm leading-6">
          <code>{CONTENT_SECURITY_POLICY.split("; ").join(";\n")}</code>
        </pre>
      </figure>
      <P>
        Its referrer policy is <C>{SECURITY_HEADERS["referrer-policy"]}</C>, so following a link away from Asked Before doesn't tell the site you go to which page you came from.
      </P>
    </>
  ),
};

// Sources: LANDING_PRIVACY_NOTE (src/lib/copy.ts, its second sentence, which the landing shows as it is); server/http.ts (answer(): one line per request, the method, path,
// status, and duration, never a body or an error); worker/index.ts (the cron logs nothing); wrangler.jsonc
// (observability: enabled false).
const logs: Section = {
  id: "logs",
  title: "The logs",
  body: (
    <>
      <P>{LOGS_NOTE}</P>
      <P>For each request to the API it logs one line, and nothing else: the method, the path, the status, and how long it took.</P>
      <figure className="privacy-log flex min-w-0 flex-col gap-2">
        <figcaption className="text-sm font-medium">A line of the log</figcaption>
        <pre translate="no" className="overflow-x-auto rounded-2xl bg-muted p-5 text-sm leading-6">
          <code>{LOG_LINE}</code>
        </pre>
      </figure>
      <P>A path can hold the id of a shelf, a card, or an upload, never its words. Nothing from a request's body is logged, and no error. The daily wipe of the guest workspace, and the sorts the server starts again on its own, log nothing.</P>
      <P>Workers observability, Cloudflare's place to keep those lines, is turned off in Asked Before's settings.</P>
    </>
  ),
};

// Sources: GUEST_NOTE and GUEST_UPLOAD_WARNING (src/lib/copy.ts); server/store/guest.ts (what the wipe deletes and
// gives back, from demo/sorted.json, so it asks the model nothing; guests' sessions are left alone); server/auth.ts
// (notGuest: no settings or keys).
const guest: Section = {
  id: "guest",
  title: "The guest workspace",
  body: (
    <>
      <P>{GUEST_NOTE}</P>
      <P>Each day's wipe deletes every shelf in it, with their uploads, messages, cards, and cold reps, then puts back the demo shelf, already sorted, so it asks the model nothing. Guests stay signed in.</P>
      <P>So an export uploaded as a guest is seen by every guest until the wipe, and stays in Cloudflare's backups for up to 30 days after it. Sign up to keep an export to yourself. A guest has no account settings and no API keys.</P>
    </>
  ),
};

// Sources: server/store/keys.ts (the id and the secret's SHA-256, never the secret; the last use stamped at most once a
// minute; revoking deletes); API_KEY_POWERS (src/lib/copy.ts); server/auth.ts (a Bearer key ignores the cookie;
// notGuest).
const keys: Section = {
  id: "keys",
  title: "API keys",
  body: (
    <>
      <P>An API key lets your own scripts and agents reach your shelves. It's shown once, when you make it: Asked Before keeps its name, its id, and a SHA-256 of its secret, never the secret, so a lost key can't be shown again. Revoke it and make another.</P>
      <P>{API_KEY_POWERS}</P>
      <P>Each key's last use is stamped, at most once a minute, and shown beside it in Settings. Revoking a key deletes it, so it stops working at once.</P>
    </>
  ),
};

// Sources: server/store/throttle.ts (tries have no tie to the account, and go with the next try after their window);
// BACKUPS_YOUR_DATA and BACKUPS_DELETING (src/lib/copy.ts), without their line on the backups, which the
// Backups section says once; server/store/account-data.ts (what the download holds); the docs' DELETE /account
// (src/pages/docs/reference.ts: the password key, and every session ended); the app's route /app/settings/data
// (src/app/router.tsx).
const yourData: Section = {
  id: "your-data",
  title: "Your data",
  body: (
    <>
      <Pairs
        caption="Downloading and deleting your data"
        name="What"
        what="What it does"
        rows={[
          ["Download your data", "One JSON file of everything Asked Before keeps for you: your account, your shelves and their uploads, every message, and your cards with their lessons and cold reps. Your API keys, sessions, and password aren't in it."],
          ["Delete your account", "Deletes everything Asked Before keeps for you, and logs out every browser signed in to it. Only the count of tries on it goes later, with the next try after its 15-minute window ends. It takes your password, and it can't be undone, so download your data first if you want to keep it."],
        ]}
      />
      <P>
        Both are in the app, in <TextLink href="/app/settings/data">Settings, under Your data</TextLink>. What you delete stays in Cloudflare's <TextLink href="#backups">backups</TextLink> for up to 30 days.
      </P>
    </>
  ),
};

// Sources: BACKUPS_DOCS, BACKUPS_DELETING, and GUEST_UPLOAD_WARNING (src/lib/copy.ts); docs/adr/0005 (anything a
// learner deletes stays in Cloudflare's backups for up to 30 days); README.md, Installation step 6 (Time Travel's 7 days on
// Free and 30 on Paid, and that it can't be turned off).
const backups: Section = {
  id: "backups",
  title: "Backups",
  body: (
    <>
      <P>Anything deleted, by you or by the guest workspace's daily wipe, stays in the backups of Cloudflare, Asked Before's host, for up to 30 days. That holds for a shelf, an upload, or a key you delete, and for a whole account.</P>
      <P>The backups are D1's Time Travel, which can't be turned off. It keeps 7 days of the database's history on Cloudflare's free plan, which Asked Before runs on, and 30 on a paid one.</P>
    </>
  ),
};

export const SECTIONS: Section[] = [leaves, model, stored, cookie, thirdParties, logs, guest, keys, yourData, backups];

/** The rail, "In short": one fact each from six sections, which that section proves, linking there; the cookie's and the logs' are the sections' own words. */
export const IN_SHORT = (
  [
    [leaves, "An upload shows you what it sends before it sends anything."],
    [model, "The model sees your words only, never your name, email, or dates."],
    [cookie, `One cookie, the session, for ${SESSION_LASTS}.`],
    [thirdParties, "No analytics, ads, or trackers, and nothing on the pages from another site."],
    [logs, LOGS_NOTE],
    [backups, "Anything deleted stays in Cloudflare's backups for up to 30 days."],
  ] as const
).map(([section, text]) => ({ href: `#${section.id}`, text }));
