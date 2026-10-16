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

The page opens on the demo chat export. It says how many of your own messages the export holds, and that only those go to the model. Press **Load the demo export** to sort them into cards, then open a card and take its cold rep.

## Check it

The browser checks drive Playwright's Chromium, so a fresh clone needs it once:

```sh
bunx playwright install chromium
```

Then run the whole journey:

```sh
bun run journey
```

It starts its own copy of the app, on `PORT` or a free port, and walks the journey in Chromium at 1920×1080 with nothing stubbed. It loads the demo export and checks card A's count and months against `demo/answer-key.json`. It opens key A, fails a cold rep with the known wrong answer from `demo/known-answers.json`, passes the next one with the known right answer, and goes back to the stack. It saves a screenshot of each step and prints how long after opening the page the fail and the returned stamp came. It fails if either comes after the first minute or the whole journey takes three, and on any mismatch it fails with a message naming the step. It calls the model, so it needs the key, and a run takes about 20 seconds.

- `bun run journey <dir>` saves the screenshots in `<dir>` instead of your temp folder.
- `--video` also records the run at 1920×1080, as `journey.webm` beside the screenshots.
- `--pause <ms>` waits that long after each step and before each submit, for a watchable pace. The pauses count toward the time limits, as they would in a recording.

The other checks:

```sh
bun run check:key          # the demo export's answer key against the export
bun run check:cards        # the card builder against the answer key
bun run check:styles       # the stylesheet at 1080p, on sample markup and the real screens
bun run check:rep          # the rep screen's fails, retries, and pass, in a browser
bun run check:rep-routes   # lessons, problems, and verdicts on the demo skill
bun run check:grouping     # groups the demo messages several times and compares each run with the answer key
```

- `check:styles` and `check:rep` stub the model routes inside the script, so they need Chromium but not the key. Each starts its own copy of the app, on `PORT` (3133 and 3129 if it isn't set).
- `check:rep-routes` starts its own copy of the app too. It makes about 20 model calls in a minute or two.
- `check:grouping` sends to an app that's already running, on the same `PORT`. Run `bun run start` in one shell, then `bun run check:grouping` in another; add a number, as in `bun run check:grouping 10`, for that many runs (3 if you don't).

## Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project, and worked with the Devpost Learn Skill Pack manually.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

## License

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, and the SIL Open Font License of the self-hosted Hanken Grotesk font.
