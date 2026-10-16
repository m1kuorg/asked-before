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

```sh
bun run check:key        # the demo export's answer key against the export
bun run check:cards      # the card builder against the answer key
bun run check:grouping   # groups the demo messages several times and compares each run with the answer key
```

The journey script drives a real browser, so a fresh clone needs Playwright's Chromium once first:

```sh
bunx playwright install chromium
bun run journey          # the whole journey on the demo export, with no stubs
```

`check:grouping` and `journey` call the model, so they need the key too.

## Disclosures

**AI assistance.** The entrant works with Astra 6 via Codex, Gemini models via Antigravity, and DeepSeek, GLM, etc. models via OMP as coding assistants throughout the development of the project, and worked with the Devpost Learn Skill Pack manually.

**Pre-existing work.** None. The project was newly created during the hackathon submission period, with no pre-existing work.

## License

[MIT](LICENSE). Third-party files keep their own licenses: the Skill Pack's MIT license, the impeccable skill's Apache 2.0 license, and the SIL Open Font License of the self-hosted Hanken Grotesk font.
