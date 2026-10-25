# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Tailwind CSS, and shadcn/ui, chosen by the user on October 23, 2026 for the frontend redesign. The pages are served as the Cloudflare Worker's static assets, and the Worker answers `/api/*`. The page reaches the server only through `@asked-before/sdk` (ADR 0004). Use bun, never npm or pnpm.

## Users

Students and early-career workers, junior developers especially, who ask a chatbot many times a day and suspect they aren't learning from it. They keep re-asking the same how-to questions in different words. Their history sits in a chat data export (ChatGPT or Claude) they never look at. Since an export takes a request and a wait, the export path is a periodic check-up rather than a daily habit. Their coding agents (Claude Code, Claude Desktop, Cursor) can also record questions as they're asked, through the MCP server or the plugin.

Hackathon judges and first-time visitors come in through the landing page or the shared guest workspace.

## Product Purpose

Turn a question you keep asking into one you can answer without AI.

The app reads your own messages from a chat export, groups the ones that ask how to do the same thing into cards, most-asked first, and dates each time you asked from the message's own timestamp. Opening a card shows every phrasing word for word. A card counts as learned only once you pass a cold rep, a fresh problem of the same skill answered in a plain box without AI. If you fail, you get the reason, the lesson again, and a different problem. If you ask the same thing again later, the card goes back to needing a rep.

Success for a learner is a card marked learned after a passed cold rep. That's evidence they can do it alone, not that they were reminded.

## Positioning

AI recaps cluster what you talked about, and study modes tutor inside one conversation. Asked Before finds the questions your own history shows you keep re-asking, then tests them without AI. Without the cold rep it would only be a ledger, and a ledger is a recap.

## Operating Context

- Sign up, log in, or sign in as a guest. Every guest shares one workspace that already holds a sorted demo shelf. It resets at midnight UTC, and guests have no settings: a guest's Settings says why, and what an account's hold.
- Make a named group for each part of your life (today called shelves, such as Work or Bootcamp). Groups never share cards.
- Upload an export onto a group. The browser reads the zip or `conversations.json` and previews what will be sent. Only your own messages, with their times and ids, are sent, along with the export's file name and which chatbot it came from, and the model sees your words only, never your dates. A labeled made-up demo export can be loaded in one action. Sorting runs in the background with visible progress, a last pass over the unsorted, failure, and retry.
- Browse a group's cards and their statuses (still being asked, learned, asked again since), the unsorted messages, and the upload history.
- Open a card for its phrasings and dates, its lesson, and a cold rep with a verdict.
- An overview across all groups shows what still needs a rep, plus the latest asks and passes (today called Home).
- Search asks "Have you asked this before?": it finds every message of yours with all the words you type, word for word, and the cards they're on, counted by code with no model request; the search sits in the address, so it can be linked.
- Analysis shows how you ask and what you keep re-asking, counted by code from your messages' own times, your cards, and your cold reps, never by the model: every month's messages in your time zone with the re-asks set apart, how long until you asked again, cold reps passed and not yet, proven cards asked again, and the skills you re-ask most, across all groups or one.
- Settings (not for guests), one view per area: Account, to change the name, email, or password; API keys, shown once, with what a key can and can't do; and Your data, to see what Asked Before keeps, download your data, then delete your account. A guest sees why it has none, and what each area holds and needs.
- Connect your AI, guests included: pick your agent, give it a key made for it and shown once, add the setup snippet with the server address filled in, and see when the key is first used. A guest gets the snippets, and the reason keys need an account.
- The Playground sends one real API request, as this session or with a pasted key, and shows the whole answer beside the same request as code. It doesn't run the endpoints that would end or replace this session, or change or delete the account, and it asks before a delete or anything that spends model requests. It's the one screen that reaches the server without the SDK, since the raw HTTP exchange is what it shows.
- A roadmap places every card, across your shelves, on a fixed path of 13 developer areas, from the terminal to deploying, by the words in its skill's name: each area with its cards and their status, the next card on the path that needs a cold rep, and the cards off the path. Code places them; the model doesn't.
- Public docs list every API endpoint, plus the SDK quickstart.
- A public privacy page says what leaves your computer, what the model sees, what's kept and where, and how to download or delete it. Every sentence comes from the code or the docs.

## Capabilities and Constraints

- Privacy is the product's spine. Only your own messages leave your computer, each with when you sent it and its id in the export, along with the export's file name and which chatbot it came from. The chatbot's answers and your titles never do, and the model sees your words only, never your dates. The upload screen must say this before anything is sent.
- The password never reaches the server: the SDK derives a key from it in the page (ADR 0006).
- Content security policy: `default-src 'self'`, with no inline styles or scripts, no eval, and no blob workers. Self-hosted fonts only.
- Cloudflare Workers Free. The whole app gets 20 model requests and 8,000 messages a day, guests included, so the UI must handle the cap being reached (HTTP 429) honestly. An upload's sort makes one model request per 300 messages plus one, so the demo takes 2.
- Every model wait shows a waiting state, and every failure shows the error and a retry. The UI never shows a card, lesson, or verdict that didn't arrive.
- Demo data is labeled as demo data wherever it shows.
- Code counts and dates; the model only reads your message texts.
- Vocabulary is open: on October 23, 2026 the user freed the screen names and terms (Desk, Shelves, Cards, Borrows, Returned, Cold rep) for the redesign. The mechanism, privacy, and data model stay.
- No backwards-compatibility shims; nothing outside the hackathon has shipped.

## Evidence on Hand

- `demo/export.json`, a made-up chat export in a real export's format, with its answer key, which is never served. Its top skill is "Undo a git commit", asked 9 times between March 2025 and September 2026, followed by four skills asked 2 to 4 times. One-off questions make no cards.
- `demo/sorted.json`, the guest workspace's sorted demo shelf.
- The live app: https://asked-before.m1kuorg.workers.dev
- The measured sort quality is about 80% recall at about 89% precision on a labeled 469-message history, and 60 of 60 demo sorts match the answer key.
- There are no real users, testimonials, customers, or usage numbers. Never invent them. Nothing measures how often real people re-ask.

## Product Principles

1. Prove it without AI: the only success state is a passed cold rep.
2. Your words, never your data: show exactly what leaves the computer, before it leaves.
3. Honest machinery: waits, failures, caps, and demo data are always shown, never hidden.
4. No recap theatre: no streaks, scores, points, or spaced-repetition gamification. A recap isn't a test.
5. Your history is the content: the learner's own phrasings, word for word, are the material on screen.

## Accessibility & Inclusion

No product-specific requirement has been stated. The working floor is WCAG 2.2 AA: every flow works by keyboard, and motion respects `prefers-reduced-motion`.
