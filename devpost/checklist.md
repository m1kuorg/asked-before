---
doc: checklist
status: approved
---

<!-- Driven by the entrant (@kymil4) manually with the Skill Pack. The app was built by the merged PRs for
     m1kuorg/basics#7, #26, #27, #28, #29, #33, #30, and #22. Each slice maps to those PRs, so the loop
     verifies and ticks it rather than rebuilding it. -->

# Build Checklist

Build mode: fast

## Slices

- [x] **1. You can open the app and load the demo export in one action**
  Becomes usable: `bun run start` serves the Load screen with the demo-data label, the privacy line, and one load action. The parser keeps only your own messages, and an unreadable export shows the error and a retry.
  Why now: The scaffold, server, key handling, and parser are what every later slice runs on, and the privacy line must be on screen before anything goes to the model.
  PRD ref: `prd.md > The Core Journey` (steps 1-2), `prd.md > Features and Behavior` (Loading the export)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Components` (Server, Model client, Page entry, Parser, Load screen, Demo data), `spec.md > File Structure`
  Build: Already built by PRs #1 (m1kuorg/basics#7, skeleton) and #2 (#26, load screen). Verify only.
  Verify (mechanical): `bun run check:key` passes; `PORT=3132 bun run start` starts clean, `curl` serves the page, and a browser shows the demo-data label, the privacy line, and the load action.
  Learner check: Start the app, open http://localhost:3131, and confirm the demo-data label, the line saying only your own messages go to the model, and the load button.
  Commit: `docs: tick slice 1, load the demo export` (code in f28c961)

- [x] **2. The demo export becomes a stack of cards, counted and dated by code**
  Becomes usable: Loading groups your messages through the group route; the card builder counts and dates them from timestamps; the stack shows cards A to E with card A "Undo a git commit", 9 borrows, March 2025 to September 2026.
  Why now: The kernel needs a real repeated question to test, so grouping and counting come before the cold rep.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Features and Behavior` (The card stack)
  Spec ref: `spec.md > Components` (Group route, Card builder, Stack screen), `spec.md > Data Model`
  Build: Already built by PR #4 (#28). Verify only.
  Verify (mechanical): `bun run check:cards` passes; with the app running on 3132, `PORT=3132 bun run check:grouping` matches the answer key.
  Learner check: Press the load button and confirm card A reads "Undo a git commit", borrowed 9 times, March 2025 to September 2026, with nine phrasings and dates around the rail.
  Commit: `docs: tick slice 2, the card stack` (code in 5b201fd)

- [x] **3. The model writes a cold rep and checks your answer**
  Becomes usable: The rep route returns a lesson (first rep only) and a fresh problem that doesn't give away its answer; the check route returns pass or fail with a reason about the answer it checked.
  Why now: This is the unique kernel, and the model's behavior is the biggest risk in the build.
  PRD ref: `prd.md > Features and Behavior` (The lesson and the cold rep), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Rep route, Check route, Model client), `spec.md > Important Failure Modes`
  Build: Already built by PR #6 (#27), with fixes in PRs #11 (#37) and #12 (#39). Verify only.
  Verify (mechanical): `bun run check:rep-routes` passes on the demo skill.
  Learner check: Covered in slice 4's check, where the rep and verdict show on screen.
  Commit: `docs: tick slice 3, cold reps and checks` (code in 5e6b975)

- [x] **4. You can take a cold rep, fail it, pass a new one, and see the card returned**
  Becomes usable: Opening a card shows the lesson, the problem, and one answer box. A fail shows the reason, the lesson again, and a different problem; a pass stamps the card returned with today's date and the stack strikes its key and closes its rail.
  Why now: It completes the core journey on top of slices 2 and 3.
  PRD ref: `prd.md > The Core Journey` (steps 5-8)
  Spec ref: `spec.md > Components` (Rep screen, Page entry)
  Build: Already built by PR #3 (#29). Verify only.
  Verify (mechanical): `bun run check:rep` passes (fails, retries, and pass in a browser, with stubbed routes).
  Learner check: Open key A, submit a wrong answer and read the reason, then answer the new problem correctly and confirm the stack shows key A struck through.
  Commit: `docs: tick slice 4, the rep screen` (code in 8d15bef)

- [x] **5. Every screen is set in the Centre Rail**
  Becomes usable: The page wears the Centre Rail: white block on proof gray, hairlines, one vermilion rail, the reversed plate, Hanken Grotesk at 1080p sizes, and the waiting, failed, and returned states without new ink.
  Why now: The look lands once the screens' markup is settled, so styling doesn't chase moving class names.
  PRD ref: `prd.md > Look and Feel`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Components` (Stylesheet)
  Build: Already built by PRs #5 (#33), #7 (#22, #35), #9 (#36), and #10 (#38). Verify only.
  Verify (mechanical): `bun run check:styles` passes at 1080p on sample markup and the real screens.
  Learner check: Look at the stack and rep screens at 1920x1080 and say whether they read like a page of a reference edition, not a dashboard.
  Commit: `docs: tick slice 5, the centre rail` (code in ad7d6bf)

- [ ] **6. The whole journey runs end to end with nothing stubbed**
  Becomes usable: `bun run journey` walks load, the stack, open key A, a fail, a pass, and the returned card in Chromium at 1920x1080, inside the time limits.
  Why now: It proves the pieces fit together and is the PRD's "Done when".
  PRD ref: `prd.md > The Core Journey`, `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > File Structure`
  Build: Already built by PR #8 (#30). Verify only.
  Verify (mechanical): `bun run journey` passes, with the fail and the returned stamp inside the first minute and the whole run under three.
  Learner check: Covered by the final review's full walk.
  Commit: `docs: tick slice 6, the whole journey` (code in f391c77)

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2: load the demo export and look at the stack. Walked on 3131 at 1920x1080 with nothing stubbed: load screen, waiting state, stack A to E with counts and months matching the answer key, the group request held only ids and texts, no "ChatGPT", demo answer files and .env 404. No changes requested.
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: 
Route and stops: 
Edit outcome: 
Reflection: 
Activity mode: 

## Revisions
