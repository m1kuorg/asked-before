# Asked Before

It turns the questions you keep asking a chatbot into library cards, stamped once per borrow, and won't stamp a card returned until you pass a cold rep: a fresh problem of the same kind, solved without AI.

You sign up, make a project for each part of your life, and upload a ChatGPT or Claude export into it. Your browser reads the export and sends only your own messages, with when you sent them; the chatbot's answers and your titles never leave your computer, and the model sees your words only, never your dates. Asked Before sorts them into cards, most borrowed first, and the dashboard shows what's still borrowed across your projects. A TypeScript SDK, an MCP server, and a Claude Code plugin let your scripts and coding agents reach the same cards, so a question you ask an agent lands on its card as you ask it.

This branch, `feat/app`, holds the app. `main` holds the proof of concept submitted to the hackathon, a single page on a made-up demo export, until judging ends on October 30, 2026.

Contents:

1. [Run it](#run-it)
1. [Check it](#check-it)
1. [Self-host it](#self-host-it)
1. [The SDK](#the-sdk)
1. [Agents](#agents)
1. [Disclosures](#disclosures)
1. [License](#license)

## Run it

You need [Bun](https://bun.com) 1.4 or later and an Anthropic API key.

```sh
git clone --branch feat/app https://github.com/m1kuorg/asked-before.git
cd asked-before
bun install
cp .env.example .env        # then set ANTHROPIC_API_KEY=...
bun run start
```

Then open <http://localhost:3000>, sign up, and make a project. A new learner can try the demo project, made from a made-up demo export and labeled as demo data, before finding their own export. Only the server reads the key, and `.env` is gitignored.

Everything else has a default, so the key is the only setting you need. `.env.example` lists them:

| Setting | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | The model key. The app starts without it, but every sort and cold rep fails. |
| `PORT` | `3000` | The port the server listens on. |
| `DATABASE_PATH` | `data/asked-before.sqlite` | The SQLite file. Its folder is made if it's missing. |
| `PUBLIC_URL` | unset | The address people reach the app at. Unset, a request's own origin counts as the app's; an `https` address makes the session cookie `Secure`. |
| `DAILY_MODEL_REQUESTS` | `300` | Model requests one account may make per UTC day. |
| `SORT_BATCH_SIZE` | `300` | Phrasings a sort sends the model at once. |

Nothing has shipped, so the schema changes in place: after pulling a change to `server/store/schema.sql`, delete your `data/` folder. Migrations come before the first deployment (m1kuorg/basics#54).

## Check it

There are no unit tests. Every check starts its own copy of the app on a free port, with a fresh database, and drives it from outside: the API through the SDK, the pages in a real browser, and the MCP server through the official MCP client. Each one prints its steps and exits 1 naming the step that failed. The browser checks drive Playwright's Chromium, so a fresh clone needs it once:

```sh
bunx playwright install chromium
```

Then walk the whole product:

```sh
bun run journey
```

It needs the key, and makes 6 model calls in under a minute, with nothing stubbed. In Chromium at 1920×1080, it signs up from the landing page, makes a project, uploads the demo export through the upload page's file input, and checks card A against the demo export's answer key, word for word. It fails a cold rep on card A with a known wrong answer and passes the next with a known right one, sees the return on the dashboard, and makes an API key in Settings. Then it lists the cards through the SDK with that key, and records a rephrasing of card A's question through the MCP server, so card A's count goes up by one and it's borrowed again. It saves a screenshot of each step in your temp folder, or in `<dir>` with `bun run journey <dir>`.

The other checks:

| Command | What it checks | Needs |
| --- | --- | --- |
| `bun run check:key` | The demo export's answer key against the export | |
| `bun run check:accounts` | Accounts and projects through the SDK: sessions, `next`, 404s across accounts, the Origin rule, the logs, the throttle | |
| `bun run check:shell` | The app's shell: sign up, the dashboard, projects, log out, and the redirect to log in and back | Chromium |
| `bun run check:landing` | The landing page's card against the answer key, and signing up and logging in from it | Chromium |
| `bun run check:readers` | The SDK's export readers on every fixture, and on broken exports | |
| `bun run check:uploads` | The uploads endpoints, and uploading the same export twice | |
| `bun run check:upload-page` | The upload page: the preview, what it sends, failures, and the demo action | Chromium |
| `bun run check:sort` | Sorting the demo export three ways, against the answer key; `bun run check:sort 10` for 10 runs | Key |
| `bun run check:sort-rules` | The sort's rules and the cards endpoints, with the model stubbed | |
| `bun run check:sort-page` | The upload page's sort progress, failure, retry, and daily cap, with the model stubbed | Chromium |
| `bun run check:project` | A project's card stack, statuses, unsorted phrasings, and upload history | Chromium |
| `bun run check:reps` | Five cold reps on card A: lessons, problems, and verdicts | Key |
| `bun run check:rep-rules` | The cold reps' rules through the SDK, with the model stubbed | |
| `bun run check:card-page` | A card's page and its cold rep: card A with the real model, then waits and failures stubbed | Key, Chromium |
| `bun run check:dashboard` | The dashboard through the SDK and in the page | Chromium |
| `bun run check:settings` | API keys and the account, through the SDK and in the settings page | Chromium |
| `bun run check:data` | Downloading and deleting your data | Chromium |
| `bun run check:captures` | Captures' rules through the SDK, with the model stubbed | |
| `bun run check:capture-sort` | Where captures land with the real model; `bun run check:capture-sort 3` for 3 runs | Key |
| `bun run check:mcp` | The MCP server over stdio with the official client and a real key | Key |
| `bun run check:plugin` | The Claude Code plugin: validated, its server's build fresh, and the build run from a copy as Claude Code runs it | `claude`, `node` |
| `bun run check:docs` | The docs page against the server's route table, and the SDK's quickstart run on the demo export | Chromium |
| `bun run check:sdk` | The SDK's build, used from a project outside the repo, in Bun and in Node | `node` |
| `bun run check:styles` | The stylesheets at 1080p, surface by surface (`scripts/styles/`) | Chromium |
| `bun run check:container` | The container image: it builds, serves the app, keeps its data on the volume across a restart and a new container, and its health check answers | Docker |

A check that needs the key and stubs nothing calls the real model; the others stub it inside the script, never in the app, so they need no key. After a change to the MCP server or the SDK, `bun run build:plugin` rebuilds the plugin's server, which `check:plugin` fails on until you do. A new API route needs its row on the docs page, `src/pages/docs.ts`, or `check:docs` fails. [`docs/code-map.md`](docs/code-map.md) says where each piece lives.

## Self-host it

The app is one Bun process with one SQLite file, so it runs on any host with a persistent disk. The `Dockerfile` builds it on the official Bun image, with the database on a volume at `/data` and a health check that Bun runs against `/api/v1/health`:

```sh
docker build -t asked-before .
docker run -d --name asked-before -p 3000:3000 \
  -v asked-before-data:/data \
  -e ANTHROPIC_API_KEY \
  -e PUBLIC_URL=https://asked-before.example \
  asked-before
```

`-e ANTHROPIC_API_KEY` passes the key from your shell without writing it down. The app serves plain HTTP, so put it behind your host's HTTPS, and set `PUBLIC_URL` to that address: it's the origin the app accepts changes from, and an `https` one makes the session cookie `Secure`. Back up the volume, which holds everything. The logs carry only each request's method, path, status, and duration, never your words.

Without Docker, run `bun install --production` and `bun run start` with `DATABASE_PATH` on the persistent disk.

## The SDK

`@asked-before/sdk`, in `packages/sdk`, is a typed client for the HTTP API, version 1, with one method per endpoint, and the export readers the upload page uses, which read an export on your computer in Bun, Node, or a browser. The page reaches the server only through it. It isn't on npm; `bun run build:sdk` builds it to JavaScript with type declarations, for another project to add from your copy. Its [README](packages/sdk/README.md) has the quickstart, which reads an export, uploads it, and lists the cards. The docs page, at `/docs` on any Asked Before server, lists every endpoint with the credential it needs.

## Agents

Coding agents reach your cards through the MCP server in `packages/mcp`, with an API key from Settings: it records your how-to questions as captures, in your own words only, tells you when one is on a card you've asked before, and runs cold reps in the chat. In Claude Code, the Asked Before plugin in `plugins/asked-before` brings the server and a skill that says when to use it, in one install from this repo's marketplace:

```sh
claude plugin install asked-before --marketplace m1kuorg/asked-before \
  --config server_url=http://localhost:3000 \
  --config api_key=YOUR_API_KEY
```

The plugin installs once the repo is public. For Claude Desktop, Cursor, or Claude Code without the plugin, Settings shows each agent's setup with your server's address filled in, and the [MCP server's README](packages/mcp/README.md) explains it.

## Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project, and worked with the Devpost Learn Skill Pack manually.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

## License

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, and the SIL Open Font License of the self-hosted Hanken Grotesk font. The plugin's built MCP server, `plugins/asked-before/dist/server.js`, carries the MCP TypeScript SDK (Apache 2.0) and zod (MIT) inside it.
