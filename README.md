# Asked Before

It turns the questions you keep asking a chatbot into library cards, stamped once per borrow, and won't stamp a card returned until you pass a cold rep: a fresh problem of the same kind, solved without AI.

You sign up, make a shelf for each part of your life, and upload a ChatGPT or Claude export onto it. Your browser reads the export and sends only your own messages, with when you sent them; the chatbot's answers and your titles never leave your computer, and the model sees your words only, never your dates. Asked Before sorts them into cards, most borrowed first, and the Desk shows what's still borrowed across your shelves. A TypeScript SDK, an MCP server, and a Claude Code plugin let your scripts and coding agents reach the same cards, so a question you ask an agent lands on its card as you ask it.

The app runs on Cloudflare Workers, with its data in D1 ([ADR 0005](docs/adr/0005-cloudflare-workers-d1-and-a-durable-object-per-shelf.md)). Until it merged into `main` on October 18, 2026, `main` held the proof of concept submitted to the hackathon, a single page on a made-up demo export; that's `main`'s history up to commit `6bfe2dc`.

Contents:

1. [Run it](#run-it)
1. [Check it](#check-it)
1. [Deploy it](#deploy-it)
1. [The SDK](#the-sdk)
1. [Agents](#agents)
1. [Disclosures](#disclosures)
1. [License](#license)

## Run it

You need [Bun](https://bun.com) 1.4 or later, [Node.js](https://nodejs.org) 22 or later, and an Anthropic API key. You don't need a Cloudflare account: Wrangler, Cloudflare's command line, runs the app on your computer as Workers would, on Node.js.

```sh
git clone https://github.com/m1kuorg/asked-before.git
cd asked-before
bun install
cp .env.example .env        # then set ANTHROPIC_API_KEY=...
bun run dev
```

`bun run dev` builds the pages into `dist/`, applies the schema's migrations to a local database in `.wrangler/`, and starts the app with `wrangler dev`. Then open the address it prints, <http://localhost:8787> unless that port is taken, sign up, and make a shelf. A new learner can try the demo shelf, made from a made-up demo export and labeled as demo data, before finding their own export. The Worker isn't the only reader of the key: Wrangler gives it to the Worker from `.env`, and Bun loads the same file into the check scripts, which read the key too, to check for it before calling the real model and to pass it on to the `wrangler dev` they start. `.env` is gitignored; a key exported in your shell works too, and wins over `.env`.

Your local data stays in `.wrangler/` from one run to the next; delete that folder to start again with an empty database. Wrangler reloads the Worker when its code changes, but not the pages: run `bun run build:pages` to see a change to them.

The key is the only setting you need. The others are vars in `wrangler.jsonc`, each with a default:

| Setting | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | The model key, from `.env` or your shell, and a Worker secret once deployed. The app starts without it, but every sort and cold rep fails. |
| `PUBLIC_URL` | empty | The address people reach the deployed app at. Empty, a request's own origin counts as the app's; an `https` address makes the session cookie `Secure`. `bun run dev` always runs with it empty. |
| `DAILY_MODEL_REQUESTS` | `10` | Model requests one account may make per UTC day. |
| `SITE_DAILY_MODEL_REQUESTS` | `200` | Model requests the whole app may make per UTC day, across every account. |
| `DAILY_PHRASINGS` | `1000` | Phrasings one account may send per UTC day, uploads and captures together. |
| `SITE_DAILY_PHRASINGS` | `8000` | Phrasings the whole app may take per UTC day, across every account. |
| `FIRST_DAY_SITE_DAILY_MODEL_REQUESTS` | `100` | The part of `SITE_DAILY_MODEL_REQUESTS` an account on its first UTC day, the day it was made, may reach: once the whole app has made this many today, across every account, only older accounts carry on. |
| `FIRST_DAY_SITE_DAILY_PHRASINGS` | `4000` | The part of `SITE_DAILY_PHRASINGS` an account on its first UTC day may reach, counted the same way. |
| `NETWORK_DAILY_SIGNUPS` | `3` | Accounts one network, an IPv4 address or an IPv6 /64, may make per UTC day. Signing up and logging in also allow 20 tries from one network in 15 minutes. |
| `SORT_BATCH_SIZE` | `300` | Phrasings a sort sends the model at once. |

The schema is a series of Wrangler's D1 migrations, the numbered files in `migrations/`; see [Deploy it](#deploy-it).

## Check it

There are no unit tests. Every check starts its own copy of the app under `wrangler dev`, on a free port, with a fresh local database, and drives it from outside: the API through the SDK, the pages in a real browser, and the MCP server through the official MCP client. Each one prints its steps and exits 1 naming the step that failed. `bun run typecheck` checks the types of the Worker, the pages, and the scripts. The browser checks drive Playwright's Chromium, so a fresh clone needs it once:

```sh
bunx playwright install chromium
```

Then walk the whole product:

```sh
bun run journey
```

It needs the key, and makes 6 model calls, with nothing stubbed. In Chromium at 1920×1080, it signs up from the landing page, makes a shelf, uploads the demo export through the upload page's file input, and checks card A against the demo export's answer key, word for word. It fails a cold rep on card A with a known wrong answer and passes the next with a known right one, sees the return on the Desk, and makes an API key in Settings. Then it lists the cards through the SDK with that key, and records a rephrasing of card A's question through the MCP server, so card A's count goes up by one and it's borrowed again. It saves a screenshot of each step in your temp folder, or in `<dir>` with `bun run journey <dir>`.

The other checks:

| Command | What it checks | Needs |
| --- | --- | --- |
| `bun run check:smoke` | The app on Workers: every page, an asset, and the demo export with the security headers, one content security policy, the answer key never served, an unknown endpoint's 404 JSON, and signing up | |
| `bun run check:key` | The demo export's answer key against the export | |
| `bun run check:accounts` | Accounts and shelves through the SDK: sessions, `next`, 404s across accounts, the Origin rule, the logs, the throttle | |
| `bun run check:passwords` | The password never reaching the server: every request the page sends to sign up, log in, change the password or email, and delete the account, the API refusing anything but a key, and the database keeping only its salted hash | Chromium |
| `bun run check:caps` | The daily caps, set small: an account's phrasings, the app's phrasings, and the app's model requests, each a 429 through the SDK and in the upload page | Chromium |
| `bun run check:fresh-accounts` | What keeps fresh accounts from draining the app's day, set small: the throttle by IPv6 /64, a network's daily sign-ups, and the share of the app's caps that accounts made today get, each a 429 through the SDK and in the page | Chromium |
| `bun run check:shell` | The app's shell: sign up, the Desk, your shelves, log out, and the redirect to log in and back | Chromium |
| `bun run check:landing` | The landing page's card against the answer key, and signing up and logging in from it | Chromium |
| `bun run check:readers` | The SDK's export readers on every fixture, and on broken exports | |
| `bun run check:uploads` | The uploads endpoints, and uploading the same export twice | |
| `bun run check:upload-page` | The upload page: the preview, what it sends, a zip read under the content security policy, failures, and the demo action | Chromium |
| `bun run check:sort` | Sorting the demo export three ways, against the answer key; `bun run check:sort 10` for 10 runs | Key |
| `bun run check:sort-rules` | The sort's rules and the cards endpoints, with the model stubbed, a sort that carries on after `wrangler dev` is killed mid-sort, and sorts that fail to start or stall, which a retry or the cron starts again | |
| `bun run check:sort-page` | The upload page's sort progress, failure, retry, and daily cap, with the model stubbed | Chromium |
| `bun run check:shelf` | A shelf's card stack, statuses, unsorted phrasings, and upload history | Chromium |
| `bun run check:reps` | Five cold reps on card A: lessons, problems, and verdicts | Key |
| `bun run check:rep-rules` | The cold reps' rules through the SDK, with the model stubbed | |
| `bun run check:card-page` | A card's page and its cold rep: card A with the real model, then waits and failures stubbed | Key, Chromium |
| `bun run check:desk` | The Desk through the SDK and in the page | Chromium |
| `bun run check:settings` | API keys and the account, through the SDK and in the settings page | Chromium |
| `bun run check:data` | Downloading and deleting your data, a big account's too, each download read in one D1 batch | Chromium |
| `bun run check:captures` | Captures' rules through the SDK, with the model stubbed | |
| `bun run check:capture-sort` | Where captures land with the real model; `bun run check:capture-sort 3` for 3 runs | Key |
| `bun run check:mcp` | The MCP server over stdio with the official client and a real key | Key |
| `bun run check:plugin` | The Claude Code plugin: validated, its server's build fresh, and the build run from a copy as Claude Code runs it | `claude` |
| `bun run check:docs` | The docs page against the server's route table, and the SDK's quickstart run on the demo export | Chromium |
| `bun run check:sdk` | The SDK's build, used from a package outside the repo, in Bun and in Node | |
| `bun run check:styles` | The stylesheets at 1080p, surface by surface (`scripts/styles/`) | Chromium |
| `bun run check:migrations` | The schema's D1 migrations: each applied once on a fresh database; a new one, added in a copy of the app, that rebuilds a table and keeps the data beneath it; and a failing one applying nothing | |

A check that needs the key and stubs nothing calls the real model; the others stub it inside the script, never in the app, so they need no key. Every check starts its app with the daily caps lifted, unless it checks one. After a change to the MCP server or the SDK, `bun run build:plugin` rebuilds the plugin's server, which `check:plugin` fails on until you do. A new API route needs its row on the docs page, `src/pages/docs.ts`, or `check:docs` fails. [`docs/code-map.md`](docs/code-map.md) says where each piece lives.

## Deploy it

The app runs on [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/). Free gives a request, a cron run, and each of the sort's Durable Object alarms 10 ms of CPU time, so the server never hashes a password: the SDK, in the page or your script, derives a key from it with scrypt, and the server keeps only a salted SHA-256 of that key (ADR 0006). Free's real ceiling is D1's 100,000 rows written a day for the whole Cloudflare account, past which every query fails, logging in too; a phrasing stored and sorted writes 7 to 9. The daily caps in [Run it](#run-it) keep the app under it: 1,000 phrasings an account and 8,000 for the app, and 10 model requests an account and 200 for the app. So that fresh accounts can't spend the app's whole day and lock everyone out until midnight UTC, an account made today stops once the app has used half of either cap, and one network makes at most 3 accounts a day. [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/), $5 a month, lifts the CPU and D1 limits; raise the caps in `wrangler.jsonc`'s `vars` to match. Deploying is a one-time setup on a Cloudflare account, from your clone, with your key exported in your shell:

1. Log in to that account:

   ```sh
   bunx wrangler login
   ```

1. Make the D1 database. This writes its `database_id` into the `DB` binding in `wrangler.jsonc`:

   ```sh
   bunx wrangler d1 create asked-before --binding DB
   ```

1. Apply the schema's migrations to it:

   ```sh
   bunx wrangler d1 migrations apply DB --remote
   ```

1. Set the key as the Worker's secret, from your shell, without writing it down. The Worker doesn't exist yet, so Wrangler makes it to hold the secret:

   ```sh
   printenv ANTHROPIC_API_KEY | bunx wrangler secret put ANTHROPIC_API_KEY
   ```

1. Set `PUBLIC_URL` in `wrangler.jsonc`'s `vars` to the app's address: `https://asked-before.<your-subdomain>.workers.dev`, with your account's workers.dev subdomain from the Cloudflare dashboard, or a custom domain.

1. Build the pages and deploy:

   ```sh
   bun run build:pages
   bunx wrangler deploy
   ```

Then commit `wrangler.jsonc`, which now holds the database's id and the address, so the next deploy uses them. The Worker's logs carry only each request's method, path, status, and duration, never your words, and they stay off Cloudflare's observability.

To deploy a change, apply any new migrations first, then build and deploy again:

```sh
bunx wrangler d1 migrations apply DB --remote
bun run build:pages
bunx wrangler deploy
```

Wrangler applies, in order, only the migrations the database hasn't had, recording each in its `d1_migrations` table, and stops at one that fails; locally, `check:migrations` proves that a failing one applies nothing. D1's Time Travel keeps 7 days of the database's history on Free and 30 on Paid, so it can be restored to a minute before a bad migration, and it can't be turned off: what a learner deletes stays in Cloudflare's backups for up to 30 days, which the settings page says.

## The SDK

`@asked-before/sdk`, in `packages/sdk`, is a typed client for the HTTP API, version 1, with one method per endpoint, and the export readers the upload page uses, which read an export on your computer in Bun, Node, or a browser. The page reaches the server only through it. It isn't on npm; `bun run build:sdk` builds it to JavaScript with type declarations, for your own code to add from your copy. Its [README](packages/sdk/README.md) has the quickstart, which reads an export, uploads it, and lists the cards. The docs page, at `/docs` on any Asked Before server, lists every endpoint with the credential it needs.

## Agents

Coding agents reach your cards through the MCP server in `packages/mcp`, with an API key from Settings: it records your how-to questions as captures, in your own words only, tells you when one is on a card you've asked before, and runs cold reps in the chat. In Claude Code, the Asked Before plugin in `plugins/asked-before` brings the server and a skill that says when to use it, in one install from this repo's marketplace:

```sh
claude plugin marketplace add m1kuorg/asked-before
claude plugin install asked-before@asked-before \
  --config server_url=http://localhost:8787 \
  --config api_key=YOUR_API_KEY
```

The plugin installs once the repo is public. For Claude Desktop, Cursor, or Claude Code without the plugin, Settings shows each agent's setup with your server's address filled in, and the [MCP server's README](packages/mcp/README.md) explains it.

## Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project, and worked with the Devpost Learn Skill Pack manually.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

## License

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, and the SIL Open Font License of the self-hosted Hanken Grotesk font. The plugin's built MCP server, `plugins/asked-before/dist/server.js`, carries the MCP TypeScript SDK (Apache 2.0) and zod (MIT) inside it.
