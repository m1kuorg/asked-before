// The docs page's six sections, every one in the page at once (check:docs
// reads them all): the API (its credentials, conventions, errors, and the
// daily caps for the whole app), every endpoint in tables by area, the sort
// window's known limit, the SDK's quickstart, the MCP server, and the Claude
// Code plugin. Setup snippets come from connect.ts with this server's
// address filled in, and the quickstart is the example file check:docs runs.
// The hooks check:docs reads are kept: .docs-endpoint (one per route, the
// method and path), .docs-statuses, and .code-block code.

import { connectSnippets, PLACEHOLDERS, PLUGIN, SERVER_NAME } from "../../../packages/mcp/src/connect";
import { CopyBlock } from "@/components/copy-block";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import { STATUS_WORDS } from "@/lib/copy";
import { count } from "@/lib/format";
import { MAX_PHRASING_LENGTH } from "@asked-before/sdk";
import { AREAS, mcpSettings, STATUSES, TOOLS, type Endpoint } from "./reference";
import type { Section } from "../read-mode/page";
import { C, H3, P, Panel } from "../read-mode/prose";
import { sdkQuickstart } from "../sdk-quickstart" with { type: "macro" };

const SERVER = location.origin;
const snippets = connectSnippets(SERVER);
const quickstart = sdkQuickstart();

/** A code block to copy, carrying the class check:docs reads; like the tables, it sits on the panel tone, with no outline. */
const Code = ({ caption, code }: { caption: string; code: string }) => (
  <CopyBlock className="code-block max-w-full [&_button]:text-sm [&_pre]:rounded-2xl [&_pre]:border-0 [&_pre]:p-5 [&_pre]:text-sm [&_pre]:leading-6" caption={caption} code={code} />
);

