---
doc: prd
status: approved
---

<!-- Worked by the entrant (@kymil4) manually with the Skill Pack. -->

# Asked Before — Product Requirements

Asked Before turns the questions a student or early-career worker, especially a junior developer, keeps asking a chatbot into library cards, stamped once per borrow. A card is stamped returned only after a cold rep: a fresh problem of the same kind, solved without AI.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. Open the app. The **Load screen** shows the demo-data label, the line saying only your own messages go to the model, and one load action.
2. Load the demo export in one action, without picking a file. The app reads it and keeps only your own messages.
3. The **Stack screen** groups those messages into cards. While it waits, it shows a waiting state in the library's words. The cards appear keyed A to E in the margin, most borrowed first. The centre block shows card A: "Undo a git commit", 9 borrows from March 2025 to September 2026, nine phrasings beside nine dates around the rail, and the count 9 on the reversed plate.
4. Open a card. "Open key A" is the journey, but any of A to E can be opened.
5. The **Rep screen** shows the lesson, written once with the card's first rep, and a fresh problem of the same skill, with one plain free-text box.
6. Answer without AI, then submit. The app checks the answer and shows a verdict with a reason about that answer.
7. **Fail:** the reason, the lesson again, and a different problem. Failing again keeps the card borrowed and offers another.
8. **Pass:** the card is stamped returned with today's date, and the app goes back to the stack. There, the card's margin key is struck through and its rail is closed with an end rule.

Success is a card stamped returned after a passed cold rep.

