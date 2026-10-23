# Asked Before

It finds the questions you keep asking a chatbot, puts each one on a card that counts every time you asked it, and won't mark a card Proven until you pass a cold rep: a fresh problem of the same kind, solved without AI.

You sign up, make a shelf for each part of your life, and upload a ChatGPT or Claude export onto it. Your browser reads the export and sends only your own messages, with when you sent them; the chatbot's answers and your titles never leave your computer, and the model sees your words only, never your dates. Asked Before sorts them into cards, most asked first, and Home shows the cards across your shelves that still need a cold rep. A TypeScript SDK, an MCP server, and a Claude Code plugin let your scripts and coding agents reach the same cards, so a question you ask an agent lands on its card as you ask it.

The app runs on Cloudflare Workers, with its data in D1 ([ADR 0005](docs/adr/0005-cloudflare-workers-d1-and-a-durable-object-per-shelf.md)), and its pages are React, Tailwind CSS, and shadcn/ui, bundled by Bun. Until it merged into `main` on October 18, 2026, `main` held the proof of concept submitted to the hackathon, a single page on a made-up demo export; that's `main`'s history up to commit `6bfe2dc`.

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

`bun run dev` builds the pages into `dist/`, applies the schema's migrations to a local database in `.wrangler/`, and starts the app with `wrangler dev`. Then open the address it prints, <http://localhost:8787> unless that port is taken, sign up, and make a shelf. A new learner can try the demo shelf, made from a made-up demo export and labeled as demo data, before finding their own export. Or sign in as a guest, with no account: every guest shares one workspace, the Guest account's, whose demo shelf comes already sorted, from `demo/sorted.json`, and which is wiped at midnight UTC each day. The Worker isn't the only reader of the key: Wrangler gives it to the Worker from `.env`, and Bun loads the same file into the check scripts, which read the key too, to check for it before calling the real model and to pass it on to the `wrangler dev` they start. `.env` is gitignored; a key exported in your shell works too, and wins over `.env`.

Your local data stays in `.wrangler/` from one run to the next; delete that folder to start again with an empty database. Wrangler reloads the Worker when its code changes, but not the pages: run `bun run build:pages` to see a change to them.

The key is the only setting you need. The others are vars in `wrangler.jsonc`, each with a default:

| Setting | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | The model key, from `.env` or your shell, and a Worker secret once deployed. The app starts without it, but every sort and cold rep fails. |
| `PUBLIC_URL` | empty | The address people reach the deployed app at. Empty, a request's own origin counts as the app's; an `https` address makes the session cookie `Secure`. `bun run dev` always runs with it empty. |
| `SITE_DAILY_MODEL_REQUESTS` | `20` | Model requests the whole app may make per UTC day, counted once for everyone, guests included. |
| `SITE_DAILY_PHRASINGS` | `8000` | Phrasings the whole app may take per UTC day, uploads and captures together, counted once for everyone, guests included. |
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

It needs the key, and makes 7 model calls, with nothing stubbed. In Chromium at 1920×1080, it signs up from the landing page, makes a shelf, uploads the demo export through the upload page's file input, and checks card A against the demo export's answer key, word for word. It fails a cold rep on card A with a known wrong answer and passes the next with a known right one, sees card A under Latest proven on Home, and makes an API key in Settings. Then it lists the cards through the SDK with that key, and records a rephrasing of card A's question through the MCP server, so card A's count goes up by one and it's Asked since proven. It saves a screenshot of each step in your temp folder, or in `<dir>` with `bun run journey <dir>`. With `--video`, it also records the run to `journey.webm` there; `--pause <ms>` holds each step that long, for a watchable pace; and `--demo-shelf` takes Home's "Try the demo shelf" instead of making a shelf and choosing the export, so the Demo data label shows. `JOURNEY_URL=<address>` walks a deployed app instead of starting one, as a new learner whose email it prints, and leaves that account there.

The other checks:

