---
doc: scope
status: approved
---

<!-- Worked by the entrant (@kymil4) manually with the Skill Pack. -->

# Asked Before

It turns the questions you keep asking a chatbot into library cards, stamped once for every time you borrowed the answer. A card isn't stamped returned until you solve a fresh problem of the same kind without AI.

## The Unique Kernel
**The cold rep on a question your own history shows you keep asking.** A recap of your AI use tells you what you talked about; only a test without AI shows whether you learned it. AI recaps cluster topics, and study modes tutor within one conversation. The entrant's research found nothing that finds the questions you re-ask and then tests them without AI. Without the cold rep, it's just a ledger, and a ledger is a recap.

## Who It's For
Students and early-career workers, junior developers especially, who ask a chatbot many times a day and suspect they aren't learning from it. Their history sits in a data export they never look at. Because getting an export takes a request and a wait, this is a monthly check-up at best, not something they open at the moment they re-ask.

## The Core Loop
1. Load a chat export. Only your own messages go to the model, and the screen says so first.
2. The cards stack up, most borrowed first. Each card is one skill asked more than once, with one stamp per borrow, dated by code from the message's timestamp.
3. Open a card. You see its stamps and your phrasings, word for word, and a lesson taught once.
4. Do the cold rep: a fresh problem of the same skill, answered in a plain box without AI.
5. Fail, and you get the reason, the lesson again, and a different problem. Pass, and the card is stamped returned with today's date.

Pull is weak, since an export takes a request and a wait, so it's a monthly check-up at best (PRODUCT.md).

## Inspiration & Identity
- **The Centre Rail** (DESIGN.md, chosen October 16, 2026). This replaced the idea file's manila due-date card, so don't build that card. Each screen is set like a page of a wide-margin reference edition. A small, dense white block sits on proof-gray ground, ruled in 1px hairlines. One vermilion rail runs down the block with one key per borrow, and your own words sit on one side of it. Square corners, no shadows, one reversed black plate per screen for the number that matters, and standard web controls.
- **Voice:** a library's vernacular. Cards are borrowed, stamped, and returned. No charts, streaks, scores, or dashboard.
- **Wording:** the screen says "chat export", never "ChatGPT", in the UI or the video.
- None of the generic AI tells (purple gradients, SaaS card kits, fade-and-slide-up), per the planning repo's CONTEXT.md.

## Why This Matters to the Learner
Personal stake: not established. The entrant delegated this step and hasn't written one down. The idea file's personal questions are still unanswered: what they found in their own export, and which question they'd be embarrassed to keep asking.

What is written is the product's purpose (PRODUCT.md): "Turn a question you keep asking into one you can answer without AI."

## What "Working" Looks Like
The whole journey runs for real on a labeled, made-up demo export in under three minutes:

- The top card reads **"Undo a git commit: borrowed 9 times, March 2025 to September 2026"**, readable in the first seconds.
- Opening it shows nine stamps and nine phrasings.
- A cold rep is failed, with a reason about that answer. A second rep on a different problem passes, and the card is stamped returned.

**The "oh, that's cool" beat** is the failed rep, then the passed rep, then the returned stamp, all within the video's first minute.

Success for a user (PRODUCT.md) is a card stamped returned after a passed cold rep. That's evidence they can do it alone, not that they were reminded.

## The POC Boundary
- One journey, on the demo export only, loaded in one action, with a "demo data" label on screen whenever it shows.
- **A borrow is one of your own messages.** The demo export puts each phrasing in its own conversation, so counting conversations gives the same number.
- The demo export is in a chat export's real format and includes the chatbot's answers, which are dropped. It has an answer key that's never sent to the model.
- One big cluster ("undo a git commit", 9 borrows). Four more skills asked 2 to 4 times, keyed A to E in the margin by count, with a tie going to the later last borrow first. One-off questions make no cards.
- Grouping, counts, and the cold rep all run for real. Code counts and dates; the model only reads your own message texts.
- The lesson is written once, with a card's first rep, and shown again after a failed rep. The rep answer is one plain free-text box, the same for every skill.
- A local server holds the API key and serves a plain page. Nothing is saved between visits.
- Every model wait shows a waiting state in the library's words. Every failure shows the error and a retry, and never a card, lesson, or verdict that didn't arrive.

## Later
Nothing written down as later; everything outside the boundary is cut.

## Explicitly Cut
- **Dropping in your own export.** There's no real export to verify it against end to end, and the demo runs on made-up data (locked in #25).
- **A Claude export.** TRD.md says its format isn't checked against a real one or a primary source, so it stays out of the proof of concept.
- **Splitting a wrong merge.** It's locked out of the build. Showing every phrasing on a card still makes a wrong merge visible.
- **Accounts, sync, a database, saving progress.** Not needed to prove the kernel in one sitting.
- **Hosting.** Running locally and recording it is enough.
- **Charts, streaks, scores, dashboards, and spaced repetition.** They're a recap, not a test, and off-voice.
- **Catching a re-ask in the moment, such as with a browser extension.** Out of reach for a proof of concept, since the history arrives as an export.
- **Any claim about how often real people re-ask.** Nothing measures it; the demo shows the mechanism, not the premise.