## Screens and Layout
Three screens, one shown at a time (#25 Screens and ownership). The standard top navigation carries the demo-data label on every screen while the demo export is loaded.

| Screen | Shows | Leads to |
| ------ | ----- | -------- |
| Load | The privacy line, the load action, and the parser's error plus a retry if the export can't be read | The stack, via the load action |
| Stack | Left margin: cards keyed A to E by count, then the privacy line. Centre block: the skill name at display size; phrasings and dates in two columns around one vermilion rail with a key per borrow, cut where the year turns; the count on a reversed plate over the block's right edge; "Open key A" closing the block | The rep screen, via an open action with the chosen card |
| Rep | One card's lesson (first rep, and after a fail), the problem, the answer box, and the verdict with its reason | Back to the stack once the card is returned, with today's date |

The stack is the card stack surface brief's first viewport. The brief leaves the cold rep and returned states beyond that first viewport unresolved (see Open Questions).

## Look and Feel
Source: `scope.md > Inspiration & Identity`; details in DESIGN.md and the card stack surface brief, which `4-spec` and the build use as the detailed reference.

- **World: the Centre Rail.** Each screen is set like a page of a wide-margin reference edition. One small, dense white block (#FFFFFF) sits on proof-gray ground (#E8EBED), with iron-black ink (#1A1A1A) and 1px hairlines in Rule Gray (#C3C8CC) between rows.
- **One rubric.** Rubric vermilion (#B42D16) appears only on the rail's keys and the margin's key letters.
- **Exactly three signature elements:** the rail, one reversed black plate per screen for the number that matters, and the hairlines. Square corners, no shadows, no radius.
- **Type.** Hanken Grotesk throughout, tabular figures for dates and counts, no monospace, no display face. Body is at least 20px and labels at least 14px in the video's 1080p frame.
- **Motion.** Only the key dropping into its detent along one damped axis, with no overshoot; under reduced motion the keys are simply in place. Nothing fades, slides, or staggers in.
- **States add no new ink.** A returned card's margin key is struck through in iron black.
- **Controls** are the web's standard controls in the world's type, not a costume of a printed page.
- **Voice.** A library's vernacular: borrowed, stamped, returned. The screen says "chat export", never "ChatGPT", in the UI or the video.
- **Avoid:** a warm cream ground with a serif, rounded cards, soft shadows, toasts, progress bars, Inter/Geist/Space Grotesk, icon sets, emoji, sparkles, bento or dot grids, colored edge stripes, hover animations, purple gradients, all-caps eyebrows, "→" on buttons, and streaks, badges, scores, or charts.

## Features and Behavior

### Loading the export
- [ ] The demo export loads in one action with no file picker, and the stack follows.
- [ ] The demo-data label is visible on every screen while the demo export is loaded.
- [ ] The screen says that only your own messages go to the model before anything is sent.
- [ ] No request to the model carries an assistant, system, or tool message, a title, or a timestamp. Only your message texts and opaque ids are sent.
- [ ] An export that can't be read fails loudly, not with a quiet misreading, and the screen shows the error and a retry.

### The card stack
Source: `scope.md > The POC Boundary`.
- [ ] One card per skill asked more than once. Every card has at least two borrows, and the demo export's one-off questions make none.
- [ ] A borrow is one of your own messages. Counts and dates come from code, from message timestamps, and match the demo export's answer key.
- [ ] Five cards, keyed A to E in the margin by borrow count, highest first. On a tie, the card with the later last borrow goes first.
- [ ] Card A reads "Undo a git commit", borrowed 9 times, March 2025 to September 2026, readable within the video's first seconds.
- [ ] Every stamp matches the count, each dated from its message. Every phrasing is one of your messages, word for word, so a wrong merge is visible.
- [ ] Any card A to E can be opened.

### The lesson and the cold rep
- [ ] The lesson is written once, with the card's first rep, and shown again after a failed rep. Later reps show a problem only.
- [ ] Each problem is a fresh scenario of the card's skill. No rep repeats one of the card's phrasings or an earlier rep on the same card.
- [ ] The problem doesn't contain its answer. Nothing on screen gives the answer away before you submit.
- [ ] The answer is one plain free-text box, the same for every skill.
- [ ] The verdict is pass or fail, with a reason about the answer it checked. A known wrong answer fails with a reason naming what's wrong, and a known right answer passes.
- [ ] A fail shows the reason, the lesson again, and a different problem. Failing that one too keeps the card borrowed and offers another.
- [ ] A pass stamps the card returned with today's date and returns to the stack. There, the card's margin key is struck through and its rail closes with an end rule.

## States and Boundaries
- **Waiting.** Every model wait (grouping, writing a rep, checking an answer) shows a waiting state in the library's words.
- **Model failure or refusal.** Shows the error and a retry. Never shows a card, lesson, problem, or verdict it didn't receive. A refused or cut-off reply is a failure, not a result.
- **Model output that doesn't hold up** (an unknown id, an id in two groups, a group under two borrows, a skill name that isn't short text) is an error, not a card.
- **Nothing asked more than once.** The app says so plainly, with no made-up cards.
- **Unreadable export.** The error and a retry on the Load screen.
- **Nothing persists.** Closing or reloading starts over. No accounts, no saved progress.
- **Privacy boundary.** Only your own message texts and opaque ids go to the model. The server stores nothing and doesn't log message text.

## Product Decisions
From #25's Locked decisions (October 16, 2026) and PRD.md:

- **A borrow is one of your own messages.** The demo export puts each phrasing in its own conversation, so counting conversations gives the same number.
- **The demo centres on "Undo a git commit", borrowed 9 times, March 2025 to September 2026**, so the count lands in the first seconds.
- **Four more cards, asked 2 to 4 times, keyed A to E by count; on a tie, the later last borrow goes first.**
- **One plain free-text answer box for every skill.** One form fits every skill.
- **The lesson is written once, with the first rep, and shown again after a fail**, so later reps test rather than tutor.
- **The screen says "chat export", never "ChatGPT"**, because the rules bar third-party trademarks in the video.
- **Demo data only, labeled.** There's no real export to verify against, and the demo must never pose as anyone's real history.
- **Code counts, the model reads.** Dates and counts can't be invented.

## What We're Building
The three screens and the full journey above, running for real on the labeled demo export:
- One-action load, with the privacy line.
- Grouping into cards A to E, counted and dated by code.
- The stack in the Centre Rail world.
- Opening any card.
- The lesson, the cold rep, the check, the fail path, and the returned stamp.
- Waiting and failure states throughout.

The whole journey fits in under three minutes, with a failed rep and then a passed rep on a different problem inside the first minute.

**Demo export** (PRD.md): made up and labeled, in a chat export's real format, including the chatbot's answers so dropping them is visible, plus one-off questions that make no cards. An answer key beside it lists which messages belong together and is never sent to the model.

## Deferred From the POC
- **Dropping in your own export.** It's implied by the product, but there's no real export to verify it end to end (locked cut).
- **Splitting a wrong merge.** It's implied by showing phrasings, but locked out. The visible phrasings still expose a wrong merge.

## Possible Later Enhancements
None written down.

## Non-Goals
- **A Claude export.** Its format isn't checked against a real one or a primary source (TRD.md).
- **Accounts, sync, a database, or saving progress between visits.** Not needed to prove the kernel in one sitting.
- **Hosting.** Running locally and recording it is enough.
- **Charts, streaks, scores, dashboards, or spaced repetition.** They're a recap, not a test, and off-voice.
- **Catching a re-ask in the moment, such as with a browser extension.** The history only arrives as an export.
- **Any claim about how often real people re-ask.** Nothing measures it.
- **Showing private messages in the video.** Demo data only.

## Open Questions
None is a product-defining decision. All are written as not established, and none blocks `4-spec`. Resolve them in the build against the surface brief's unresolved list, and don't invent product intent.

1. **Load screen: list or count?** Not written down whether it lists the loaded messages or only says how many.
2. **Rep screen: repeat the card?** Not written down whether it repeats the card's stamps and phrasings. The surface brief lists the cold rep and returned states as unresolved.
3. **A way back to the stack mid-rep.** Not written down. #25 gives the rep screen only the one hand-back (returned), so it isn't needed for the journey.
4. **The centre block once A is returned.** Not written down.
5. **How a failed rep shows within the two inks.** DESIGN.md marks it as to be resolved during implementation.
