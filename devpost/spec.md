---
doc: spec
status: approved
---

<!-- Worked by the entrant (@kymil4) manually with the Skill Pack. -->

# Asked Before — Technical Spec

## How This Works, In Plain Language
Asked Before is a small web app that runs on your own computer. There are two pieces.

- **The page** is what you see in the browser: plain HTML, CSS, and TypeScript, with no framework. It reads the demo export, keeps only your own messages, and does all the counting. It draws one screen at a time: Load, Stack, or Rep. It also remembers, only for as long as the tab is open, which cards you've returned.
- **The server** is a small Bun program on the same machine. It serves the page, holds the Anthropic API key so the browser never sees it, and answers three requests by asking Claude Haiku 5.5:
  - **Group:** which of these messages ask the same thing, and what's the skill called?
  - **Rep:** write a fresh problem for this skill, plus the lesson the first time.
  - **Check:** does this answer pass, and why?

Claude only ever reads. It never counts or dates anything. The page turns its groups into cards using the messages' real timestamps, and it rejects any reply that doesn't hold up. Nothing is saved anywhere, so closing the tab starts over.

There's a server, rather than the page calling Claude directly, so the API key stays off the page (TRD.md, "The alternative shape"). There's no framework or database because the app has three screens and nothing to store.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. You run `bun run start` and open `http://localhost:3000`. The server sends the page. Before mounting any screen, the page entry fetches `/demo/export.json`, and the **parser** turns it into your own messages, each `{ id, conversationId, text, time }`. It drops assistant, system, and tool messages and non-text parts. If the shape is unexpected, the parser throws an `ExportError`.
2. The page entry mounts the **Load screen** with the parsed messages, or with the parser's error. With messages, Load shows the demo-data label, the privacy line, what will be sent, and the load action; pressing it hands back the load action. With an error, Load shows `.error` and `.retry`; the retry asks the page entry to fetch and parse again, then remount Load.
3. The page entry mounts the **Stack screen**, which sends `POST /api/group` with `{ messages: [{ id, text }] }` (ids and texts only) and shows a waiting state. The **group route** asks Claude with a structured output and returns `{ skills: [{ name, messageIds }] }`.
4. The **card builder** checks the reply: every id exists, no id appears twice, groups under two borrows are dropped, and names are short text. It then builds cards from the messages' timestamps and orders them by count, with ties going to the later last borrow. The stack draws A to E in the margin and card A in the centre block.
5. You open a card. The page entry mounts the **Rep screen** with that card, which sends `POST /api/rep` with `{ skill, phrasings, earlierProblems: [], withLesson: true }` and shows a waiting state. The **rep route** returns `{ lesson, problem }`, and the page shows both plus the answer box.
6. You submit an answer. The Rep screen sends `POST /api/check` with `{ skill, problem, answer }`, and the **check route** returns `{ verdict, reason }`.
7. **Fail:** the Rep screen shows the reason and the stored lesson again. It then requests another rep with `withLesson: false` and the earlier problems listed, and shows the new problem.
8. **Pass:** the Rep screen hands back "returned, today's date". The page entry records it in memory and mounts the Stack again. The Stack reuses its cards (no second group request), strikes that card's margin key, and closes its rail with an end rule.

