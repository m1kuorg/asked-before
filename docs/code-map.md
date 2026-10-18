# Code map

Where each piece of the app lives, which ticket of the spec (m1kuorg/basics#40) owns it, and the seams that let tickets run in parallel without editing the same lines. A ticket that adds, moves, or retires a piece updates its row here. Ticket numbers are issues in m1kuorg/basics.

Contents:

1. [Layout](#layout)
1. [The API's route table](#the-apis-route-table)
1. [Adding an endpoint](#adding-an-endpoint)
1. [Wire conventions](#wire-conventions)
1. [The store](#the-store)
1. [Pages](#pages)
1. [The app page](#the-app-page)
1. [Shared parts](#shared-parts)
1. [Stylesheets](#stylesheets)
1. [Who owns which page files](#who-owns-which-page-files)
1. [Check scripts](#check-scripts)
1. [Proof-of-concept leftovers](#proof-of-concept-leftovers)

## Layout

The repo is a Bun workspace: the app at the root, and `packages/sdk` and `packages/mcp`. The Claude Code plugin lives in `plugins/asked-before`, and the repo's root is its marketplace.

| Path | What it holds | Owner |
| --- | --- | --- |
| `server.ts` | The one process: composes the pages and the API, all through `serve()`, and resumes sorts; its fallback is the 404, as `{ error }` under `/api/` | m1kuorg/basics#41 |
| `server/config.ts` | Settings from the environment, with defaults: `PORT`, `DATABASE_PATH`, `PUBLIC_URL`, `DAILY_MODEL_REQUESTS`, and `SORT_BATCH_SIZE`; a number that isn't a whole one in range stops the server at startup | m1kuorg/basics#41; `SORT_BATCH_SIZE` is m1kuorg/basics#44's |
| `server/http.ts` | `HttpError`, `readJson`, `readPage` (a list's limit and cursor), `defineRoutes`, and `serve()`, which answers errors, adds the security headers, and logs | m1kuorg/basics#41 |
| `server/auth.ts` | `authed()`, `sameOrigin()`, and the session cookie; `authenticateKey()` takes a Bearer key through `store/keys.ts` | m1kuorg/basics#41; the key lookup is m1kuorg/basics#48's |
| `server/throttle.ts` | The per-IP throttle on signing up and logging in | m1kuorg/basics#41 |
| `server/model.ts` | The model client. Every caller passes its own effort, and its `userId` argument is the daily cap's hook: it spends one of the account's daily requests, or throws 429. Requests stream, with room for 64,000 output tokens, since a sort batch can outgrow an unstreamed request's 16,000. The Anthropic SDK reads `ANTHROPIC_BASE_URL`, which is how a check points the app at its model stand-in | Proof of concept; the sort (m1kuorg/basics#44) and cold reps (m1kuorg/basics#46) pass `userId` with every request |
| `server/api/index.ts` | The API's route table, composed from the areas here and only here | m1kuorg/basics#41 |
| `server/api/<area>.ts` | One module per area of the spec's API table | See [the route table](#the-apis-route-table) |
| `server/store/db.ts` | The SQLite connection: WAL, busy timeout, `migrate()`, then foreign keys; and what the store's modules share: `newId()`, `iso()`, `sha256()`, and `randomToken()` | m1kuorg/basics#41; `migrate()` is m1kuorg/basics#54's |
| `server/store/migrations/` | The schema, as numbered migrations (see [the store](#the-store)). `0001-schema.sql` is the spec's whole schema and the `card_status` view, as it stood when migrations arrived | m1kuorg/basics#54; a schema change adds the next file |
| `server/store/users.ts`, `sessions.ts`, `shelves.ts`, `usage.ts` | Accounts, sessions, shelves with their counts (`STATUS_COUNTS`, which the Desk's totals share, and `ownsShelf()`, which every store module checks a shelf with), and the daily model-request counters. `deleteUser()` deletes an account, and everything in it by cascade | m1kuorg/basics#41; m1kuorg/basics#48 and #49 add to `users.ts` and `sessions.ts` |
| `server/store/account-data.ts` | `accountData()`: an account's download, read in one transaction. Shelves, uploads, and cards come through the same functions the API answers with, so the download matches the API; every phrasing is read here, on a card, unsorted, or still waiting for its sort | m1kuorg/basics#49 |
| `server/store/<area>.ts` | A new store module per area, such as `uploads.ts`, `cards.ts`, `reps.ts`, and `keys.ts` | The area's ticket |
| `server/store/uploads.ts` | Uploads, and appending their phrasings, skipping any whose source id the shelf holds already, unless an upload still receiving holds it: then it moves to the upload sending it; deleting one, with any card it leaves under two borrows | m1kuorg/basics#43; deleting is m1kuorg/basics#45's |
| `server/pages.ts` | The page table, built at startup; `/assets/*`, the demo export, and `notFound`, which serves `public/not-found.html` with a 404 | m1kuorg/basics#42 |
| `server/sort.ts` | The sort (ADR 0002): `sortShelf()` runs a shelf's waiting uploads one at a time in the background, batch by batch, recording progress and failures on the upload; `resumeSorts()` carries them on at startup; `askPlacement()` is the one model request and its code checks, at `SORT_EFFORT`; `sortCapture()` asks it for a capture (`server/api/captures.ts`), at `CAPTURE_EFFORT` with `CAPTURE_WINDOW` unsorted phrasings, and keeps only where the capture goes; and `cut()` is how much of a phrasing the model sees, in a sort or a rep | m1kuorg/basics#44; captures are m1kuorg/basics#50's |
| `server/store/sorts.ts` | The sort's SQL: the next upload and batch, `unsortedWindow()`, the cards with their samples, `placeBatch()`, which applies a checked answer inside its caller's transaction, and the upload's status | m1kuorg/basics#44; captures share the window and `placeBatch()` (m1kuorg/basics#50) |
| `server/store/captures.ts` | A capture's lookup before any model is asked, comparing words ignoring case and spacing: the same words captured in the last ten minutes, or else the card holding them; storing it in one transaction and placing it through `placeBatch()`, unless the same words were captured meanwhile; and reading it back with its card. Every query is scoped by the shelf's owner | m1kuorg/basics#50 |
| `server/store/cards.ts` | A shelf's cards with their status, one card with its borrows and reps, and the unsorted phrasings, a page at a time | m1kuorg/basics#44; `findCard()` is m1kuorg/basics#46's; `toCard()` is shared with the Desk (m1kuorg/basics#47) |
| `server/reps.ts` | Cold reps' two model requests, with the proof of concept's prompts, effort, and rules: `writeRep()`, a fresh problem (and the lesson, when asked) from a card's skill, its latest 20 phrasings cut to 300 characters, and its earlier problems, behind a hidden case; and `judge()`, a reason about one answer, then the verdict. `REP_EFFORT` and `CHECK_EFFORT` are both medium | m1kuorg/basics#46 |
| `server/store/reps.ts` | What a card's next rep is written from, adding a rep and keeping the lesson only if the card has none, finding a rep with whether it's open, checked, or left for a newer one, and recording a check once | m1kuorg/basics#46 |
| `server/store/desk.ts` | The Desk: the account's shelves, its cards' totals by status from the `card_status` view (so they add up to the shelves' counts), and at most 10 each of its cards not returned, most borrowed first, its latest borrows by their own time, and its latest return stamps | m1kuorg/basics#47 |
| `public/*.html` | One HTML file per page | See [who owns which page files](#who-owns-which-page-files) |
| `public/styles/` | One stylesheet per surface | See [stylesheets](#stylesheets) |
| `src/app/` | The app page: its entry, its SDK client, the router, the route table, and the top navigation | m1kuorg/basics#42 |
| `src/screens/<screen>.ts` | One module per app screen | See [the app page](#the-app-page) |
| `src/parts/` | The shared parts every screen composes | m1kuorg/basics#42; see [shared parts](#shared-parts) |
| `src/pages/` | The public pages' scripts: log in and sign up; the landing page (`landing.ts`), and `demo-card.ts`, a Bun macro that reads card A of the demo export when the pages are bundled, so the page's script carries that one card and never the answer key; the docs page (`docs.ts`): every endpoint in rows by area, with its SDK method and credential, the errors, the daily cap, the sort window, the SDK, the MCP server, and the plugin, with the setup snippets from `connect.ts` for its own server, and `sdk-quickstart.ts`, a Bun macro that reads the SDK's quickstart example | m1kuorg/basics#42; `landing.ts` and `demo-card.ts` are m1kuorg/basics#52's; `docs.ts` and `sdk-quickstart.ts` are m1kuorg/basics#51's |
| `packages/sdk/src/client.ts` | `createClient()`, which composes the areas | m1kuorg/basics#41 |
| `packages/sdk/src/http.ts` | The request function, `ApiError`, and the `path` tag | m1kuorg/basics#41 |
| `packages/sdk/src/<area>.ts` | Each area's types and methods | See [the route table](#the-apis-route-table) |
| `packages/sdk/src/index.ts` | The SDK's exports. Every area's types are exported already | m1kuorg/basics#41; m1kuorg/basics#43 added the export readers and `MAX_CHUNK` |
| `packages/sdk/tsconfig.build.json` | The SDK's build, `bun run build:sdk`: JavaScript and type declarations in `packages/sdk/dist` (gitignored), one pair per module, checked as Node checks an ES module, without Bun's types. The package's `exports` and `types` point at the build, for code outside the repo; see [the SDK's build](#the-sdks-build) | m1kuorg/basics#53 |
| `packages/sdk/src/readers.ts` | `readExport()`, `ExportError`, and `MAX_PHRASING_LENGTH`: a ChatGPT or Claude export, zip or JSON, read into phrasings in Bun, Node, or a browser. A zip is read from its directory, inflating only its conversations files | m1kuorg/basics#43 |
| `packages/sdk/fixtures/` | Small exports in each format for the readers' check, written by `make.ts` there | m1kuorg/basics#43 |
| `packages/sdk/examples/quickstart.ts` | The SDK's quickstart: read an export, upload it onto a new shelf, wait for the sort, and list the cards. The SDK's README and the docs page show it as it is, and `check:docs` runs it | m1kuorg/basics#51 |
| `packages/sdk/README.md`, `packages/mcp/README.md` | The packages' READMEs: the SDK's carries the quickstart, and the MCP server's carries `connect.ts`'s snippets for `https://asked-before.example`, both held to the code by `check:docs` | m1kuorg/basics#51 |
| `packages/mcp/src/server.ts` | The stdio MCP server, on `@modelcontextprotocol/server` (v2) and the SDK: `list_shelves`, `list_cards` (optionally `not_returned`), `record_question` (a capture), `start_cold_rep`, and `check_answer`, with the server's instructions, each tool answering a text and structured content, a failure as a tool error with the API's message. It exits at once, naming them, when its URL or key is missing | m1kuorg/basics#50 |
| `packages/mcp/src/connect.ts` | How an agent launches the MCP server, in one place: the command from a clone (`bun` and `ENTRY_IN_CLONE`); `PLUGIN`, the plugin's directory, marketplace, id, launch (`node` and its build, `dist/server.js`), and options; the environment names the server reads (`ASKED_BEFORE_URL`, `ASKED_BEFORE_API_KEY`, and the optional `ASKED_BEFORE_SHELF`, a default shelf by name or id); and the snippets that settings and the docs page show: the plugin's install, then Claude Code, Claude Desktop, and Cursor from a clone. It has no imports, so the page bundles it | m1kuorg/basics#48; the environment is m1kuorg/basics#50's; `PLUGIN` and the plugin's snippet are m1kuorg/basics#51's |
| `.claude-plugin/marketplace.json` | The marketplace at the repo's root, listing the plugin from `./plugins/asked-before` | m1kuorg/basics#51 |
| `plugins/asked-before/` | The Claude Code plugin: `.claude-plugin/plugin.json` (its options: `server_url`, `api_key`, and `shelf`), `.mcp.json`, which launches `node ${CLAUDE_PLUGIN_ROOT}/dist/server.js` with the options as the server's environment, `skills/asked-before/SKILL.md`, the skill that tells the agent when to record a question and how to run a cold rep, and `dist/server.js`, the MCP server built into one file. A marketplace install copies only this folder, so nothing in it reaches outside it | m1kuorg/basics#51 |
| `scripts/build-plugin.ts` | `bun run build:plugin`: builds `packages/mcp/src/server.ts`, with the SDK, the MCP SDK, and zod, into the plugin's `dist/server.js` for Node.js 20 or later. Rebuild it after any change to the server or the SDK; `check:plugin` fails while it's stale | m1kuorg/basics#51 |
| `scripts/lib/app.ts` | `startApp()`, the one helper that starts the app for a check, `browser()`, a client that keeps one browser's session cookie, which `check:container` uses on a container's app, and `freePort()` | m1kuorg/basics#41; a kept database, a copy's folder, and `freePort()` are m1kuorg/basics#54's |
| `scripts/journey.ts` | `bun run journey`: the whole product with the real model, nothing stubbed, in a real browser, then the SDK and the MCP server; see [check scripts](#check-scripts) | m1kuorg/basics#53 |
| `scripts/check-sdk.ts` | `bun run check:sdk`: the SDK's build, added to a package outside the repo, typechecking the quickstart under bundler and Node resolution, and running it in Bun and in Node against the app (the sort stubbed as the answer key sorts) | m1kuorg/basics#53 |
| `scripts/check-container.ts` | `bun run check:container`: the image built, a container on a fresh volume serving the app, Docker's health check, and the data kept across a restart and a new container on the same volume, which records each migration once. Needs Docker, and no key | m1kuorg/basics#53 |
| `scripts/check-migrations.ts` | `bun run check:migrations`: migration 1 on a fresh database, filled through the SDK (the model stubbed); a restart applying nothing; a copy of the app in a temporary folder with a migration 2 the repo doesn't have, rebuilding the cards table, applied to that data with the download, the session, and the API key kept; a failing migration 3 applying nothing; and the copy on a fresh database getting both, with the migrated database's schema | m1kuorg/basics#54 |
| `Dockerfile`, `.dockerignore` | The container image, on the official Bun image (`oven/bun`), running as its `bun` user, with the database on a volume at `/data` and a health check that Bun runs against `/api/v1/health`. `.dockerignore` lets in only what the server runs and builds its pages from | m1kuorg/basics#53 |
| `scripts/check-accounts.ts` | `bun run check:accounts` | m1kuorg/basics#41 |
| `scripts/check-shell.ts` | `bun run check:shell`: the shell's journey in a real browser | m1kuorg/basics#42 |
| `scripts/check-readers.ts` | `bun run check:readers`: the export readers on every fixture and on broken exports | m1kuorg/basics#43 |
| `scripts/check-uploads.ts` | `bun run check:uploads`: the uploads endpoints through the SDK | m1kuorg/basics#43 |
| `scripts/check-upload-page.ts` | `bun run check:upload-page`: the upload page and the demo action in a real browser, with every request it sends read | m1kuorg/basics#43 |
| `scripts/lib/model-stub.ts` | `startModelStub()`: a stand-in for the Anthropic API that records every request the app sends the model and answers it with `forward` (the real API), `reply()`, `refuse()`, or `hold()` | m1kuorg/basics#44 |
| `scripts/lib/answer-key.ts` | The demo export as m1, m2, …; `upload()` and `sortEnds()` through the SDK; `compareWithKey()`, a shelf's cards and unsorted against the answer key; and `keySorter`, a stand-in's answer that sorts as the key does, or `keySorterWith()`, which places phrasings the export doesn't hold too | m1kuorg/basics#44; `keySorterWith()` is m1kuorg/basics#46's |
| `scripts/lib/reps.ts` | For the cold rep checks: the demo skill's known answers; `kindOf()`, a model request's kind (sort, rep, or check); `repRequest()` and `checkRequest()`, what one sent; `sortsByKey()`, a stand-in that sorts as the key does and hands reps and checks on (to the real model by default); `repReply()`, `verdictReply()`, and `stopped()`, the stand-in's answers; and `smallExport()`, a small Claude export read by the SDK's reader | m1kuorg/basics#46 |
| `scripts/check-reps.ts` | `bun run check:reps`: five cold reps on card A with the real model, answered wrong, right, wrong, right, and wrong: the lesson's rules, each problem new, quoting no phrasing and naming no fix, and the verdicts, then the logs | m1kuorg/basics#46 |
| `scripts/check-rep-rules.ts` | `bun run check:rep-rules`: the cold reps' rules through the SDK, with the model stubbed: the lesson, what each request sends, a pass, 409s, borrowed again after a newer upload, 404s, an API key, 400s and 413, model failures, the daily cap, and deleting an upload deleting a card's reps (read in the database too) | m1kuorg/basics#46 |
| `scripts/check-card-page.ts` | `bun run check:card-page`: the card page in a real browser: card A from the stack, failed then passed with the real model, the card and the stack returned today; then card B's waits and failures with the model stubbed, and a reload, or `?rep=start`, taking the open rep up again | m1kuorg/basics#46 |
| `scripts/check-desk.ts` | `bun run check:desk`: the Desk endpoint through the SDK, against the answer key and the shelves' counts, with a cold rep passed and a card borrowed again (the model stubbed), an API key, and another account; then the page in a real browser: a new learner's empty state, its demo action leading to a sorted demo shelf, its first-upload field, a card's skill opening it with no model request, and a cold rep the Desk's own link starts in one click, passed, with the rows, the rail, and the totals as the API has them | m1kuorg/basics#47; the one-click rep is m1kuorg/basics#58's |
| `scripts/check-sort.ts` | `bun run check:sort [runs]`: the incremental sort check, with the real model | m1kuorg/basics#44 |
| `scripts/check-captures.ts` | `bun run check:captures`: captures' rules through the SDK, with the model stubbed: an exact match skipping the model, the ten-minute repeat, what the sort request sends and at what effort, unsorted, a new card from an unsorted phrasing, the sort's checks, failures storing nothing, borrowed again, an API key, 404, 401, 400, 413, an answer moving only the capture, the window of 50, and the daily cap | m1kuorg/basics#50 |
| `scripts/check-capture-sort.ts` | `bun run check:capture-sort [runs]`: fresh rephrasings of the demo skills and unrelated questions captured with the real model, at `CAPTURE_EFFORT`, each landing where it belongs | m1kuorg/basics#50 |
| `scripts/check-mcp.ts` | `bun run check:mcp`: the MCP server over stdio with the official client, a real key, and the real model: the tools and their words, card A's count up by one from a rephrasing, the repeat, unsorted, a cold rep passed, tool errors, the default shelf, and missing settings | m1kuorg/basics#50 |
| `scripts/check-plugin.ts` | `bun run check:plugin`: `claude plugin validate --strict` on the plugin and the marketplace; the build fresh; a copy of the plugin's folder alone launching its server as `.mcp.json` says, with `node`, listing its tools, listing a shelf, and recording a question through the official client, then with a default shelf; the launch, options, and install snippet agreeing with `connect.ts`; and the skill's length, frontmatter, and tool names. Needs `claude` and `node`, and no model key | m1kuorg/basics#51 |
| `scripts/check-docs.ts` | `bun run check:docs`: the docs page in a real browser against the server's route table (`apiRoutes`, read on a scratch database), its error statuses, and its sort window's numbers; its snippets for its own server; the SDK's quickstart on the page and in the README, run with a key against the demo export (the sort stubbed as the answer key sorts); and the MCP README's snippets | m1kuorg/basics#51 |
| `scripts/check-sort-rules.ts` | `bun run check:sort-rules`: the sort's rules and the cards endpoints through the SDK, with the model stubbed | m1kuorg/basics#44 |
| `scripts/check-sort-page.ts` | `bun run check:sort-page`: the upload page's sort states in a real browser, with the model stubbed | m1kuorg/basics#44 |
| `scripts/check-settings.ts` | `bun run check:settings`: API keys and the account through the SDK, then the settings page in a real browser | m1kuorg/basics#48 |
| `scripts/check-data.ts` | `bun run check:data`: downloading and deleting your data, with the model stubbed. Through the SDK, after the demo shelf and one returned card, the download against the API and the phrasings sent; deleting the account, checked in the database too, with another account's data untouched. Then both in the settings page, in a real browser | m1kuorg/basics#49 |
| `scripts/check-landing.ts` | `bun run check:landing`: the landing page's card against the answer key, its sections, and signing up and logging in from it, in a real browser | m1kuorg/basics#52 |
| `scripts/check-shelf.ts` | `bun run check:shelf`: the shelf page in a real browser, against the answer key: the demo shelf's stack, each card's status (after real cold reps, with the model's answers queued, and a newer upload), stamps in the learner's time zone, unsorted, the upload history, deleting an upload (checked in the API), and the empty stack | m1kuorg/basics#45; real reps are m1kuorg/basics#46's |
| `scripts/check-styles.ts`, `scripts/lib/styles.ts` | `bun run check:styles` and its kit | m1kuorg/basics#42 |
| `scripts/styles/<surface>.ts` | One styles-check module per surface | Each surface's ticket; see [check scripts](#check-scripts) |

Installed up front: `fflate` in `packages/sdk` for the export readers, `@modelcontextprotocol/server` in `packages/mcp`, and `@modelcontextprotocol/client` at the root for check scripts.

### The SDK's build

The repo runs the SDK from its sources: the root `tsconfig.json` maps `@asked-before/sdk` to `packages/sdk/src/index.ts`, and Bun follows that mapping at runtime and in its bundler, so the server, the pages, the MCP server, the plugin's build, and the checks never wait on a build. The package's own `exports` point at `packages/sdk/dist`, which only code outside the repo uses, after `bun run build:sdk`. The SDK's modules import each other with `.ts` extensions, which the build rewrites to `.js`, so the built package also loads in Node; a new module does the same.

## The API's route table

Every endpoint is under `/api/v1`, and every one is built (captures, m1kuorg/basics#50, were the last to answer 501); anything else under `/api/` is a 404. The public docs page lists every one, and `check:docs` fails when this table's routes and its rows disagree, so a new endpoint adds its row in `src/pages/docs.ts`. "Session only" means `authed(..., { sessionOnly: true })`: an API key gets 403 there.

| Area | Method and path | SDK method | Owner |
| --- | --- | --- | --- |
| Auth | `POST /auth/signup` | `auth.signUp` | m1kuorg/basics#41 |
| Auth | `POST /auth/login` | `auth.logIn` | m1kuorg/basics#41 |
| Auth | `POST /auth/logout`, session only | `auth.logOut` | m1kuorg/basics#41 |
| Auth | `GET /auth/me` | `auth.me` | m1kuorg/basics#41 |
| Account | `PATCH /account`, session only | `account.update` | m1kuorg/basics#48 |
| Account | `POST /account/password`, session only: needs the current password, and ends every other session | `account.changePassword` | m1kuorg/basics#48 |
| Account | `GET /account/export`, session only: the account and each shelf with its uploads, every phrasing (with its origin, its upload, and its card), and its cards with their lessons and cold reps; no API key or password | `account.export` | m1kuorg/basics#49 |
| Account | `DELETE /account`, session only, with `{ password }`: a wrong one is a 403. Deletes everything in the account and ends every session, clearing this one's cookie | `account.delete` | m1kuorg/basics#49 |
| API keys | `GET /keys`, `POST /keys`, `DELETE /keys/:keyId`, session only | `keys.list`, `keys.create`, `keys.revoke` | m1kuorg/basics#48 |
| Shelves | `GET /shelves`, `POST /shelves` | `shelves.list`, `shelves.create` | m1kuorg/basics#41 |
| Shelves | `GET /shelves/:shelfId`; `PATCH /shelves/:shelfId`, session only | `shelves.get`, `shelves.rename` | m1kuorg/basics#41 |
| Shelves | `DELETE /shelves/:shelfId`, session only | `shelves.delete` | m1kuorg/basics#41 |
| Uploads | `GET /shelves/:shelfId/uploads`, `POST /shelves/:shelfId/uploads` | `uploads.list`, `uploads.create` | m1kuorg/basics#43 |
| Uploads | `GET /uploads/:uploadId`, `POST /uploads/:uploadId/phrasings`, `POST /uploads/:uploadId/finish` | `uploads.get`, `uploads.append`, `uploads.finish` | m1kuorg/basics#43 |
| Uploads | `POST /uploads/:uploadId/retry`: a failed sort only, else 409 | `uploads.retry` | m1kuorg/basics#44 |
| Uploads | `DELETE /uploads/:uploadId`, session only: deletes its phrasings, and any card left with fewer than two borrows, whose last phrasing becomes unsorted | `uploads.delete` | m1kuorg/basics#45 |
| Cards | `GET /shelves/:shelfId/cards`, `GET /shelves/:shelfId/unsorted`, `GET /cards/:cardId` | `cards.list`, `cards.unsorted`, `cards.get` | m1kuorg/basics#44 |
| Captures | `POST /shelves/:shelfId/captures`, with `{ text }`: 201 with the capture, or 200 with the earlier one for the same words within ten minutes | `captures.create` | m1kuorg/basics#50 |
| Reps | `POST /cards/:cardId/reps`: 201 with the rep, and the lesson on the card's first rep or after a failed one, else null | `reps.start` | m1kuorg/basics#46 |
| Reps | `POST /reps/:repId/check`, with `{ answer }` of up to 4,000 characters (413 past it): the checked rep and its card; a rep checked already, or left for a newer one, is a 409 | `reps.check` | m1kuorg/basics#46 |
| Desk | `GET /desk`: the Desk, across your shelves; an API key can read it | `desk.get` | m1kuorg/basics#47 |
| Health | `GET /health`, no account needed | `health.check` | m1kuorg/basics#41 |

Collections sit under their parent and single items stand alone, so `/uploads/:uploadId` rather than `/shelves/:shelfId/uploads/:uploadId`. Every store query still joins up to the shelf's owner, so another account's resource is a 404 at any depth.

## Adding an endpoint

1. In `server/api/<area>.ts`, add a handler wrapped in `authed()`. Add `{ sessionOnly: true }` for anything a key can't do: renaming, deleting, exporting, keys, and the account. `req.params` is typed from the path.
1. Read the body with `readJson(req, schema)`, a zod schema with a message per field, which answers 400 with the first one. Throw `HttpError(status, message)` for any other failure. A message is shown to the caller, so it never holds phrasing text.
1. Put the SQL in `server/store/<area>.ts`, scoped by `auth.userId`, and return the SDK's types. Nothing outside `server/store/` imports `db`.
1. Add the methods and their types to `packages/sdk/src/<area>.ts`; the server's answers use `satisfies` with those types.
1. Prove it in a check script under `scripts/` that starts the app with `startApp()`, and add it to `package.json`.
1. Add its row to the docs page, `src/pages/docs.ts`, which `check:docs` holds to the route table.

Don't edit `server/api/index.ts` or `packages/sdk/src/client.ts` to add an endpoint: both already compose every area.

## Wire conventions

- JSON in and out. A failure is a non-2xx status with `{ error }`; the SDK throws it as `ApiError`, with `status` and `message`.
- Ids are opaque strings (UUIDv7). Times are ISO timestamps over the API and Unix milliseconds in the store.
- A list comes inside an object, as `{ shelves: [...] }`, and the SDK unwraps it. Lists that can grow without bound take a limit and a cursor: they answer a page as `{ uploads: [...], next }`, newest first, which the SDK returns whole, and `next` is the cursor for the page after, or null on the last.
- A phrasing goes over the wire as `{ sourceId, text, time }` and nothing else; a body with any other key is a 400.
- Card status is `"borrowed"`, `"returned"`, or `"borrowed_again"`, from the `card_status` view. A shelf's counts are `{ cards, borrowed, returned, borrowedAgain }`.
- A model failure is a `ModelError`, an `HttpError` with status 502. Past the daily cap, the model client throws 429.
- An upload's `messages` counts each of your messages it was sent once, by source id, so a chunk sent twice counts once; its `phrasings` are the ones among them it sorts: those new to the shelf, and any held by an upload still receiving (one whose tab closed, say), which move to it.
- Finishing an upload answers it `waiting` and starts its shelf's sort, one upload at a time per shelf: `sorting`, with `offered` of its `phrasings` seen so far, then `sorted`, or `failed` with an `error` safe to show (a model failure, the daily cap's message, or a check that failed three times). `uploads.retry` carries a failed sort on from the first phrasing not yet offered. Each batch is `SORT_BATCH_SIZE` phrasings no sort has seen, plus up to as many of the shelf's most recent unsorted ones; an unsorted phrasing older than that window is compared again only if it falls inside a later batch's window, a known limit the public docs (m1kuorg/basics#51) must state.
- A card is `{ id, shelfId, skill, status, count, firstBorrowAt, lastBorrowAt, returnedAt }`, listed most borrowed first, ties to the later last borrow; `cards.get` adds its `lesson`, its `borrows` (`{ id, sourceId, text, time }`, oldest first), and its `reps`. Unsorted phrasings are those a sort has seen that aren't on a card, newest first; one still waiting for its sort isn't unsorted yet.
- A cold rep is `{ id, problem, answer, verdict, reason, createdAt, checkedAt }`, the last four null until it's checked. `reps.start` answers `{ rep, lesson }`: the lesson is written with the card's first rep and kept, and comes back again until a checked rep passes and after any failed one, else null. `reps.check` answers `{ rep, card }`, the card as the check left it: a pass stamps it returned with the rep's `checkedAt`. A rep is open while it's unchecked and the latest on its card, and only an open rep can be checked. Both ask the model, so both count toward the daily cap, and a failed model request stores nothing.
- A capture is `{ phrasing, card, alreadyCaptured }`: the phrasing recorded, its source id generated and its time the server's clock; the card it landed on as it stands now, or null while it's unsorted; and `alreadyCaptured`, true when the same words, ignoring case and spacing, were captured on the shelf in the last ten minutes, so that capture comes back and no borrow is added. Words matching a phrasing on a card join it without the model; anything else is one sort request at `CAPTURE_EFFORT` (low), with the shelf's cards and the capture first among its `CAPTURE_WINDOW` (50) most recent unsorted. Only the capture moves: onto a card, or into a new card with the unsorted phrasings that ask the same thing; whatever else the answer places waits for the next upload's sort. A failed model request, or a shelf deleted meanwhile, stores nothing.
- The Desk is `{ shelves, totals, mostBorrowed, latestBorrows, latestReturns }`. `totals` has a shelf's counts' shape and equals their sums. `mostBorrowed` holds up to 10 cards not returned (borrowed or borrowed again) in the stack's order; `latestReturns` up to 10 cards with a return stamp, latest first, a card borrowed again since keeping its stamp; each card carries its `shelf` (`{ id, name, demo }`). `latestBorrows` holds the 10 newest borrows by their own time, each with its `card` (`{ id, skill, status }`) and `shelf`.
- Signing up and logging in return `{ account, next }`. `next` echoes the request's `next` only when it's a path inside the app, under `/app/`, and is otherwise `/app/desk`, the app's home, the Desk. The page goes there; m1kuorg/basics#42 serves the app at `/app`, which shows the Desk, and its client routes under `/app/`.
- A cookie-authenticated request that changes something must carry an `Origin` matching the app's origin, and a JSON content type unless it's a bodiless DELETE. The SDK sends JSON on every POST and PATCH, and the browser adds the `Origin`. Signing up and logging in follow the same rule, against forged log-ins, before the throttle counts the try. Either one ends the session the browser already had.
- A Bearer key, when sent, is the only credential considered; the cookie is ignored. A key is `ab_<id>_<secret>`, with a 16-hex-digit id and a 32-hex-digit secret; a bad or revoked one is a 401, and a good one on a session-only endpoint a 403.

## The store

- The schema is the files in `server/store/migrations/`, `<4-digit version>-<what>.sql`. At every start, `migrate()` in `store/db.ts` applies the ones the database hasn't recorded, in order of version, in one transaction, and records each in the `migrations` table (`version`, `name`, `applied_at`). Any failure undoes them all and stops the server, naming the file. There is no migration framework beyond this.
- A schema change is a new file with the next version; never edit one that's merged, since a database that has had it won't take it again. A file is plain SQL and doesn't open its own transaction.
- Foreign keys are off while migrations run, so a table ALTER TABLE can't change is rebuilt as SQLite's docs say: create the new table, copy the rows, drop the old one, and rename the new one to its name, without deleting anything beneath it. Drop the `card_status` view first, and make it again after, or the rename fails on it. A migration that leaves a row pointing at one that isn't there fails, by `PRAGMA foreign_key_check`. `check:migrations` rebuilds the cards table this way.
- A local database made before migrations arrived has the tables but no `migrations` table, so migration 1 fails on it: delete your `data/` folder once. Check scripts always start with a fresh database.
- Every child table cascades on delete from its parent. A phrasing's `card_id` is set to null when its card goes, which leaves it unsorted.
- `upload_messages` keeps the source id of every message an upload was sent, once each: its count is the upload's `messages`.
- `card_status` gives, per card, `borrows`, `first_borrow_at`, `last_borrow_at`, `returned_at` (the latest passed rep's `checked_at`), and `status`, comparing timestamps rather than dates, so a borrow sent in the same millisecond as a pass leaves the card returned.
- A card's `lesson` is written once, by its first rep, and never replaced. A rep's `answer`, `verdict`, `reason`, and `checked_at` are written together, once, only while it's the latest on its card; ids are time-ordered, so the latest is the greatest `(created_at, id)`. Reps cascade with their card, so deleting an upload that removes a card removes its reps.
- `usage` counts model requests per account per UTC day; `spendModelRequest()` in `store/usage.ts` is the only writer.
- Sessions store the SHA-256 of the cookie's token. An API key's secret is stored the same way, in `api_keys.secret_hash`, and only `keys.create` ever returns the whole key. A key's `last_used_at` is written at most once a minute.

## Pages

- `PAGES` in `server/pages.ts` maps each page's path to its HTML file, named as under `public/`. At startup, `Bun.build` bundles them with their scripts, styles, and fonts into memory. Pages are served with `no-cache` and the hashed assets under `/assets/` as immutable.
- Bun's HTML-import routes are deliberately not used: their answers can't carry headers, and every answer must carry the security headers. The cost is no hot reload; restart the server to see a change to the page.
- The pages: `/` (`index.html`, the landing page), `/docs` (`docs.html`, the docs page, mounted by `src/pages/docs.ts`), `/login` (`login.html`), `/signup` (`signup.html`), and the app at `/app` and `/app/*` (`app.html`). Any other path gets `not-found.html` with a 404, and anything under `/api/` gets `{ error }`. A new page adds its HTML file under `public/` and a line in `PAGES`; the landing page and docs already have theirs.
- A public page's navigation is static markup in its HTML: the product name, Docs, then Log in and Sign up. Copy it from `login.html`, marking the current page with `aria-current="page"`.
- The content security policy allows only the app's own origin, plus `blob:` workers for fflate. Inline scripts, `<style>` elements, and `style="..."` attributes in markup are blocked, so style through class names and the stylesheets.

## The app page

`app.html` loads `src/app/main.ts`, which asks `auth.me()` who is logged in, draws the top navigation (`src/app/nav.ts`), and starts the router (`src/app/router.ts`). The page reaches the server only through the SDK client in `src/app/client.ts`, which sends any 401 to `/login?next=<where you were>`; logging in goes back there. Log in and sign up (`src/pages/`) follow the server's `next`.

The route table is `src/app/routes.ts`. Every screen in the spec already has its route and a module, so a screen's ticket edits only its own module:

| Path | Screen module | Owner |
| --- | --- | --- |
| `/app` and `/app/desk` | `src/screens/desk.ts`, headed "Still borrowed": the totals as a ledger in the margin; the cards not returned in rows over the plate's count of them, closed by a cold rep on the top one, whose link (`?rep=start`) starts it at once; the latest borrows on the rail, keys seated; and the latest returns. With no cards, an empty state: a new learner's offers `startDemoShelf()` and a field that names a first shelf and goes to its upload page | m1kuorg/basics#47 |
| `/app/shelves` | `src/screens/shelves.ts`: list, create, rename, delete; its empty state offers the demo shelf (m1kuorg/basics#43) | m1kuorg/basics#42 |
| `/app/shelves/:shelfId` | `src/screens/shelf.ts`: the card stack, its keys in the margin under the shelf's name, with `?card=<id>` for the chosen card; `?view=unsorted` and `?view=uploads`, the unsorted phrasings and the upload history with its deletes, a page at a time; and an empty stack that says why it's empty | m1kuorg/basics#45 |
| `/app/shelves/:shelfId/upload` | `src/screens/upload.ts`: the instructions, the drop zone, the preview, and sending in chunks. `?upload=<id>` shows one finished upload and watches its sort: progress, and a failure with a retry (m1kuorg/basics#44), and `?export=demo` uploads the demo export onto a demo shelf. `startDemoShelf()` is the demo action, for the Desk too | m1kuorg/basics#43 |
| `/app/cards/:cardId` | `src/screens/card.ts`: the card and its cold rep, with the proof of concept's rep look. The margin names the shelf, the card's borrows and months, and its status; the block holds the skill, the plate, and the rep (the verdict and lesson left, the problem and answer box right), then the card's phrasings on the rail, closed by its return stamp, and its earlier cold reps, newest first. Opening a card takes up its open rep, or else shows Take a cold rep, which starts one, so opening a card spends no model request. `?rep=start`, the Desk's cold rep link, starts one at once instead, unless one is open, and drops from the address so back, forward, and reload start nothing | m1kuorg/basics#46; `?rep=start` is m1kuorg/basics#58's |
| `/app/settings` | `src/screens/settings.ts`: the profile, the password, API keys, and the setup snippets to connect an agent; then your data, downloaded as one JSON file named for the day, and deleting the account: the password, then the delete confirmation, then the landing page | m1kuorg/basics#48, then #49 |
| anything else under `/app/` | `src/screens/not-found.ts` | m1kuorg/basics#42 |

A screen is `(root: HTMLElement, props: ScreenProps<"param">) => void | Promise<void>`. The router empties `#app`, sets `#app[data-screen="<name>"]` and the page title, marks the navigation's section, and mounts the screen with:

- `params` (decoded `:params`, typed from the path) and `query`;
- `client` (the SDK), `account` (who is logged in), and `setAccount`, which a screen calls after changing the name or email so the navigation shows it;
- `navigate(path)`, though plain `<a href="/app/...">` links are followed without a reload anyway;
- `signal`, aborted when the learner leaves, so nothing a screen was still fetching draws over the next one. `load()` from `src/parts/frame.ts` checks it for you.

A screen's own views (such as a shelf's unsorted phrasings, or one upload's progress) can live in its `query` rather than in a new route.

## Shared parts

Each part is a function that returns elements, in `src/parts/`, styled by `public/styles/parts.css` (and `shell.css` for the frame). Strings are always set as text, never as HTML.

| Module | Parts |
| --- | --- |
| `dom.ts` | `el(tag, className, ...children)`, `button(text, onClick, className)`, `link(text, href, className)`, `uniqueId()`. Button classes: none for the primary, `secondary` for the safe choice, `retry`, `quiet` for row and navigation actions; `link(..., "button")` looks like a button |
| `frame.ts` | `frame(root, marginNotes)` mounts `aside.margin` and `main.block`; `plate(count, caption)`, the one reversed plate; `waiting(line)`; `notice(message)`; `failure(error, onRetry)`; `load(block, { keep, line, request, show, signal })`, which shows the waiting line, then the result or the error and a retry |
| `fields.ts` | `field({ label, name, type, hint, ... })`, a label over a box with an optional hint; `form({ fields, submit, onSubmit, layout })`, which locks its button while `onSubmit` runs and shows a thrown error as its notice. `layout: "row"` sets one field and its button on one line |
| `rows.ts` | `rows({ caption, columns, items, detail })`, a table between hairlines with right-aligned numeric columns, a column of row actions (`actions: true`) whose label only assistive technology reads, and an optional full-width detail row under an item. Put a title and its labels in `span.row-title` |
| `empty.ts` | `emptyState(title, body, ...actions)` |
| `confirm.ts` | `confirmDelete({ title, body, action, onConfirm, onCancel })`, the delete confirmation, in place (a `rows` detail row, say), never a modal |
| `drop-zone.ts` | `dropZone({ title, hint, accept, onFile })` |
| `code-block.ts` | `codeBlock(caption, code)`, with its copy button |
| `library.ts` | `PRIVACY_LINE` and `privacyLine()`, the spec's privacy line; `demoLabel()`; `stamp(iso)`, a date in the learner's time zone; `count(n)`, a number as the page writes it; and `SOURCES`, each export's chatbot by name |
| `card.ts` | A card's pieces the stack and the card page share, styled by `stack.css`: `rails(borrows)`, one rail per year, `phrasing(text)` and `flagged(text)`, which keep a command flag whole, `railEnd(card)` and `borrowedAgain(returnedAt)`, what closes a returned card's rail, `PLATE_CAPTION` after a card's status, and `months(card)` (m1kuorg/basics#46) |
| `messages.ts` | `messageOf(error)`: the API's message, or a connection failure |

A new part that more than one screen needs goes here, with its rules in `parts.css` and a sample in `scripts/lib/parts-sample.ts`; record it in `docs/DESIGN.md` under Components.

## Stylesheets

Each page links the stylesheets it needs, in this order: `base.css` (faces, tokens, links, buttons), `shell.css` (navigation, margin, block, plate), `parts.css`, then its surfaces. `app.html` links every app surface's file already, so a ticket never edits it to add styles.

| File | What it styles | Owner |
| --- | --- | --- |
| `base.css`, `shell.css`, `parts.css` | Everything shared | m1kuorg/basics#42 |
| `account.css` | Log in, sign up, and the not-found page | m1kuorg/basics#42 |
| `shelves.css` | The shelves list | m1kuorg/basics#42 |
| `stack.css` | The card stack: margin keys, the rail, the key drop, the end rule, as the proof of concept shipped them; then the shelf page's own rules, under `#app[data-screen="shelf"]` | m1kuorg/basics#45 |
| `rep.css` | The cold rep, as the proof of concept shipped it; then the card page's own rules, under `#app[data-screen="card"]` | m1kuorg/basics#46 |
| `desk.css` | The Desk | m1kuorg/basics#47 |
| `upload.css` | The upload page | m1kuorg/basics#43 |
| `settings.css` | Settings | m1kuorg/basics#48, then #49 |
| `landing.css` | The landing page | m1kuorg/basics#52 |
| `docs.css` | The docs page | m1kuorg/basics#51 |

A surface's rules go under `#app[data-screen="<name>"]` (the router sets it; public pages set it in their HTML), so no surface restyles another. Use only the tokens in `base.css`, which match `docs/DESIGN.md`.

## Who owns which page files

The three tickets that run in parallel after m1kuorg/basics#42 touch none of the same files:

| Ticket | Files it owns |
| --- | --- |
| m1kuorg/basics#43, upload | `src/screens/upload.ts`, `public/styles/upload.css`, `scripts/styles/upload.ts` if it checks styles, its check script, and its own SDK and server files |
| m1kuorg/basics#48, settings | `src/screens/settings.ts`, `public/styles/settings.css`, `scripts/styles/settings.ts`, its check script, and its own SDK and server files |
| m1kuorg/basics#52, landing | `public/index.html`, `public/styles/landing.css`, `src/pages/landing.ts`, `src/pages/demo-card.ts`, `scripts/styles/landing.ts`, `scripts/check-landing.ts` |

Each uses the shared parts and `PRIVACY_LINE` as they are. A change a part needs is a small edit to that part's own module; say so in the PR, since another ticket may use it too. The landing page links `stack.css` to set a real card on the rail.

## Check scripts

- `startApp(env?, root?)` from `scripts/lib/app.ts` starts `bun server.ts` on a free port with a temporary database, and returns `{ url, databasePath, log, browser, stop }`. `env` overrides settings, such as `DAILY_MODEL_REQUESTS`; a `DATABASE_PATH` there starts it on that database, which `stop()` keeps, and a `PORT` (from `freePort()`) keeps one address across starts. `root` starts a copy of the app from another folder, as `check:migrations` does.
- `bun run journey` walks the whole product with nothing stubbed, in the browser, then through the SDK and the MCP server, as the README describes; change it when a screen it walks changes. `check:container` is the one check that doesn't use `startApp()`: it runs the app in Docker, on a free port and a fresh volume.
- Finishing an upload starts a sort, which asks the model. A check that doesn't prove the sort's quality starts a model stand-in, `startModelStub(reply(keySorter))` from `scripts/lib/`, and passes its `url` as `ANTHROPIC_BASE_URL` to `startApp()`, so it needs no key and its sorts end as the answer key says. The stand-in also holds, refuses, or reads requests, for a check of waiting and failure states or of what the model is sent.
- `app.browser()` is one browser: an SDK client that keeps its own session cookie and sends the app's `Origin`. `cookie()` gives its Cookie header for requests made without the SDK. A script can also make a key with `keys.create` and reach the API as a script or agent would, with `createClient({ baseUrl: app.url, apiKey })`.
- Each copy of the app allows 20 sign-up and log-in tries per address in 15 minutes, so a script making many accounts should start its own copy.
- A browser check stubs a request only inside the script, with Playwright's `page.route`, never in the app.
- `check:styles` signs up one learner on a fresh copy of the app, then runs every module in `scripts/styles/`, in name order. A module's default export is `(kit: Kit) => Promise<void>` (`scripts/lib/styles.ts`): it opens pages with `kit.page({ loggedIn })` and `kit.open()`, drives them into each state, and calls `kit.shoot(page, name)`, which saves the screenshot and checks the type floor, vermilion, radius and shadow, the inks, contrast, the plate count, a plate ending inside the block's padding, and sideways scroll. A waiting or error state passes `{ plate }`: true once the screen has its count, false while it waits for that count, as `docs/DESIGN.md`'s Plate Holds Rule says. A surface's ticket adds its own module rather than editing another's. `shell.ts` and `parts.ts` are m1kuorg/basics#42's; `stack.ts` drives the real shelf page (m1kuorg/basics#45), `rep.ts` the real card page (m1kuorg/basics#46), queuing the model stand-in's answers to its rep and check requests through `kit.model`, `desk.ts` the real desk (m1kuorg/basics#47), which runs first and needs the learner without shelves, and `docs.ts` the docs page, logged out (m1kuorg/basics#51). Modules share one learner, so one that makes a shelf deletes it before it ends.
- `check:styles` starts its app with the model stand-in answering as the answer key sorts (`keySorter`), so a module can upload the demo export and get the key's cards, with no key and no wait.

## Proof-of-concept leftovers

| Piece | Retired or retargeted by |
| --- | --- |
| The single page at `/` and its screens | Retired by m1kuorg/basics#42: the load, stack, and rep screens became the upload, shelf, and card placeholders |
| `src/parser.ts`, used by the model routes' checks and the styles samples | Retired by m1kuorg/basics#43: those read the demo export through the SDK's reader. `check:key` reads the reader's phrasings as they are, so `scripts/lib/demo.ts`, which reshaped them into the parser's messages, went with the review fixes |
| `src/api.ts`, the group request's shape | Deleted by m1kuorg/basics#44 |
| `src/cards.ts` and `src/types.ts`, used by the rep and check routes, `check:cards`, and the rep styles sample | Deleted by m1kuorg/basics#46, with that sample and those routes; the stack's sample went with m1kuorg/basics#45 |
| `POST /api/group` | Deleted by m1kuorg/basics#44: the sort (`server/sort.ts`) replaces it |
| `POST /api/rep`, `/api/check` in `server/routes/`, with no account and no cap | Deleted by m1kuorg/basics#46: their prompts live on in `server/reps.ts`, behind the reps endpoints |
| `check:grouping` | Replaced by m1kuorg/basics#44's `check:sort`, the incremental sort check |
| `check:key`, `check:cards` | `check:cards` went with the card builder (m1kuorg/basics#46); `check:key` stays, since every check leans on the answer key it checks |
| `check:rep-routes` | Retargeted by m1kuorg/basics#46 as `check:reps`, on the reps endpoints |
| `check:rep` and `journey`, which walked the single page | Deleted by m1kuorg/basics#42; m1kuorg/basics#46 added the card page's browser check, `check:card-page`, and m1kuorg/basics#53 the app journey, `bun run journey` |
| `demo/no-repeats.json`, the export where nothing is asked twice, served at `/demo/no-repeats.json` | Deleted by m1kuorg/basics#53: no page fetched it, and only `check:key` read it, to check itself |
| `server/model.ts`'s default effort and optional `userId`, for routes with no account | Removed by m1kuorg/basics#53: every caller passes both |
| `scripts/styles/stack.ts` and `rep.ts`, sample markup | `stack.ts` drives the real shelf page (m1kuorg/basics#45), and `rep.ts` the real card page (m1kuorg/basics#46) |