/** A two-column reference table: a name in code, then what it is. */
function Pairs({ caption, name, what, rows, className, code = true }: { caption: string; name: string; what: string; rows: [string, string][]; className?: string; code?: boolean }) {
  return (
    <Panel>
      <Table className={cn("table-fixed", className)}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={cn("text-sm", code ? "w-[42%] sm:w-[16rem]" : "w-16")}>{name}</TableHead>
            <TableHead className="text-sm">{what}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="align-top break-words whitespace-normal">{code ? <code>{key}</code> : key}</TableCell>
              <TableCell className="align-top whitespace-normal">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** One area's endpoints. Under 768px each row stacks: the endpoint and its SDK method, the credential, then what it does. */
function Endpoints({ area, endpoints }: { area: string; endpoints: Endpoint[] }) {
  return (
    <Panel>
      <Table className="docs-endpoints table-fixed max-md:block">
        <TableCaption className="sr-only">{area} endpoints</TableCaption>
        <TableHeader className="max-md:sr-only">
          <TableRow>
            <TableHead className="w-[19rem] text-sm">Endpoint</TableHead>
            <TableHead className="w-[8.5rem] text-sm">Credential</TableHead>
            <TableHead className="text-sm">What it does</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-md:block">
          {endpoints.map((e) => (
            <TableRow key={`${e.method} ${e.path}`} className="max-md:flex max-md:flex-col max-md:gap-1.5 max-md:py-4">
              <TableCell className="align-top max-md:p-0">
                <code className="docs-endpoint block">
                  <b className="font-medium">{e.method}</b> {e.path}
                </code>
                <code className="docs-sdk mt-1 block text-muted-foreground">{e.sdk}()</code>
              </TableCell>
              {/* Stacked, the credential names its column in generated text, so the cell's own text stays exactly the credential. */}
              <TableCell className="align-top text-muted-foreground max-md:p-0 max-md:before:content-['Credential:_']">{e.who}</TableCell>
              <TableCell className="align-top whitespace-normal max-md:p-0">{e.does}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** The API's card statuses, each with the label the app's screens show for it and what it means. */
const CARD_STATUSES: [string, string][] = [
  ["borrowed", `${STATUS_WORDS.borrowed}: no cold rep on it has passed yet.`],
  ["returned", `${STATUS_WORDS.returned}: a cold rep passed after its latest ask.`],
  ["borrowed_again", `${STATUS_WORDS.borrowed_again}: asked again after it was proven, so it needs a fresh cold rep.`],
];

const api: Section = {
  id: "api",
  title: "The API",
  body: (
    <>
      <P>
        The page, the SDK, and the MCP server all use one HTTP API, version 1. It speaks JSON under <C>{`${SERVER}/api/v1`}</C>, and a failure is a status other than 2xx with {"{ error }"}, a message safe to show.
      </P>
      <H3>Credentials</H3>
      <P>
        Scripts and agents send an API key from Settings with every request, as <C>{"Authorization: Bearer ab_<id>_<secret>"}</C>. When a key comes with a request, the session cookie is ignored. A wrong or revoked key is a 401.
      </P>
      <P>A key can read your shelves, cards, uploads, and the Desk, and make shelves, uploads, captures, and cold reps. Deleting anything, downloading your data, managing keys, and changing the account need a session: a key gets 403 there.</P>
      <P>The page uses the session cookie that logging in sets, for 30 days. A cookie request that changes something must carry the page's Origin and a JSON body, or it's a 403, so another site can't act for you.</P>
      <P>Signing in as a guest sets the same cookie, for the shared Guest account, which every guest uses at once. A guest can do what a session can, but the account's endpoints and API keys answer it 403, and the Guest account can't be logged into with a password.</P>
      <P>
        Your password never leaves your computer. Wherever the API takes it, it takes a password key instead: scrypt of the password, in Unicode's NFC form, with N=2^14, r=8, and p=5, salted with <C>asked-before/1:</C> and the account's email, trimmed and lowercased, as 32 bytes in 64 lowercase hex digits. The SDK derives it, and exports <C>passwordKey(password, email)</C> for any other client.
      </P>
      <H3>Conventions</H3>
      <P>
        Times are ISO timestamps, and ids are opaque strings. A list comes inside an object, such as {"{ shelves }"}. A list that can grow without bound comes a page at a time, newest first: pass <C>limit</C> (1 to 100, 50 by default), and <C>cursor</C>, the <C>next</C> of the page before, which is null on the last page.
      </P>
      <P>
        A phrasing is sent as {"{ sourceId, text, time }"} and nothing else: the export's own message id, your words, and when you sent them. It has at most {count(MAX_PHRASING_LENGTH)} characters, and a time more than 5 minutes after the server's clock is a 400. A card's status is one of three, each shown in the app under its own label:
      </P>
      <Pairs caption="Card statuses and their labels in the app" name="Status" what="Shown as" rows={CARD_STATUSES} />
      <H3>Errors</H3>
      <Pairs className="docs-statuses" caption="Error statuses" name="Status" what="When" rows={STATUSES} code={false} />
      <H3>The daily caps</H3>
      <P>Two daily caps, each counted per UTC day for the whole app, once for everyone, guests included, keep Asked Before inside Cloudflare's free plan. Each is a setting of the server's, given here with its default.</P>
      <P>
        Every model request counts toward the app's cap, 20 a day (<C>SITE_DAILY_MODEL_REQUESTS</C>). An upload's sort makes one request per batch of up to 300 phrasings, and one more for its last pass over the unsorted, each asked up to twice more when an answer breaks a rule: so the demo export takes 2, and an upload of 2,000 phrasings 8. A capture the model places makes one; so do starting a cold rep and checking an answer.
      </P>
      <P>
        Every phrasing sent counts toward the app's cap, 8,000 a day, uploads and captures together (<C>SITE_DAILY_PHRASINGS</C>). A chunk counts every phrasing it carries, even one the shelf holds already, since recording that the upload sent it writes too. The guest workspace's daily wipe counts the phrasings it deletes toward the new day's, since deleting them writes too. So an export bigger than what's left of a day is carried on the next day in the same upload, with Try again on the upload page.
      </P>
      <P>Past a cap, the request is a 429 and counts toward nothing: a chunk stores none of its phrasings and can be sent again, a sort fails with that message and can be retried, and a capture is lost unless it's sent again. More open at midnight UTC.</P>
      <P>Signing up and logging in count tries by network: an IPv4 address, or an IPv6 address's /64, since one connection is usually given a whole /64. Signing in as a guest counts its own tries the same way.</P>
    </>
  ),
};

const endpoints: Section = {
  id: "endpoints",
  title: "Endpoints",
  body: (
    <>
      <P>
        Every path is under <C>/api/v1</C>. Each row gives the SDK's method under its path, and the credential it needs: an API key or a session, a session only, or none.
      </P>
      {AREAS.map(({ area, endpoints }) => (
        <div key={area} className="flex flex-col gap-2">
          <H3>{area}</H3>
          <Endpoints area={area} endpoints={endpoints} />
        </div>
      ))}
    </>
  ),
};

const sortWindow: Section = {
  id: "sort-window",
  title: "The sort window",
  body: (
    <>
      <P>
        An upload is sorted in batches. Each batch carries up to <C>SORT_BATCH_SIZE</C> (300) new phrasings, plus up to as many of the shelf's most recent unsorted ones, and later batches see the cards earlier ones made. Once the batches are done, a last pass offers those most recent unsorted phrasings again, against the cards as they stand then and each other, so one an earlier batch left unsorted can still join a card a later batch made. So an older unsorted phrasing is compared again only while it's inside that window. This is a known limit: once 300 or more unsorted phrasings dated after it are on the shelf, a new phrasing that asks the same thing can wait unsorted beside it instead of making a card.
      </P>
      <P>A capture is compared with the shelf's cards and its 50 most recent unsorted phrasings.</P>
    </>
  ),
};

const sdk: Section = {
  id: "sdk",
  title: "The SDK",
  body: (
    <>
      <P>The TypeScript SDK has one method per endpoint, with typed inputs and results. It also has the export readers the upload page uses: they read a ChatGPT or Claude export on your computer, in Bun, Node, or a browser, so a script sends only your own words, as the page does.</P>
      <P>
        It isn't on npm yet. In a copy of Asked Before it's the workspace package <C>@asked-before/sdk</C>. To use it in your own code, build it in your copy with <C>bun run build:sdk</C>, which writes JavaScript and type declarations to <C>packages/sdk/dist</C> for Bun, Node, or a bundler, then add it from there: <C>bun add /path/to/asked-before/packages/sdk</C>.
      </P>
      <Code caption="Quickstart" code={quickstart} />
      <P>
        It reads your export, uploads it onto a new shelf, waits for the sort, and lists the shelf's cards. In a copy of Asked Before it's <C>packages/sdk/examples/quickstart.ts</C>. Run it with your server's address, a key from Settings, and your export:
      </P>
      <Code caption="Run the quickstart" code={`ASKED_BEFORE_URL=${SERVER} ASKED_BEFORE_API_KEY=${PLACEHOLDERS.apiKey} \\\n  bun quickstart.ts conversations.json`} />
      <P>
        Node 23.6 or later runs it too, as <C>node quickstart.ts conversations.json</C>.
      </P>
      <H3>Errors</H3>
      <P>
        A failed request throws <C>ApiError</C>, with the HTTP status and the server's message, as in <C>error instanceof ApiError && error.status === 404</C>. An export the readers can't use throws <C>ExportError</C>, whose message names the field, never your words.
      </P>
    </>
  ),
};

const whichBun = `For ${PLACEHOLDERS.bun}, put the path that the command "which bun" prints.`;

const mcp: Section = {
  id: "mcp",
  title: "The MCP server",
  body: (
    <>
      <P>Asked Before's MCP server lets an agent record your how-to questions as captures, as you ask them, and run cold reps in the chat. It runs on your computer over stdio and reaches your Asked Before server with an API key. Its tools tell the agent to send only your own words: never its answer, your code, or secrets.</P>
      <H3>Tools</H3>
      <Pairs caption="The MCP server's tools" name="Tool" what="What it does" rows={TOOLS} />
      <P>A tool that works on a shelf takes it by name or id, or else uses the default shelf. Recording a question the model has to place, starting a cold rep, and checking an answer each count toward the app's daily cap of model requests, which is for the whole app, guests included. Past it, the tool answers with an error, and a question it couldn't record is lost unless the agent sends it again.</P>
      <H3>Settings</H3>
      <Pairs caption="The MCP server's settings" name="Setting" what="What it holds" rows={mcpSettings(SERVER)} />
      <P>Without the address or the key, the server exits at once, naming them.</P>
      <H3>Set it up</H3>
      <P>
        In Claude Code, install{" "}
        <a href="#plugin" className="underline decoration-input underline-offset-4 hover:decoration-foreground">
          the plugin
        </a>
        . Without it, and in Claude Desktop and Cursor, the server runs from a copy of Asked Before: clone it and run bun install. In each snippet, put your copy's folder for <C>{PLACEHOLDERS.clone}</C>, and a key from Settings for <C>{PLACEHOLDERS.apiKey}</C>.
      </P>
      <Code caption="Claude Code without the plugin" code={snippets.claudeCode} />
      <P>Run it in a terminal.</P>
      <Code caption="Claude Desktop" code={snippets.claudeDesktop} />
      <P>In Claude Desktop, open Settings, then Developer, then Edit Config, and add it to claude_desktop_config.json. {whichBun} Then restart Claude Desktop.</P>
      <Code caption="Cursor" code={snippets.cursor} />
      <P>Add it to ~/.cursor/mcp.json, or to .cursor/mcp.json in one repository. {whichBun}</P>
    </>
  ),
};

const tool = `mcp__plugin_${PLUGIN.id.split("@")[0]}_${SERVER_NAME}__`;

const plugin: Section = {
  id: "plugin",
  title: "The Claude Code plugin",
  body: (
    <>
      <P>
        The Asked Before plugin brings the MCP server and a skill to Claude Code in one install. It comes from the marketplace in Asked Before's repository on GitHub, <C>{PLUGIN.marketplace}</C>, and carries a single-file build of the server, which runs on Node.js 20 or later.
      </P>
      <Code caption="Claude Code plugin" code={snippets.claudeCodePlugin} />
      <P>
        Run it in a terminal, with a key from Settings for <C>{PLACEHOLDERS.apiKey}</C>, then start a new Claude Code session. To pick a default shelf too, add <C>{`--config ${PLUGIN.options.shelf}=Work`}</C>.
      </P>
      <H3>The skill</H3>
      <P>The skill tells Claude Code when to use the tools:</P>
      <ul className="flex max-w-[70ch] list-disc flex-col gap-2 pl-5">
        <li>When you ask how to do something, it records your question in your own words, never its answer, your code, or secrets.</li>
        <li>When the question is on a card you asked before, it says how many times you've asked it, and offers a cold rep before it answers.</li>
        <li>During a cold rep, it shows the problem as written, gives no hints and no answer, and passes on your answer as you wrote it.</li>
      </ul>
      <H3>Permissions</H3>
      <P>
        Claude Code asks before it uses a tool, unless a permission rule allows it. In permission rules, the tools are named <C>{`${tool}<tool>`}</C>, such as <C>{`${tool}record_question`}</C>.
      </P>
      <H3>From a copy</H3>
      <P>
        After a change to the MCP server or the SDK, <C>bun run build:plugin</C> rebuilds the plugin's server, and <C>bun run check:plugin</C> checks the plugin and its server.
      </P>
    </>
  ),
};

export const SECTIONS: Section[] = [api, endpoints, sortWindow, sdk, mcp, plugin];
