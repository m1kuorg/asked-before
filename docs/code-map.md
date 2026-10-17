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

The repo is a Bun workspace: the app at the root, and `packages/sdk` and `packages/mcp`.

| Path | What it holds | Owner |
| --- | --- | --- |
| `server.ts` | The one process: composes the pages, the API, and the proof of concept's routes, all through `serve()`; its fallback is the 404, as `{ error }` under `/api/` | m1kuorg/basics#41 |
| `server/config.ts` | Settings from the environment, with defaults: `PORT`, `DATABASE_PATH`, `PUBLIC_URL`, `DAILY_MODEL_REQUESTS`, and `SORT_BATCH_SIZE` | m1kuorg/basics#41; `SORT_BATCH_SIZE` is m1kuorg/basics#44's |
| `server/http.ts` | `HttpError`, `readJson`, `notBuilt`, `defineRoutes`, and `serve()`, which answers errors, adds the security headers, and logs | m1kuorg/basics#41 |
| `server/auth.ts` | `authed()`, `sameOrigin()`, and the session cookie; `authenticateKey()` takes a Bearer key through `store/keys.ts` | m1kuorg/basics#41; the key lookup is m1kuorg/basics#48's |
| `server/throttle.ts` | The per-IP throttle on signing up and logging in | m1kuorg/basics#41 |
| `server/model.ts` | The model client. Its `userId` argument is the daily cap's hook: it spends one of the account's daily requests, or throws 429. The Anthropic SDK reads `ANTHROPIC_BASE_URL`, which is how a check points the app at its model stand-in | Proof of concept; the sort passes `userId` with every request (m1kuorg/basics#44); the rep and check routes don't until m1kuorg/basics#46 |
| `server/api/index.ts` | The API's route table, composed from the areas here and only here | m1kuorg/basics#41 |
| `server/api/<area>.ts` | One module per area of the spec's API table | See [the route table](#the-apis-route-table) |
| `server/store/db.ts` | The SQLite connection: foreign keys, WAL, busy timeout, and the schema | m1kuorg/basics#41 |
| `server/store/schema.sql` | The spec's whole schema, and the `card_status` view | m1kuorg/basics#41; changed in place by whoever needs to |
| `server/store/users.ts`, `sessions.ts`, `projects.ts`, `usage.ts` | Accounts, sessions, projects with their counts, and the daily model-request counters | m1kuorg/basics#41; m1kuorg/basics#48 and #49 add to `users.ts` and `sessions.ts` |
| `server/store/<area>.ts` | A new store module per area, such as `uploads.ts`, `cards.ts`, `reps.ts`, and `keys.ts` | The area's ticket |
| `server/store/uploads.ts` | Uploads, and appending their phrasings, skipping any whose source id the project holds already | m1kuorg/basics#43 |
| `server/pages.ts` | The page table, built at startup; `/assets/*`, the demo exports, and `notFound`, which serves `public/not-found.html` with a 404 | m1kuorg/basics#42 |
| `server/sort.ts` | The sort (ADR 0002): `sortProject()` runs a project's waiting uploads one at a time in the background, batch by batch, recording progress and failures on the upload; `resumeSorts()` carries them on at startup; `askPlacement()` is the one model request and its code checks, with `SORT_EFFORT`, for m1kuorg/basics#50's captures to call at a lower effort | m1kuorg/basics#44 |
| `server/store/sorts.ts` | The sort's SQL: the next upload and batch, the cards with their samples, applying a checked answer, and the upload's status | m1kuorg/basics#44 |
| `server/store/cards.ts` | A project's cards with their status, one card with its borrows and reps, and the unsorted phrasings, a page at a time | m1kuorg/basics#44 |
| `server/routes/` | The proof of concept's rep and check routes; its group route is gone | Retired by m1kuorg/basics#46 |
| `public/*.html` | One HTML file per page | See [who owns which page files](#who-owns-which-page-files) |
| `public/styles/` | One stylesheet per surface | See [stylesheets](#stylesheets) |
| `src/app/` | The app page: its entry, its SDK client, the router, the route table, and the top navigation | m1kuorg/basics#42 |
| `src/screens/<screen>.ts` | One module per app screen | See [the app page](#the-app-page) |
| `src/parts/` | The shared parts every screen composes | m1kuorg/basics#42; see [shared parts](#shared-parts) |
| `src/pages/` | The public pages' scripts: log in and sign up; the landing page (`landing.ts`), and `demo-card.ts`, a Bun macro that reads card A of the demo export when the pages are bundled, so the page's script carries that one card and never the answer key | m1kuorg/basics#42; `landing.ts` and `demo-card.ts` are m1kuorg/basics#52's |
| `src/cards.ts`, `src/types.ts` | The proof of concept's card builder and request shapes, which its rep and check routes, `check:cards`, and the stack and rep styles samples still use | See [proof-of-concept leftovers](#proof-of-concept-leftovers) |
| `packages/sdk/src/client.ts` | `createClient()`, which composes the areas | m1kuorg/basics#41 |
| `packages/sdk/src/http.ts` | The request function, `ApiError`, and the `path` tag | m1kuorg/basics#41 |
| `packages/sdk/src/<area>.ts` | Each area's types and methods; stub areas have none yet | See [the route table](#the-apis-route-table) |
| `packages/sdk/src/index.ts` | The SDK's exports. Every area's types are exported already | m1kuorg/basics#41; m1kuorg/basics#43 added the export readers and `MAX_CHUNK` |
| `packages/sdk/src/readers.ts` | `readExport()`, `ExportError`, and `MAX_PHRASING_LENGTH`: a ChatGPT or Claude export, zip or JSON, read into phrasings in Bun, Node, or a browser. A zip is read from its directory, inflating only its conversations files | m1kuorg/basics#43 |
| `packages/sdk/fixtures/` | Small exports in each format for the readers' check, written by `make.ts` there | m1kuorg/basics#43 |
| `packages/mcp/src/server.ts` | A placeholder; `@modelcontextprotocol/server` and `zod` are installed | m1kuorg/basics#50 |
| `packages/mcp/src/connect.ts` | How an agent launches the MCP server, in one place: the command, the environment names (`ASKED_BEFORE_URL`, `ASKED_BEFORE_API_KEY`), and the Claude Code, Claude Desktop, and Cursor snippets that settings shows. It has no imports, so the page bundles it | m1kuorg/basics#48; m1kuorg/basics#50 corrects the environment, and #51 the snippets once the plugin carries its build |
| `scripts/lib/app.ts` | `startApp()`, the one helper that starts the app for a check | m1kuorg/basics#41 |
| `scripts/check-accounts.ts` | `bun run check:accounts` | m1kuorg/basics#41 |
| `scripts/check-shell.ts` | `bun run check:shell`: the shell's journey in a real browser | m1kuorg/basics#42 |
| `scripts/check-readers.ts` | `bun run check:readers`: the export readers on every fixture and on broken exports | m1kuorg/basics#43 |
| `scripts/check-uploads.ts` | `bun run check:uploads`: the uploads endpoints through the SDK | m1kuorg/basics#43 |
| `scripts/check-upload-page.ts` | `bun run check:upload-page`: the upload page and the demo action in a real browser, with every request it sends read | m1kuorg/basics#43 |
| `scripts/lib/demo.ts` | `demoMessages()`: a demo export through the SDK's reader, in the proof of concept's message shape, for its checks | m1kuorg/basics#43; goes with those checks |
| `scripts/lib/model-stub.ts` | `startModelStub()`: a stand-in for the Anthropic API that records every request the app sends the model and answers it with `forward` (the real API), `reply()`, `refuse()`, or `hold()` | m1kuorg/basics#44 |
| `scripts/lib/answer-key.ts` | The demo export as m1, m2, …; `upload()` and `sortEnds()` through the SDK; `compareWithKey()`, a project's cards and unsorted against the answer key; and `keySorter`, a stand-in's answer that sorts as the key does | m1kuorg/basics#44 |
| `scripts/check-sort.ts` | `bun run check:sort [runs]`: the incremental sort check, with the real model | m1kuorg/basics#44 |
| `scripts/check-sort-rules.ts` | `bun run check:sort-rules`: the sort's rules and the cards endpoints through the SDK, with the model stubbed | m1kuorg/basics#44 |
| `scripts/check-sort-page.ts` | `bun run check:sort-page`: the upload page's sort states in a real browser, with the model stubbed | m1kuorg/basics#44 |
| `scripts/check-settings.ts` | `bun run check:settings`: API keys and the account through the SDK, then the settings page in a real browser | m1kuorg/basics#48 |
| `scripts/check-landing.ts` | `bun run check:landing`: the landing page's card against the answer key, its sections, and signing up and logging in from it, in a real browser | m1kuorg/basics#52 |
| `scripts/check-styles.ts`, `scripts/lib/styles.ts` | `bun run check:styles` and its kit | m1kuorg/basics#42 |
| `scripts/styles/<surface>.ts` | One styles-check module per surface | Each surface's ticket; see [check scripts](#check-scripts) |

Installed up front: `fflate` in `packages/sdk` for the export readers, `@modelcontextprotocol/server` in `packages/mcp`, and `@modelcontextprotocol/client` at the root for check scripts.

## The API's route table

Every endpoint is under `/api/v1`. An endpoint whose ticket hasn't landed answers 501 with `{ error }`; anything else under `/api/` is a 404. "Session only" means `authed(..., { sessionOnly: true })`: an API key gets 403 there.

| Area | Method and path | SDK method | Owner |
| --- | --- | --- | --- |
| Auth | `POST /auth/signup` | `auth.signUp` | m1kuorg/basics#41 |
| Auth | `POST /auth/login` | `auth.logIn` | m1kuorg/basics#41 |
| Auth | `POST /auth/logout`, session only | `auth.logOut` | m1kuorg/basics#41 |
| Auth | `GET /auth/me` | `auth.me` | m1kuorg/basics#41 |
| Account | `PATCH /account`, session only | `account.update` | m1kuorg/basics#48 |
| Account | `POST /account/password`, session only: needs the current password, and ends every other session | `account.changePassword` | m1kuorg/basics#48 |
| Account | `GET /account/export`, session only | `account` | m1kuorg/basics#49 |
| Account | `DELETE /account`, session only | `account` | m1kuorg/basics#49 |
| API keys | `GET /keys`, `POST /keys`, `DELETE /keys/:keyId`, session only | `keys.list`, `keys.create`, `keys.revoke` | m1kuorg/basics#48 |
| Projects | `GET /projects`, `POST /projects` | `projects.list`, `projects.create` | m1kuorg/basics#41 |
| Projects | `GET /projects/:projectId`, `PATCH /projects/:projectId` | `projects.get`, `projects.rename` | m1kuorg/basics#41 |
| Projects | `DELETE /projects/:projectId`, session only | `projects.delete` | m1kuorg/basics#41 |
| Uploads | `GET /projects/:projectId/uploads`, `POST /projects/:projectId/uploads` | `uploads.list`, `uploads.create` | m1kuorg/basics#43 |
| Uploads | `GET /uploads/:uploadId`, `POST /uploads/:uploadId/phrasings`, `POST /uploads/:uploadId/finish` | `uploads.get`, `uploads.append`, `uploads.finish` | m1kuorg/basics#43 |
| Uploads | `POST /uploads/:uploadId/retry`: a failed sort only, else 409 | `uploads.retry` | m1kuorg/basics#44 |
| Uploads | `DELETE /uploads/:uploadId`, session only | `uploads` | m1kuorg/basics#45 |
| Cards | `GET /projects/:projectId/cards`, `GET /projects/:projectId/unsorted`, `GET /cards/:cardId` | `cards.list`, `cards.unsorted`, `cards.get` | m1kuorg/basics#44 |
| Captures | `POST /projects/:projectId/captures` | `captures` | m1kuorg/basics#50 |
| Reps | `POST /cards/:cardId/reps`, `POST /reps/:repId/check` | `reps` | m1kuorg/basics#46 |
| Dashboard | `GET /dashboard` | `dashboard` | m1kuorg/basics#47 |
| Health | `GET /health`, no account needed | `health.check` | m1kuorg/basics#41 |

Collections sit under their parent and single items stand alone, so `/uploads/:uploadId` rather than `/projects/:projectId/uploads/:uploadId`. Every store query still joins up to the project's owner, so another account's resource is a 404 at any depth.

## Adding an endpoint

1. In `server/api/<area>.ts`, replace the `notBuilt(...)` stub with a handler wrapped in `authed()`. Add `{ sessionOnly: true }` for anything a key can't do: deleting, exporting, keys, and the account. `req.params` is typed from the path.
1. Read the body with `readJson(req, schema)`, a zod schema with a message per field, which answers 400 with the first one. Throw `HttpError(status, message)` for any other failure. A message is shown to the caller, so it never holds phrasing text.
1. Put the SQL in `server/store/<area>.ts`, scoped by `auth.userId`, and return the SDK's types. Nothing outside `server/store/` imports `db`.
1. Add the methods and their types to `packages/sdk/src/<area>.ts`; the server's answers use `satisfies` with those types.
1. Prove it in a check script under `scripts/` that starts the app with `startApp()`, and add it to `package.json`.

Don't edit `server/api/index.ts` or `packages/sdk/src/client.ts` to add an endpoint: both already compose every area.

## Wire conventions

- JSON in and out. A failure is a non-2xx status with `{ error }`; the SDK throws it as `ApiError`, with `status` and `message`.
- Ids are opaque strings (UUIDv7). Times are ISO timestamps over the API and Unix milliseconds in the store.
- A list comes inside an object, as `{ projects: [...] }`, and the SDK unwraps it. Lists that can grow without bound take a limit and a cursor: they answer a page as `{ uploads: [...], next }`, newest first, which the SDK returns whole, and `next` is the cursor for the page after, or null on the last.
- A phrasing goes over the wire as `{ sourceId, text, time }` and nothing else; a body with any other key is a 400.
- Card status is `"borrowed"`, `"returned"`, or `"borrowed_again"`, from the `card_status` view. A project's counts are `{ cards, borrowed, returned, borrowedAgain }`.
- A model failure is a `ModelError`, an `HttpError` with status 502. Past the daily cap, the model client throws 429.
- Finishing an upload answers it `waiting` and starts its project's sort, one upload at a time per project: `sorting`, with `offered` of its `phrasings` seen so far, then `sorted`, or `failed` with an `error` safe to show (a model failure, the daily cap's message, or a check that failed three times). `uploads.retry` carries a failed sort on from the first phrasing not yet offered. Each batch is `SORT_BATCH_SIZE` phrasings no sort has seen, plus up to as many of the project's most recent unsorted ones; an unsorted phrasing older than that window is compared again only if it falls inside a later batch's window, a known limit the public docs (m1kuorg/basics#51) must state.
- A card is `{ id, projectId, skill, status, count, firstBorrowAt, lastBorrowAt, returnedAt }`, listed most borrowed first, ties to the later last borrow; `cards.get` adds its `lesson`, its `borrows` (`{ id, sourceId, text, time }`, oldest first), and its `reps`. Unsorted phrasings are those a sort has seen that aren't on a card, newest first; one still waiting for its sort isn't unsorted yet.
- Signing up and logging in return `{ account, next }`. `next` echoes the request's `next` only when it's a path inside the app, and is otherwise `/app`, the app's home. The page goes there; m1kuorg/basics#42 serves the app at `/app` and its client routes under `/app/`.
- A cookie-authenticated request that changes something must carry an `Origin` matching the app's origin, and a JSON content type unless it's a bodiless DELETE. The SDK sends JSON on every POST and PATCH, and the browser adds the `Origin`. Signing up and logging in follow the same rule, against forged log-ins, before the throttle counts the try. Either one ends the session the browser already had.
- A Bearer key, when sent, is the only credential considered; the cookie is ignored. A key is `ab_<id>_<secret>`, with a 16-hex-digit id and a 32-hex-digit secret; a bad or revoked one is a 401, and a good one on a session-only endpoint a 403.

## The store

- `schema.sql` is applied at every start. Tables are create-if-missing and change in place, since nothing has shipped. A changed table doesn't reach a database that already has it, so delete your local `data/` folder after changing one; check scripts always start with a fresh database.
- Every child table cascades on delete from its parent. A phrasing's `card_id` is set to null when its card goes, which leaves it unsorted.
- `card_status` gives, per card, `borrows`, `first_borrow_at`, `last_borrow_at`, `returned_at` (the latest passed rep's `checked_at`), and `status`, comparing timestamps rather than dates.
- `usage` counts model requests per account per UTC day; `spendModelRequest()` in `store/usage.ts` is the only writer.
- Sessions store the SHA-256 of the cookie's token. An API key's secret is stored the same way, in `api_keys.secret_hash`, and only `keys.create` ever returns the whole key. A key's `last_used_at` is written at most once a minute.

## Pages

- `PAGES` in `server/pages.ts` maps each page's path to its HTML file, named as under `public/`. At startup, `Bun.build` bundles them with their scripts, styles, and fonts into memory. Pages are served with `no-cache` and the hashed assets under `/assets/` as immutable.
- Bun's HTML-import routes are deliberately not used: their answers can't carry headers, and every answer must carry the security headers. The cost is no hot reload; restart the server to see a change to the page.
- The pages: `/` (`index.html`, the landing page), `/docs` (`docs.html`), `/login` (`login.html`), `/signup` (`signup.html`), and the app at `/app` and `/app/*` (`app.html`). Any other path gets `not-found.html` with a 404, and anything under `/api/` gets `{ error }`. A new page adds its HTML file under `public/` and a line in `PAGES`; the landing page and docs already have theirs.
- A public page's navigation is static markup in its HTML: the product name, Docs, then Log in and Sign up. Copy it from `login.html`, marking the current page with `aria-current="page"`.
- The content security policy allows only the app's own origin, plus `blob:` workers for fflate. Inline scripts, `<style>` elements, and `style="..."` attributes in markup are blocked, so style through class names and the stylesheets.

## The app page

`app.html` loads `src/app/main.ts`, which asks `auth.me()` who is logged in, draws the top navigation (`src/app/nav.ts`), and starts the router (`src/app/router.ts`). The page reaches the server only through the SDK client in `src/app/client.ts`, which sends any 401 to `/login?next=<where you were>`; logging in goes back there. Log in and sign up (`src/pages/`) follow the server's `next`.

The route table is `src/app/routes.ts`. Every screen in the spec already has its route and a module, so a screen's ticket edits only its own module:

| Path | Screen module | Owner |
| --- | --- | --- |
| `/app` | `src/screens/dashboard.ts`, a placeholder | m1kuorg/basics#47 |
| `/app/projects` | `src/screens/projects.ts`: list, create, rename, delete; its empty state offers the demo project (m1kuorg/basics#43) | m1kuorg/basics#42 |
| `/app/projects/:projectId` | `src/screens/project.ts`, a placeholder: the card stack, unsorted, and uploads go here | m1kuorg/basics#45 |
| `/app/projects/:projectId/upload` | `src/screens/upload.ts`: the instructions, the drop zone, the preview, and sending in chunks. `?upload=<id>` shows one finished upload and watches its sort: progress, and a failure with a retry (m1kuorg/basics#44), and `?export=demo` uploads the demo export into a demo project. `startDemoProject()` is the demo action, for the dashboard too | m1kuorg/basics#43 |
| `/app/cards/:cardId` | `src/screens/card.ts`, a placeholder: the card and its cold rep | m1kuorg/basics#46 |
| `/app/settings` | `src/screens/settings.ts`: the profile, the password, API keys, and the setup snippets to connect an agent; #49 adds its own sections | m1kuorg/basics#48, then #49 |
| anything else under `/app` | `src/screens/not-found.ts` | m1kuorg/basics#42 |

A screen is `(root: HTMLElement, props: ScreenProps<"param">) => void | Promise<void>`. The router empties `#app`, sets `#app[data-screen="<name>"]` and the page title, marks the navigation's section, and mounts the screen with:

- `params` (decoded `:params`, typed from the path) and `query`;
- `client` (the SDK), `account` (who is logged in), and `setAccount`, which a screen calls after changing the name or email so the navigation shows it;
- `navigate(path)`, though plain `<a href="/app/...">` links are followed without a reload anyway;
- `signal`, aborted when the learner leaves, so nothing a screen was still fetching draws over the next one. `load()` from `src/parts/frame.ts` checks it for you.

A screen's own views (such as a project's unsorted phrasings, or one upload's progress) can live in its `query` rather than in a new route.

## Shared parts

Each part is a function that returns elements, in `src/parts/`, styled by `public/styles/parts.css` (and `shell.css` for the frame). Strings are always set as text, never as HTML.

| Module | Parts |
| --- | --- |
| `dom.ts` | `el(tag, className, ...children)`, `button(text, onClick, className)`, `link(text, href, className)`, `uniqueId()`. Button classes: none for the primary, `secondary` for the safe choice, `retry`, `quiet` for row and navigation actions; `link(..., "button")` looks like a button |
| `frame.ts` | `frame(root, marginNotes)` mounts `aside.margin` and `main.block`; `plate(count, caption)`, the one reversed plate; `waiting(line)`; `notice(message)`; `failure(error, onRetry)`; `load(block, { keep, line, request, show, signal })`, which shows the waiting line, then the result or the error and a retry |
| `fields.ts` | `field({ label, name, type, hint, ... })`, a label over a box with an optional hint; `form({ fields, submit, onSubmit, layout })`, which locks its button while `onSubmit` runs and shows a thrown error as its notice. `layout: "row"` sets one field and its button on one line |
| `rows.ts` | `rows({ caption, columns, items, detail })`, a table between hairlines with right-aligned numeric columns, a hidden-label actions column, and an optional full-width detail row under an item. Put a title and its labels in `span.row-title` |
| `empty.ts` | `emptyState(title, body, ...actions)` |
| `confirm.ts` | `confirmDelete({ title, body, action, onConfirm, onCancel })`, the delete confirmation, in place (a `rows` detail row, say), never a modal |
| `drop-zone.ts` | `dropZone({ title, hint, accept, onFile })` |
| `code-block.ts` | `codeBlock(caption, code)`, with its copy button |
| `library.ts` | `PRIVACY_LINE` and `privacyLine()`, the spec's privacy line; `demoLabel()`; `stamp(iso)`, a date in the learner's time zone |
| `messages.ts` | `messageOf(error)`: the API's message, or a connection failure |

A new part that more than one screen needs goes here, with its rules in `parts.css` and a sample in `scripts/lib/parts-sample.ts`; record it in `docs/DESIGN.md` under Components.

## Stylesheets

Each page links the stylesheets it needs, in this order: `base.css` (faces, tokens, links, buttons), `shell.css` (navigation, margin, block, plate), `parts.css`, then its surfaces. `app.html` links every app surface's file already, so a ticket never edits it to add styles.

| File | What it styles | Owner |
| --- | --- | --- |
| `base.css`, `shell.css`, `parts.css` | Everything shared | m1kuorg/basics#42 |
| `account.css` | Log in, sign up, and the not-found page | m1kuorg/basics#42 |
| `projects.css` | The projects list | m1kuorg/basics#42 |
| `stack.css` | The card stack: margin keys, the rail, the key drop, the end rule, as the proof of concept shipped them | m1kuorg/basics#45 |
| `rep.css` | The cold rep, as the proof of concept shipped it | m1kuorg/basics#46 |
| `dashboard.css` | The dashboard | m1kuorg/basics#47 |
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

- `startApp(env?)` from `scripts/lib/app.ts` starts `bun server.ts` on a free port with a temporary database, and returns `{ url, databasePath, log, browser, stop }`. `env` overrides settings, such as `DAILY_MODEL_REQUESTS`.
- Finishing an upload starts a sort, which asks the model. A check that doesn't prove the sort's quality starts a model stand-in, `startModelStub(reply(keySorter))` from `scripts/lib/`, and passes its `url` as `ANTHROPIC_BASE_URL` to `startApp()`, so it needs no key and its sorts end as the answer key says. The stand-in also holds, refuses, or reads requests, for a check of waiting and failure states or of what the model is sent.
- `app.browser()` is one browser: an SDK client that keeps its own session cookie and sends the app's `Origin`. `cookie()` gives its Cookie header for requests made without the SDK. A script can also make a key with `keys.create` and reach the API as a script or agent would, with `createClient({ baseUrl: app.url, apiKey })`.
- Each copy of the app allows 20 sign-up and log-in tries per address in 15 minutes, so a script making many accounts should start its own copy.
- A browser check stubs a request only inside the script, with Playwright's `page.route`, never in the app.
- `check:styles` signs up one learner on a fresh copy of the app, then runs every module in `scripts/styles/`, in name order. A module's default export is `(kit: Kit) => Promise<void>` (`scripts/lib/styles.ts`): it opens pages with `kit.page({ loggedIn })` and `kit.open()`, drives them into each state, and calls `kit.shoot(page, name)`, which saves the screenshot and checks the type floor, vermilion, radius and shadow, the inks, contrast, the plate count, and sideways scroll. A surface's ticket adds its own module rather than editing another's. `shell.ts` and `parts.ts` are m1kuorg/basics#42's; `stack.ts` and `rep.ts` set the proof of concept's sample markup into the app page until m1kuorg/basics#45 and #46 retarget them to their real screens.

## Proof-of-concept leftovers

| Piece | Retired or retargeted by |
| --- | --- |
| The single page at `/` and its screens | Retired by m1kuorg/basics#42: the load, stack, and rep screens became the upload, project, and card placeholders |
| `src/parser.ts`, used by the model routes' checks and the styles samples | Retired by m1kuorg/basics#43: those read the demo export through `scripts/lib/demo.ts`, which uses the SDK's reader |
| `src/api.ts`, the group request's shape | Deleted by m1kuorg/basics#44 |
| `src/cards.ts` and `src/types.ts`, used by the rep and check routes, `check:cards`, and the stack and rep styles samples | m1kuorg/basics#45 and #46, with those samples and routes |
| `POST /api/group` | Deleted by m1kuorg/basics#44: the sort (`server/sort.ts`) replaces it |
| `POST /api/rep`, `/api/check` in `server/routes/`, with no account and no cap | m1kuorg/basics#46 |
| `check:grouping` | Replaced by m1kuorg/basics#44's `check:sort`, the incremental sort check |
| `check:key`, `check:cards` | The answer key against the export, and the card builder the styles samples use; they go when nothing uses the builder |
| `check:rep-routes` | m1kuorg/basics#46 |
| `check:rep` and `journey`, which walked the single page | Deleted by m1kuorg/basics#42; m1kuorg/basics#46 adds the card page's browser check, and m1kuorg/basics#53 the app journey as `bun run journey` |
| `scripts/styles/stack.ts` and `rep.ts`, sample markup | m1kuorg/basics#45 and #46 retarget them to the real project and card pages |

The proof of concept's checks that start `bun server.ts` themselves use the default database, `data/asked-before.sqlite`, which is gitignored.
