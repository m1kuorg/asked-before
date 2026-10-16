---
version: 1
slug: 'apps-src-index-tsx'
primary_target: 'src/screens/stack.ts'
related_targets: ['public/styles.css']
---

# Card stack

Scope: the card stack, the app's first screen. Visitor mode: Operate. The visitor sees which questions they keep borrowing and opens the top card to take its cold rep. Judges may only see it in a screen recording, so the top card's count must read within seconds at 1080p.

Constraints: the demo-data label stays on screen while the demo export is loaded; the screen says only your own messages go to the model; no charts, streaks, scores, or dashboard.

## Direction contract

THESIS: The stack is a reference-edition block: your phrasings and their dates twinned around one vermilion rail, a key on it for every borrow. It refuses the category default of rounded cards with count badges and a progress bar.

OWN-WORLD: Proof-gray ground, white block, iron-black ink, one-pixel ruled hairlines, square corners. Rubric vermilion only on rail keys and key letters. The count sits on one reversed black plate. Grotesk with small-caps apparatus; dates in tabular figures.

STORY: The visitor reads "Undo a git commit, borrowed 9 times", sees their own nine phrasings beside nine dates, believes they keep borrowing it, and opens the card to take the cold rep.

FIRST VIEWPORT: Standard top nav with the demo-data label. Left margin: cards keyed A to E by count, then the privacy line. Centre block: the skill name at display size; phrasings and dates in two columns around a rail of nine vermilion keys, cut where the year turns; the count 9 on a reversed plate hanging over the block's right edge; "Open key A" closes the block. Signature interaction: each borrow's key drops into its detent along one damped axis, no overshoot; a passed rep closes the rail with an end rule and strikes the margin key.

FORM: rw-centre-rail-reference-setting, the dealt lead of the bolder re-roll (round 2), a catalog challenger rather than a grounded candidate; bone stock and Miller Text translated to proof gray and a grotesk at the user's request. seed:d49f20dac50e8dce

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Chosen composition

The picked sketch is `.impeccable/mocks/decision/r2-lead.html`; the decision figure `.impeccable/mocks/decision/r2-lead.png` is the critique reference.

## Resolved decisions

The build settled the four decisions this brief left open, and [DESIGN.md](/docs/DESIGN.md) records them as shipped:

- Tracked capitals in Hanken Grotesk for apparatus, under Typography.
- The 1080p type scale, with body at 20px, under Typography.
- The rail outboard of the text on narrow screens, under Layout.
- The cold rep and returned states, under Layout and Components.
