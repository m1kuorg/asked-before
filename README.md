# Asked Before

It turns the questions you keep asking a chatbot into library cards, stamped once per borrow, and won't stamp a card returned until you pass a cold rep: a fresh problem of the same kind, solved without AI. It runs on a made-up demo chat export.

## Run it

You need [Bun](https://bun.com) 1.x and an Anthropic API key.

```sh
bun install
cp .env.example .env        # then set ANTHROPIC_API_KEY=...
bun run start
```

Then open <http://localhost:3000>. Set `PORT` to use another port, as in `PORT=3101 bun run start`.

## Checks

- `bun run check:key` checks the demo export's answer key against the export.
- `bun run check:cards` checks the card builder against the answer key.

AI agents ran the Skill Pack interviews from the entrant's written decisions and are building this entry; see `devpost/`.
