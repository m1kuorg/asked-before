# Asked Before

It turns the questions you keep asking a chatbot into library cards, stamped once per borrow, and won't stamp a card returned until you pass a cold rep: a fresh problem of the same kind, solved without AI. It runs on a made-up demo chat export, labeled as demo data on every screen.

## Run it

You need [Bun](https://bun.com) 1.x and an Anthropic API key.

```sh
git clone https://github.com/m1kuorg/asked-before.git
cd asked-before
bun install
cp .env.example .env        # then set ANTHROPIC_API_KEY=...
bun run start
```

Then open <http://localhost:3000>. Set `PORT` to use another port, as in `PORT=3101 bun run start`. Only the local server reads the key, and `.env` is gitignored.

The app is mid-build on this branch (m1kuorg/basics#40): sign up from the start page, make, rename, and delete projects, upload a chat export into one, which is sorted into cards, see the project's card stack, and take cold reps on its cards. The rest comes back with its tickets.

## Check it

The browser checks drive Playwright's Chromium, so a fresh clone needs it once:

```sh
bunx playwright install chromium
```

Then walk the app's shell:

```sh
bun run check:shell
```

It starts its own copy of the app, with a fresh database, and walks the shell in Chromium at 1920×1080 with nothing stubbed: sign up, land on the dashboard, create, rename, and delete a project, log out, and visit an app page while logged out to be sent to log in and back. It saves a screenshot of each step and fails with a message naming the step. `bun run check:shell <dir>` saves the screenshots in `<dir>` instead of your temp folder.

The other checks:

```sh
bun run check:key          # the demo export's answer key against the export
bun run check:accounts     # accounts and projects through the SDK
bun run check:styles       # the stylesheets at 1080p, surface by surface (scripts/styles/)
bun run check:reps         # cold reps on the demo skill, with the real model: lessons, problems, and verdicts
bun run check:rep-rules    # the cold reps' rules through the SDK, with the model stubbed
bun run check:card-page    # a card's page and its cold rep in a browser: card A with the real model, then waits and failures stubbed
bun run check:sort         # sorts the demo export three ways and compares the cards with the answer key
bun run check:sort-rules   # the sort's rules and the cards endpoints, with the model stubbed
bun run check:sort-page    # the upload page's sort progress, failure, retry, and daily cap, with the model stubbed
bun run check:captures     # captures' rules through the SDK, with the model stubbed
bun run check:capture-sort # where captures land with the real model: rephrasings of the demo skills, and questions none of them ask
bun run check:mcp          # the MCP server over stdio with the official client, a real key, and the real model
```

- `check:accounts`, `check:shell`, and `check:styles` start their own copy of the app on a free port, and need no key. `check:styles` needs Chromium.
- `check:reps` and `check:card-page` start their own copy of the app too, and need the key: `check:reps` makes 10 model calls in a minute or two, and `check:card-page` 4. `check:rep-rules` stubs the model in the script, so it needs no key.
- `check:sort` starts its own copies of the app too, and needs the key: each run makes 6 model calls in about 10 seconds. Add a number, as in `bun run check:sort 10`, for that many runs (1 if you don't). `check:sort-rules` and `check:sort-page` stub the model in the script, so they need no key.
- `check:mcp` and `check:capture-sort` start their own copy of the app too, and need the key: `check:mcp` makes 4 model calls in under a minute, and each run of `check:capture-sort` 20. Add a number, as in `bun run check:capture-sort 3`, for that many runs. `check:captures` stubs the model in the script, so it needs no key.

## Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project, and worked with the Devpost Learn Skill Pack manually.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

## License

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, and the SIL Open Font License of the self-hosted Hanken Grotesk font.
