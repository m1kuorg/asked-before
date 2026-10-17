# Code map

Where each piece of the app lives, which ticket of the spec (m1kuorg/basics#40) owns it, and the seams that let tickets run in parallel without editing the same lines. A ticket that adds, moves, or retires a piece updates its row here. Ticket numbers are issues in m1kuorg/basics.

Contents:

1. [Layout](#layout)
1. [The API's route table](#the-apis-route-table)
1. [Adding an endpoint](#adding-an-endpoint)
1. [Wire conventions](#wire-conventions)
1. [The store](#the-store)
1. [Pages](#pages)
1. [Check scripts](#check-scripts)
1. [Proof-of-concept leftovers](#proof-of-concept-leftovers)

## Layout

The repo is a Bun workspace: the app at the root, and `packages/sdk` and `packages/mcp`.

| Path | What it holds | Owner |
| --- | --- | --- |
| `server.ts` | The one process: composes the pages, the API, and the proof of concept's routes, all through `serve()`; its fallback is the 404, as `{ error }` under `/api/` | m1kuorg/basics#41 |
| `server/config.ts` | Settings from the environment, with defaults: `PORT`, `DATABASE_PATH`, `PUBLIC_URL`, `DAILY_MODEL_REQUESTS` | m1kuorg/basics#41; `SORT_BATCH_SIZE` joins with m1kuorg/basics#44 |
| `server/http.ts` | `HttpError`, `readJson`, `notBuilt`, `defineRoutes`, and `serve()`, which answers errors, adds the security headers, and logs | m1kuorg/basics#41 |
| `server/auth.ts` | `authed()`, `sameOrigin()`, and the session cookie; `authenticateKey()` is a stub that refuses every key | m1kuorg/basics#41; the key lookup is m1kuorg/basics#48's |
| `server/throttle.ts` | The per-IP throttle on signing up and logging in | m1kuorg/basics#41 |
| `server/model.ts` | The model client. Its `userId` argument is the daily cap's hook: it spends one of the account's daily requests, or throws 429 | Proof of concept; m1kuorg/basics#44 passes `userId` and proves the cap |
| `server/api/index.ts` | The API's route table, composed from the areas here and only here | m1kuorg/basics#41 |
| `server/api/<area>.ts` | One module per area of the spec's API table | See [the route table](#the-apis-route-table) |
| `server/store/db.ts` | The SQLite connection: foreign keys, WAL, busy timeout, and the schema | m1kuorg/basics#41 |
| `server/store/schema.sql` | The spec's whole schema, and the `card_status` view | m1kuorg/basics#41; changed in place by whoever needs to |
| `server/store/users.ts`, `sessions.ts`, `projects.ts`, `usage.ts` | Accounts, sessions, projects with their counts, and the daily model-request counters | m1kuorg/basics#41; m1kuorg/basics#48 and #49 add to `users.ts` and `sessions.ts` |
| `server/store/<area>.ts` | A new store module per area, such as `uploads.ts`, `cards.ts`, `reps.ts`, and `keys.ts` | The area's ticket |
| `server/pages.ts` | The page table, built at startup; `/assets/*`, the demo exports, and `notFound` | m1kuorg/basics#42; the landing page is m1kuorg/basics#52's |
| `server/routes/` | The proof of concept's three model routes | Retired by m1kuorg/basics#44 and #46 |
| `public/`, `src/` | The page | m1kuorg/basics#42, then each screen's ticket |
| `packages/sdk/src/client.ts` | `createClient()`, which composes the areas | m1kuorg/basics#41 |
| `packages/sdk/src/http.ts` | The request function, `ApiError`, and the `path` tag | m1kuorg/basics#41 |
| `packages/sdk/src/<area>.ts` | Each area's types and methods; stub areas have none yet | See [the route table](#the-apis-route-table) |
| `packages/sdk/src/index.ts` | The SDK's exports. Every area's types are exported already | m1kuorg/basics#41; m1kuorg/basics#43 adds the export readers |
| `packages/mcp/src/server.ts` | A placeholder; `@modelcontextprotocol/server` and `zod` are installed | m1kuorg/basics#50 |
| `scripts/lib/app.ts` | `startApp()`, the one helper that starts the app for a check | m1kuorg/basics#41 |
| `scripts/check-accounts.ts` | `bun run check:accounts` | m1kuorg/basics#41 |

Installed up front: `fflate` in `packages/sdk` for the export readers, `@modelcontextprotocol/server` in `packages/mcp`, and `@modelcontextprotocol/client` at the root for check scripts.

## The API's route table

Every endpoint is under `/api/v1`. An endpoint whose ticket hasn't landed answers 501 with `{ error }`; anything else under `/api/` is a 404. "Session only" means `authed(..., { sessionOnly: true })`: an API key gets 403 there.

| Area | Method and path | SDK method | Owner |
| --- | --- | --- | --- |
| Auth | `POST /auth/signup` | `auth.signUp` | m1kuorg/basics#41 |
| Auth | `POST /auth/login` | `auth.logIn` | m1kuorg/basics#41 |
| Auth | `POST /auth/logout`, session only | `auth.logOut` | m1kuorg/basics#41 |
| Auth | `GET /auth/me` | `auth.me` | m1kuorg/basics#41 |
| Account | `PATCH /account`, session only | `account` | m1kuorg/basics#48 |
| Account | `POST /account/password`, session only | `account` | m1kuorg/basics#48 |
| Account | `GET /account/export`, session only | `account` | m1kuorg/basics#49 |
| Account | `DELETE /account`, session only | `account` | m1kuorg/basics#49 |
| API keys | `GET /keys`, `POST /keys`, `DELETE /keys/:keyId`, session only | `keys` | m1kuorg/basics#48 |
| Projects | `GET /projects`, `POST /projects` | `projects.list`, `projects.create` | m1kuorg/basics#41 |
| Projects | `GET /projects/:projectId`, `PATCH /projects/:projectId` | `projects.get`, `projects.rename` | m1kuorg/basics#41 |
| Projects | `DELETE /projects/:projectId`, session only | `projects.delete` | m1kuorg/basics#41 |
| Uploads | `GET /projects/:projectId/uploads`, `POST /projects/:projectId/uploads` | `uploads` | m1kuorg/basics#43 |
| Uploads | `GET /uploads/:uploadId`, `POST /uploads/:uploadId/phrasings`, `POST /uploads/:uploadId/finish` | `uploads` | m1kuorg/basics#43 |
| Uploads | `POST /uploads/:uploadId/retry` | `uploads` | m1kuorg/basics#44 |
| Uploads | `DELETE /uploads/:uploadId`, session only | `uploads` | m1kuorg/basics#45 |
| Cards | `GET /projects/:projectId/cards`, `GET /projects/:projectId/unsorted`, `GET /cards/:cardId` | `cards` | m1kuorg/basics#44 |
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
- A list comes inside an object, as `{ projects: [...] }`, and the SDK unwraps it. Lists that can grow without bound take a limit and a cursor.
- Card status is `"borrowed"`, `"returned"`, or `"borrowed_again"`, from the `card_status` view. A project's counts are `{ cards, borrowed, returned, borrowedAgain }`.
- A model failure is a `ModelError`, an `HttpError` with status 502. Past the daily cap, the model client throws 429.
- Signing up and logging in return `{ account, next }`. `next` echoes the request's `next` only when it's a path inside the app, and is otherwise `/app`, the app's home. The page goes there; m1kuorg/basics#42 serves the app at `/app` and its client routes under `/app/`.
- A cookie-authenticated request that changes something must carry an `Origin` matching the app's origin, and a JSON content type unless it's a bodiless DELETE. The SDK sends JSON on every POST and PATCH, and the browser adds the `Origin`. Signing up and logging in follow the same rule, against forged log-ins, before the throttle counts the try. Either one ends the session the browser already had.
- A Bearer key, when sent, is the only credential considered; the cookie is ignored.

## The store

- `schema.sql` is applied at every start. Tables are create-if-missing and change in place, since nothing has shipped. A changed table doesn't reach a database that already has it, so delete your local `data/` folder after changing one; check scripts always start with a fresh database.
- Every child table cascades on delete from its parent. A phrasing's `card_id` is set to null when its card goes, which leaves it unsorted.
- `card_status` gives, per card, `borrows`, `first_borrow_at`, `last_borrow_at`, `returned_at` (the latest passed rep's `checked_at`), and `status`, comparing timestamps rather than dates.
- `usage` counts model requests per account per UTC day; `spendModelRequest()` in `store/usage.ts` is the only writer.
- Sessions store the SHA-256 of the cookie's token. An API key's secret is meant to be stored the same way, in `api_keys.secret_hash`.

## Pages

- `PAGES` in `server/pages.ts` maps each page's path to its HTML file, named as under `public/`. At startup, `Bun.build` bundles them with their scripts, styles, and fonts into memory. Pages are served with `no-cache` and the hashed assets under `/assets/` as immutable.
- Bun's HTML-import routes are deliberately not used: their answers can't carry headers, and every answer must carry the security headers. The cost is no hot reload; restart the server to see a change to the page.
- To add a page, add its HTML file under `public/` and a line for it in `PAGES`, such as `"/login": "login.html"`. The app's single page needs both `/app` and `/app/*`. m1kuorg/basics#42 and #52 both add lines there.
- The content security policy allows only the app's own origin, plus `blob:` workers for fflate. Inline scripts, `<style>` elements, and `style="..."` attributes in markup are blocked, so style through class names and the stylesheet, as the proof of concept's screens do.

## Check scripts

- `startApp(env?)` from `scripts/lib/app.ts` starts `bun server.ts` on a free port with a temporary database, and returns `{ url, databasePath, log, browser, stop }`. `env` overrides settings, such as `DAILY_MODEL_REQUESTS`.
- `app.browser()` is one browser: an SDK client that keeps its own session cookie and sends the app's `Origin`. `cookie()` gives its Cookie header for requests made without the SDK. Until API keys land (m1kuorg/basics#48), scripts reach the API this way.
- Each copy of the app allows 20 sign-up and log-in tries per address in 15 minutes, so a script making many accounts should start its own copy.

## Proof-of-concept leftovers

| Piece | Retired or retargeted by |
| --- | --- |
| The page at `/`: `public/index.html`, `src/main.ts`, `src/screens/`, `src/parser.ts`, `src/api.ts`, `src/types.ts`, `src/cards.ts` | m1kuorg/basics#42 moves the screens under the router; m1kuorg/basics#43 replaces the parser with the SDK's readers |
| `POST /api/group`, `/api/rep`, `/api/check` in `server/routes/`, with no account and no cap | m1kuorg/basics#44 (group) and m1kuorg/basics#46 (rep and check) |
| `check:key`, `check:cards`, `check:grouping` | m1kuorg/basics#44 replaces the grouping check with the incremental sort check |
| `check:styles`, `check:rep`, `check:rep-routes`, `journey` | m1kuorg/basics#42, #45, and #46 retarget them; m1kuorg/basics#53 replaces the journey |

The proof of concept's checks that start `bun server.ts` themselves use the default database, `data/asked-before.sqlite`, which is gitignored.