| Command | What it checks | Needs |
| --- | --- | --- |
| `bun run check:smoke` | The app on Workers: every page, an asset, and the demo export with the security headers, one content security policy, the answer key never served, an unknown endpoint's 404 JSON, and signing up | |
| `bun run check:key` | The demo export's answer key against the export | |
| `bun run check:accounts` | Accounts and shelves through the SDK: sessions, `next`, 404s across accounts, the Origin rule, the logs, the throttle, by IPv4 address or IPv6 /64 | |
| `bun run check:guest` | Signing in as a guest: two browsers sharing the sorted demo shelf and a cold rep, settings hidden and refused, the upload page's warning, and the daily reset through the local cron route, with no model request and every guest still signed in | Chromium |
| `bun run check:passwords` | The password never reaching the server: every request the page sends to sign up, log in, change the password or email, and delete the account, the API refusing anything but a key, and the database keeping only its salted hash | Chromium |
| `bun run check:caps` | The app's two daily caps, set small: two accounts and the guest spending its model requests and phrasings between them, then a 429 for whoever sends the next, through the SDK and in the upload page, and a refused request counting toward nothing | Chromium |
| `bun run check:shell` | The app's shell: sign up, Home, the sidebar, your shelves, log out, and the redirect to log in and back | Chromium |
| `bun run check:landing` | The landing page's demo cards against the demo export, and signing up and logging in from it | Chromium |
| `bun run check:readers` | The SDK's export readers on every fixture, and on broken exports | |
| `bun run check:uploads` | The uploads endpoints, and uploading the same export twice | |
| `bun run check:upload-page` | The upload page: the preview, what it sends, a zip read under the content security policy, failures, and the demo action | Chromium |
| `bun run check:sort` | Sorting the demo export three ways, against the answer key; `bun run check:sort 10` for 10 runs | Key |
| `bun run check:sort-recall` | Sorting a made-up history of 469 labeled phrasings, scored against its labels by recall and precision; `bun run check:sort-recall 3` for 3 runs | Key |
| `bun run check:sort-rules` | The sort's rules and the cards endpoints, with the model stubbed, a sort that carries on after `wrangler dev` is killed mid-sort, and sorts that fail to start or stall, which a retry or the cron starts again | |
| `bun run check:sort-page` | The upload page's sort progress, its last pass over the messages not on a card, failure, retry, and daily cap, with the model stubbed | Chromium |
| `bun run check:shelf` | A shelf's cards and their statuses, its messages not on a card, and its uploads | Chromium |
| `bun run check:reps` | Five cold reps on card A: lessons, problems, and verdicts | Key |
| `bun run check:rep-rules` | The cold reps' rules through the SDK, with the model stubbed | |
| `bun run check:card-page` | A card's page and its cold rep: card A failed, then Proven, with the real model; then waits and failures stubbed | Key, Chromium |
| `bun run check:desk` | The Desk endpoint through the SDK, and Home in the page | Chromium |
| `bun run check:settings` | API keys and the account, through the SDK and in the settings page | Chromium |
| `bun run check:data` | Downloading and deleting your data, a big account's too, each download read in one D1 batch | Chromium |
| `bun run check:captures` | Captures' rules through the SDK, with the model stubbed | |
| `bun run check:capture-sort` | Where captures land with the real model; `bun run check:capture-sort 3` for 3 runs | Key |
| `bun run check:mcp` | The MCP server over stdio with the official client and a real key | Key |
| `bun run check:plugin` | The Claude Code plugin: validated, its server's build fresh, and the build run from a copy as Claude Code runs it | `claude` |
| `bun run check:docs` | The docs page against the server's route table, and the SDK's quickstart run on the demo export | Chromium |
| `bun run check:sdk` | The SDK's build, used from a package outside the repo, in Bun and in Node | |
| `bun run check:styles` | Every public page, logged out too, and every app screen, as a learner and as the guest, at 1440×900 and 390×844: no sideways scroll, one h1, the font loaded, no text under 12px, contrast of 4.5:1 (3:1 for large text), and no console errors | Chromium |
| `bun run check:migrations` | The schema's D1 migrations: each applied once on a fresh database; a new one, added in a copy of the app, that rebuilds a table and keeps the data beneath it; and a failing one applying nothing | |

A check that needs the key and stubs nothing calls the real model; the others stub it inside the script, never in the app, so they need no key. Every check starts its app with the daily caps lifted, unless it checks one. After a change to the MCP server or the SDK, `bun run build:plugin` rebuilds the plugin's server, which `check:plugin` fails on until you do. A new API route needs its row on the docs page, in `src/pages/docs/reference.ts`, or `check:docs` fails. [`docs/code-map.md`](docs/code-map.md) says where each piece lives.

## Deploy it

The app runs on [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/). Free gives a request, a cron run, and each of the sort's Durable Object alarms 10 ms of CPU time, so the server never hashes a password: the SDK, in the page or your script, derives a key from it with scrypt, and the server keeps only a salted SHA-256 of that key (ADR 0006). Free's real ceiling is D1's 100,000 rows written a day for the whole Cloudflare account, past which every query fails, logging in too; a phrasing stored and sorted writes 7 to 9. The two daily caps in [Run it](#run-it) keep the app under it, each for the whole app and counted once for everyone, guests included: 8,000 phrasings and 20 model requests a day. An upload's sort makes one model request for each batch of up to 300 phrasings and one more for its last pass over the unsorted, so the demo export takes 2 and an upload of 2,000 phrasings 8. The cron, every five minutes, resets the guest workspace on its first run after midnight UTC: it deletes the Guest account's shelves, counting the phrasings deleted toward the new day's, since deleting writes too, and restores its demo shelf from `demo/sorted.json` with no model request. [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/), $5 a month, lifts the CPU and D1 limits; raise the caps in `wrangler.jsonc`'s `vars` to match. Deploying is a one-time setup on a Cloudflare account, from your clone, with your key exported in your shell:

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

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, the SIL Open Font License of the self-hosted Schibsted Grotesk and JetBrains Mono fonts in `public/fonts/`, and the CC BY 4.0 license of the landing page's photograph, "Nurmeksen yhteislyseo vuonna 1958. Ylioppilaskirjoitukset." by Topi Toivanen, via Wikimedia Commons, credited on the page and in `public/images/credits.json`. The components in `src/components/ui/` start from shadcn/ui's (MIT). The plugin's built MCP server, `plugins/asked-before/dist/server.js`, carries the MCP TypeScript SDK (Apache 2.0) and zod (MIT) inside it.