## Stack
Decided by the entrant (#25 Shape, TRD.md Stack) unless marked otherwise.

- **Bun**, latest 1.x, as runtime, server, bundler, and package manager. Use `bun`, never npm or pnpm. `Bun.serve` with an HTML import serves the page and bundles its TypeScript with no separate build step. Docs: <https://bun.com/docs/api/http>, <https://bun.com/docs/bundler/fullstack>. *Verify early:* the HTML-import routes in the installed Bun version.
- **TypeScript, plain HTML, and CSS.** No front-end framework, no database.
- **`@anthropic-ai/sdk`**, the official Anthropic TypeScript SDK, server-side only. Docs: <https://github.com/anthropics/anthropic-sdk-typescript>. Read it, and the claude-api skill, before first use.
- **Model: `claude-haiku-5-5`** for every request (#25; this supersedes TRD.md's `claude-opus-5-5`).
- **Structured outputs:** `output_config.format` on all three requests (#25). Docs: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>.
- **Agent recommendation: Zod** for the three output schemas, through the SDK's `zodOutputFormat` helper (`@anthropic-ai/sdk/helpers/zod`) with `client.messages.parse()`. The SDK documents this path, and one schema then gives both the request format and a typed `parsed_output`. The tradeoff is one more dependency. The alternative is hand-written JSON Schema passed to `output_config.format`, with our own parsing. Docs: <https://zod.dev>. *Verify early:* the Zod major version the installed SDK helper expects.
- **Playwright** for the journey script, as a dev dependency. Docs: <https://playwright.dev/docs/intro>.
- **Hanken Grotesk**, self-hosted under `public/fonts/` so the app and the recording don't depend on the network. It's licensed under the SIL Open Font License; source: <https://fonts.google.com/specimen/Hanken+Grotesk>.

## Where It Runs and How Someone Tries It
- **Runtime:** a local Bun server and a desktop browser. No hosting (PRD Non-Goals). Requires Bun 1.x and an Anthropic API key.
- **Agent recommendation: start command and port.** `bun run start` (in `package.json`, `"start": "bun run server.ts"`) listens on `PORT` from the environment, defaulting to `3000`. Parallel build agents run their own copies with `PORT=3101 bun run start`, and so on.
- **From a fresh clone (the README says exactly this):**
  ```
  bun install
  cp .env.example .env        # then set ANTHROPIC_API_KEY=...
  bun run start
  # open http://localhost:3000
  ```
- `.env` is gitignored; `.env.example` ships with `ANTHROPIC_API_KEY=` empty. The key is read only by the server; Bun loads `.env` automatically.
- **For the recording:** a browser window at 1920×1080. The whole journey on the demo export: load, the stack, open key A, a known wrong answer, a fail, a known right answer, and the returned card back on the stack. Under three minutes, with the fail and the pass inside the first minute. Record on a run where grouping matches the answer key.
- **Submission** needs the demo video and a public GitHub repository. Deployment isn't planned. Making the repo public, the YouTube upload, and the Devpost submission wait for the entrant's approval (#34).

## Look and Feel
Carries forward `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`. The detailed references are copied from m1kuorg/basics in the planning repo's layout, because DESIGN.md links to `/.impeccable/…` and the impeccable skill reads `.impeccable/` (#7's final scope):
- `docs/DESIGN.md`
- the card stack surface brief at `.impeccable/surfaces/apps-src-index-tsx.md`, with its primary target pointed at the stack screen's real path, `src/screens/stack.ts`, and `public/styles.css` as a related target
- the chosen sketch and figure, `.impeccable/mocks/decision/r2-lead.html` and `r2-lead.png`
- the impeccable skill under `.claude/skills/impeccable/`

- **One stylesheet** (`public/styles.css`) styles everything. Screens only emit markup with these class names, and never inline styles: `demo-label`, `privacy-line`, `margin`, `margin-key`, `block`, `skill`, `rail`, `rail-key`, `plate`, `phrasing`, `stamp`, `lesson`, `problem`, `answer-box`, `verdict`, `end-rule`, `is-returned`, `is-failed`, `is-waiting`, `error`, `retry`.
- **Tokens as CSS custom properties.**
  - Inks: Proof Gray `#E8EBED` for the ground and margin, Block White `#FFFFFF`, Iron Black `#1A1A1A` for text, hairlines, the plate, and the primary button, and Rule Gray `#C3C8CC` for the rules between rows.
  - Rubric Vermilion `#B42D16` only on `.rail-key` and `.margin-key` letters.
  - Every other neutral comes from one ramp between Proof Gray and Iron Black.
- **Type:** Hanken Grotesk throughout, with `font-variant-numeric: tabular-nums` on dates and counts.
  - Display: 900 weight, 54px, 1.0 line height.
  - Count: 900 weight, 150px, only on `.plate`.
  - Body: at least 20px; labels and apparatus at least 14px, all in the 1080p frame.
  - No monospace, no other display face.
- **Shape:** square corners, 1px hairlines, no shadows, no radius. One reversed `.plate` per screen, hanging over the block's right edge.
- **Layout:** the block keeps its measure, two equal columns around a narrow rail, and the margins absorb extra width. Standard top navigation carries `.demo-label` on every screen.
- **States add no ink.** `.is-returned` strikes the margin key in iron black. `.end-rule` closes a returned card's rail. `.is-waiting` and `.is-failed` stay within the two inks.
- **Motion:** only the rail key's drop into its detent, along one damped axis with no overshoot, and none under `prefers-reduced-motion`.
- **Avoid:** fades, slides, staggered reveals, hover animations, icon sets, emoji, gradients, rounded cards, toasts, progress bars, streaks, scores, charts, all-caps eyebrows, and "→" on buttons.
- **Copy** uses a library's words, says "chat export" and never "ChatGPT". Example waiting lines: "Sorting the slips…", "Pulling a fresh problem…", "Checking your answer…". These are agent placeholders; tune them in the build.

## Components

### Server
Owner #7. `server.ts`. `Bun.serve` serves:
- the page (`public/index.html` via HTML import)
- `/demo/export.json` and `/demo/no-repeats.json`, but never the answer key or the known answers
- `POST /api/group`, `/api/rep`, and `/api/check`, mounted from the route files

It reads `PORT` (default 3000), and `ANTHROPIC_API_KEY` through the SDK. It logs only route, status, and duration, never message text. While a route's piece hasn't landed, it answers 501 with `{ error }`.
PRD ref: `prd.md > States and Boundaries` (Privacy boundary).

### Model client
Owner #7. `server/model.ts`. Shared by all three routes:
- the one Anthropic client
- `MODEL = "claude-haiku-5-5"` and `EFFORT`, set explicitly and tuned (see Decisions and Open Issues)
- `askStructured(system, userText, zodSchema)`, which calls `client.messages.parse()` with `output_config: { effort, format: zodOutputFormat(schema) }`

`askStructured` treats each of these as a failure, never a result: a `stop_reason` of `refusal` or `max_tokens`, a null `parsed_output`, or an SDK error. A failure becomes a `ModelError` that routes turn into a non-2xx `{ error }`. *Agent details, from the SDK docs:* the client doesn't send `thinking` (Haiku 5.5 runs adaptive by default), `temperature` or `top_p` (non-default values return a 400), `fallbacks` (Haiku 5.5 has none), or an assistant prefill (400). Non-streaming, with `max_tokens` around 16000.
PRD ref: `prd.md > States and Boundaries` (Model failure or refusal).

### Group route
Owner #28. `server/routes/group.ts`. Takes `{ messages: [{ id, text }] }` and rejects anything else with a 400. The prompt asks which messages ask how to do the same thing, and for a short skill name per group, such as "Undo a git commit". It never asks for counts or dates. Returns `{ skills: [{ name, messageIds }] }`.
PRD ref: `prd.md > The card stack`.

### Rep route
Owner #27. `server/routes/rep.ts`. Takes `{ skill, phrasings, earlierProblems, withLesson }` and returns `{ lesson?, problem }`. `lesson` is present only when `withLesson` is true. The prompt asks for a fresh scenario of the skill that doesn't reword a phrasing or repeat an earlier problem, and that doesn't contain its answer.
PRD ref: `prd.md > The lesson and the cold rep`.

### Check route
Owner #27. `server/routes/check.ts`. Takes `{ skill, problem, answer }` and returns `{ verdict: "pass" | "fail", reason }`. The prompt requires the reason to be about this answer: what it gets right or wrong for this problem.
PRD ref: `prd.md > The lesson and the cold rep`.

### Page entry
Owner #7. `src/main.ts`, loaded by `public/index.html`. Holds the in-memory state (see Data Model). On start, and again on Load's retry, it fetches `/demo/export.json` and runs the parser before mounting anything. It then mounts one screen at a time into `#app`, passing:
- Load: the parsed messages or the parser's error. It gets back the load action, and then mounts the Stack, or a retry, and then fetches and parses again.
- Stack: messages and the returned map, and gets back open(card).
- Rep: one card, and gets back returned(date).

Also renders the top navigation with `.demo-label` on every screen; the demo export is the only source, so it's always on screen. Exports the one privacy-line string, `PRIVACY_LINE`, which the Load and Stack screens both render as `.privacy-line`. Also owns `src/api.ts`, a `postJson()` helper that throws on a non-2xx response with the server's `{ error }`.
PRD ref: `prd.md > Screens and Layout`.

### Parser
Owner #7. `src/parser.ts`. Reads a chat export in ChatGPT's `conversations.json` shape, following TRD.md's Export format: a list of conversations, each with a `mapping` of nodes, each node's message having `author.role`, `content.parts`, and an optional `create_time` in Unix seconds.
- Keeps only role `user` messages whose parts hold text, and joins the text parts.
- Takes each message's `create_time`, or else its conversation's.
- Assigns opaque ids: `m1`, `m2`, … in order.
- Throws a named `ExportError` on any shape it doesn't recognize, never skipping quietly.
PRD ref: `prd.md > Loading the export`.

### Card builder
Owner #7. `src/cards.ts`. Takes the group result and the messages, and returns `Card[]` or throws a `GroupingError`. It checks:
- every id exists
- no id appears in two groups
- each skill name is a non-empty single line of 60 characters or fewer (*agent detail*)
- groups with fewer than two borrows are dropped, not errors

Count, first month, and last month come from the messages' times, formatted in UTC (for example "March 2025") so runs are deterministic. Order is by count descending, ties by later last borrow first. Keys A, B, … follow that order. Zero cards is a valid "nothing asked more than once" result.
PRD ref: `prd.md > The card stack`, `prd.md > States and Boundaries`.

### Load screen
Owner #26. `src/screens/load.ts`. Gets the parsed messages, or the parser's error, from the page entry; it never fetches or parses itself.
- **With messages:** shows the privacy line ("Only your own messages go to the model…"), what will be sent (your own message texts, as counted or listed: `prd.md > Open Questions` 1), and one load action, which needs no file picker. Pressing it hands back the load action.
- **With an error:** shows `.error` with a `.retry`. The retry asks the page entry to fetch and parse again.
PRD ref: `prd.md > Loading the export`.

### Stack screen
Owner #28. `src/screens/stack.ts`.
- Sends the group request, with `.is-waiting` while it waits, then builds cards.
- The left margin lists `.margin-key` A to E, then `.privacy-line`.
- The centre `.block` shows the chosen card (A by default):
  - `.skill` at display size
  - `.phrasing` and `.stamp` rows in two columns around `.rail`, with one `.rail-key` per borrow, cut where the year turns
  - the count on `.plate`
  - an "Open key A" button
- The button reads "Open key X" for the card in the centre block. Clicking a `.margin-key` shows that card in the block, and the button calls open(card). Any of A to E can be opened.
- Returned cards get `.is-returned` and an `.end-rule`.
- **Groups once per load.** `stack.ts` keeps its cards in module memory for the loaded messages. Remounting after a rep, with the same messages, reuses them and never regroups. Regrouping would let cards drift and break the returned marks, which are keyed by skill.
- On zero cards it says so plainly. On a grouping or model error it shows `.error` and `.retry`.
PRD ref: `prd.md > The card stack`.

### Rep screen
Owner #29. `src/screens/rep.ts`.
- Requests the first rep with `withLesson: true`, with `.is-waiting` while it waits.
- Shows `.lesson`, `.problem`, and a plain `.answer-box` (a textarea and a submit button), with no hint shown before submitting.
- Sends the check request, with `.is-waiting` while it waits, and shows `.verdict` with the reason.
- **Fail:** adds `.is-failed`, shows the stored lesson again, and requests a new rep with `withLesson: false`. `earlierProblems` holds every problem shown on this card so far. This repeats on every fail; the card stays borrowed until a pass.
- **Pass:** hands back returned(today).
- Every model error shows `.error` with a `.retry` of the same request.
PRD ref: `prd.md > The lesson and the cold rep`.

### Stylesheet
Owner #33. `public/styles.css` and `public/fonts/`. Styles only the class names listed in Look and Feel.
PRD ref: `prd.md > Look and Feel`.

### Demo data
- **Demo export and no-repeats export:** owner #7.
- **Known answers:** owner #27.
- `demo/export.json` is the made-up demo export in the `conversations.json` shape:
  - the "Undo a git commit" cluster of 9 phrasings, one per conversation, March 2025 to September 2026, crossing the year turn
  - four smaller skills asked 2 to 4 times
  - at least six one-off questions
  - an assistant answer for every message
  - at least one system message, one tool message, one non-text part, and one message with no `create_time`
- `demo/answer-key.json` lists each skill's message ids, count, and first and last month, plus the one-off ids. It's never served and never sent to the model.
- `demo/no-repeats.json` is a small export where nothing is asked twice.
- `demo/known-answers.json` holds known right and wrong answers for the demo skill.
PRD ref: `prd.md > What We're Building`.

### Check scripts
- `scripts/check-answer-key.ts` (owner #7) checks the key against the export.
- `scripts/check-cards.ts` (owner #7) runs the parser and card builder on the export, using the answer key as the group result, and asserts the counts and months.
- `scripts/check-grouping.ts` (*agent assignment: #28*, which owns the group route) sends the demo messages to `/api/group` N times and reports how each run compares with the answer key.
- `scripts/journey.ts` (owner #30) is the Playwright journey with no stubs.

Build tickets' own stubs, such as Playwright request routing, live only in their test scripts, never in the app.

## Data Model
All in memory; nothing persists, and reloading starts over (`prd.md > States and Boundaries`).

```ts
// src/types.ts (owner #7) — shared by page and server
type Message = { id: string; conversationId: string; text: string; time: number }; // time: Unix seconds
type Borrow  = { messageId: string; text: string; date: string };                  // date: ISO yyyy-mm-dd, UTC
type Card    = { skill: string; count: number; firstMonth: string; lastMonth: string; borrows: Borrow[] };

type GroupRequest  = { messages: { id: string; text: string }[] };
type GroupResponse = { skills: { name: string; messageIds: string[] }[] };
type RepRequest    = { skill: string; phrasings: string[]; earlierProblems: string[]; withLesson: boolean };
type RepResponse   = { lesson?: string; problem: string };
type CheckRequest  = { skill: string; problem: string; answer: string };
type CheckResponse = { verdict: "pass" | "fail"; reason: string };
type ErrorResponse = { error: string };
```

| Data | Lives in | Updated by | When you leave and come back |
| ---- | -------- | ---------- | ---------------------------- |
| Parsed messages | Page entry memory | The parser, on load | Gone; load again |
| Cards | Stack screen module memory, kept across remounts | The card builder, once per load | Gone; regrouped on next load |
| Returned map (`skill → date`) | Page entry memory | Rep screen's returned hand-back | Gone |
| A card's lesson, earlier problems | Rep screen memory | Each rep reply | Gone; reopening a card starts its reps fresh |
| API key | Server process (`.env`) | Never | Read at start |

The server stores nothing between requests.

## File Structure
```
asked-before/
├── server.ts                 # #7  Bun.serve: page, demo files, /api routes, PORT, 501 placeholders
├── server/
│   ├── model.ts              # #7  Anthropic client, MODEL, EFFORT, askStructured() + stop-reason check
│   └── routes/
│       ├── group.ts          # #28 POST /api/group
│       ├── rep.ts            # #27 POST /api/rep
│       └── check.ts          # #27 POST /api/check
├── src/                      # the page's TypeScript, bundled by Bun from index.html
│   ├── main.ts               # #7  page entry: state, top nav + demo label, mounts one screen
│   ├── api.ts                # #7  postJson() helper
│   ├── types.ts              # #7  shared types (also imported by server/)
│   ├── parser.ts             # #7  chat export → your own messages
│   ├── cards.ts              # #7  card builder + checks on the model's output
│   └── screens/
│       ├── load.ts           # #26 Load screen
│       ├── stack.ts          # #28 Stack screen
│       └── rep.ts            # #29 Rep screen
├── public/
│   ├── index.html            # #7  shell: <div id="app">, loads src/main.ts and styles.css
│   ├── styles.css            # #33 the one stylesheet
│   └── fonts/                # #33 Hanken Grotesk files
├── demo/
│   ├── export.json           # #7  made-up demo export (labeled demo data)
│   ├── answer-key.json       # #7  never served, never sent to the model
│   ├── no-repeats.json       # #7  nothing asked twice
│   └── known-answers.json    # #27 right and wrong answers for the demo skill
├── scripts/
│   ├── check-answer-key.ts   # #7
│   ├── check-cards.ts        # #7
│   ├── check-grouping.ts     # #28 (agent assignment)
│   └── journey.ts            # #30 Playwright journey, no stubs
├── docs/
│   └── DESIGN.md             # #7  copied from m1kuorg/basics
├── .impeccable/              # #7  copied; read by the impeccable skill
│   ├── surfaces/
│   │   └── apps-src-index-tsx.md   # card stack surface brief, primary target → src/screens/stack.ts, related → public/styles.css
│   └── mocks/decision/
│       ├── r2-lead.html      # chosen sketch
│       └── r2-lead.png       # its Centre Rail figure
├── .claude/skills/impeccable/  # #7 copied design skill
├── devpost/                  # Skill Pack workspace (written only by the Skill Pack)
├── package.json              # #7  scripts: start, check:key, check:cards, check:grouping, journey
├── bun.lock
├── .env.example              # #7  ANTHROPIC_API_KEY=
├── README.md                 # #26 fresh-clone steps and disclosures
└── LICENSE                   # #26
```

## External Services and Dependencies
- **Anthropic Messages API**, through `@anthropic-ai/sdk`'s `client.messages.parse()` (`POST /v1/messages`).
  - Auth: `ANTHROPIC_API_KEY` from `.env`, server-side only.
  - Model: `claude-haiku-5-5`, with `output_config: { effort, format }`.
  - Cost: $0.10 per million input tokens and $0.50 per million output tokens, for prompts up to 100K tokens (per the claude-api skill's model table, cached October 6, 2026). The demo's requests are small, so a full journey costs well under a cent. *Verify on the pricing page before quoting it.*
  - Rate limits: by account tier, <https://platform.claude.com/docs/en/api/rate-limits>.
  - Docs: structured outputs <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>; effort <https://platform.claude.com/docs/en/build-with-claude/effort>; refusals <https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback>.
- **Request shapes** between page and server: exactly #25's Requests table (see Data Model types). Failure is a non-2xx response with `{ error }`.
- **Dependencies** (#7 adds them up front with `bun add`): `@anthropic-ai/sdk` and `zod`, plus dev dependencies `playwright` and `@types/bun`.
- Nothing else: no hosting, no database, no font CDN.

## Important Failure Modes
- **The model refuses, is cut off, or returns nothing parseable.** `askStructured` raises, the route returns 502 `{ error }`, and the screen shows `.error` with a `.retry`. No card, lesson, problem, or verdict is shown that didn't arrive.
- **Grouping drifts or breaks the rules** (an unknown id, an id in two groups, a bad name). The card builder throws `GroupingError`, and the stack shows the error and a retry. Counts can never be wrong because of the model, since code counts. Record the video on a run that matches the answer key.
- **The check judges wrongly** (passes a wrong answer or fails a right one). Caught before recording with `demo/known-answers.json` in the journey script; adjust the check prompt or effort.
- **The export shape surprises the parser.** It raises `ExportError`, and the Load screen shows the error and a retry rather than misreading.
- **Missing API key.** The SDK throws, and the route returns `{ error }`, which the screen shows. The README says to set the key.

## What Was Simplified and Why
- **Demo export only**, instead of dropping in your own: there's no real export to verify end to end (locked cut). The fuller version needs a file input, a size cap on grouping, and testing on real exports.
- **No splitting a wrong merge**: locked out. Showing phrasings verbatim keeps a wrong merge visible.
- **No persistence**, instead of saved progress: nothing needs to survive a visit to prove the cold rep. Fuller would need storage or local storage.
- **One request per grouping**, with no batching or cap: the demo export is small. A real export would need a stated cap, never a silent cut (TRD.md risks).
- **Local only, recorded**, instead of hosting: hosting isn't required. Hosting would need a deploy target and a way to protect the key.
- **One free-text answer box** for every skill, instead of per-skill answer forms: one form fits every skill (locked).

## Decisions and Open Issues
**Entrant decisions** (#25 Locked decisions, TRD.md):
- Bun server with a plain page, no framework, no database, nothing saved.
- `claude-haiku-5-5` with explicit effort, structured outputs on group, rep, and check.
- #25's request shapes, screens, hand-offs, class names, and file ownership.
- Code counts and the model reads. Only your own words go to the model.
- No unit tests: end-to-end proof with the journey script and the grouping script.

**Agent recommendations, accepted by the answering agent at review:**
- `bun run start` on `PORT`, defaulting to 3000.
- Zod with `zodOutputFormat` and `messages.parse()` for the schemas.
- Self-hosted Hanken Grotesk.
- Fixed `src/`, `server/`, `public/`, `demo/`, `scripts/` paths, with the grouping script assigned to #28.

**Agent implementation details derived from those decisions:**
- UTC month formatting.
- Opaque ids `m1…`.
- Model request parameters (no `thinking`, sampling, `fallbacks`, or prefill; `max_tokens` around 16000; non-streaming).
- Server logs carry only route, status, and duration.
- `package.json` script names: `start`, `check:key`, `check:cards`, `check:grouping`, `journey`.
- The Stack keeps its cards across remounts, so grouping runs once per load.
- The skill-name limit of 60 characters on one line.
- The answer key is never served.

**One useful unknown** (TRD.md risks, #25 Model): *which effort setting for `claude-haiku-5-5` makes grouping match the answer key run after run?* Nothing has clarified it yet. The entrant's written check is the grouping script, during the build. *Agent-proposed protocol:* run `scripts/check-grouping.ts` five times each at `low`, `medium`, and `high`, record the match rate per setting, and fix `EFFORT` in `server/model.ts` at the lowest setting that matches every run. Run the same comparison on the check request against `known-answers.json`. Record the results in the PR that sets it.

**Verify early in the build:**
- Bun's HTML-import `routes` in the installed version.
- The Zod version the SDK's `zodOutputFormat` expects.
- That `claude-haiku-5-5` accepts `output_config.format` and `effort` together on the Claude API. The claude-api skill says structured outputs carry over to Haiku 5.5.

**Carried from `prd.md > Open Questions`** (non-blocking; resolve in the build against the surface brief, without inventing product intent):
1. The Load screen lists the messages or only counts them. The page entry has already parsed them, so either works.
2. Whether the Rep screen repeats the card's stamps and phrasings.
3. A way back to the stack mid-rep. Not built: Rep's only hand-back is returned.
4. What the centre block shows once A is returned.
5. How a failed rep shows within the two inks.
6. The apparatus face: tracked caps in Hanken Grotesk, or a small-caps family (DESIGN.md).
