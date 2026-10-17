---
version: 1
slug: "src-screens-dashboard-ts"
primary_target: "src/screens/dashboard.ts"
related_targets: ["public/styles/dashboard.css"]
---

# Dashboard

Scope: the dashboard at `/app`, ticket m1kuorg/basics#47, where signing up and logging in land. Visitor mode: Operate. The learner sees what's still borrowed across their projects, what they asked lately and which card it borrowed, what they returned lately, and where they stand in plain numbers, then takes a cold rep on the card they lean on most.

Constraints: the Centre Rail world in docs/DESIGN.md is fixed, with no direction workshop, no images, and no comps; the screen composes the shell's shared parts and the stack's rail markup; it reads one endpoint, `GET /api/v1/dashboard`, through the SDK; glossary words only, with no charts, streaks, scores, badges, or progress bars; a new learner's empty state offers the demo project (`startDemoProject()`) and a first upload. Product truth comes from devpost/scope.md, devpost/prd.md, and the spec m1kuorg/basics#40, standing in for PRODUCT.md.

## Direction contract

THESIS: The dashboard is the circulation desk's list of what's still out: the cards no cold rep has returned, most borrowed first, then the latest borrows keyed on the block's one rail, each phrasing facing the card it borrowed, then the latest return stamps. It refuses the category default of a row of KPI tiles over charts, a streak counter, and an activity feed.

OWN-WORLD: Proof-gray ground, one white block ruled in 1px iron hairlines, square corners, Hanken Grotesk only, tabular figures, phrasings in the italic. Vermilion only on the rail's keys. One reversed plate: the count of cards not returned. The totals are margin apparatus, a ledger of hairline rows with the word left and the count right in tabular figures, never tiles. Cards and returns are rows; borrows are the rail, keys already seated, since it reads newest first.

STORY: The learner lands after logging in, reads 5 on the plate, sees Undo a git commit at the top with 9 borrows, sees the latest things they asked and the card each borrowed, finds the card they returned today, and takes a cold rep on the top card.

FIRST VIEWPORT: App nav, Dashboard current. Left margin: "Your cards" in apparatus capitals over the ledger (Borrowed, Borrowed again, Returned, then All cards under a heavier rule), and a note naming the projects counted. Block: "Still borrowed" at display size, a one-line lede at weight 500, the plate's count of cards not returned hanging over the block's right edge; hairline rows of those cards (skill, project with its demo label, borrows, last borrow), "Borrowed again" under a skill where true; "Take a cold rep on <skill>" as the primary button closing the section. 40px below, "Latest borrows" on the rail: the phrasing right-aligned in italic, a seated vermilion key, then the card's skill and the stamp. Then "Latest returns" in rows. Empty: the same head over a plate of 0, and an empty state with "Try the demo project" and a field that names a first project and goes to upload into it. Signature interaction: a card's skill, anywhere on the screen, opens that card and its cold rep; nothing moves on load.

FORM: an extension of rw-centre-rail-reference-setting; no new world or structure was rolled (the ticket forbids a workshop, and concept-seed refuses to deal without PRODUCT.md), so it carries that world's roll, recorded in .impeccable/surfaces/apps-src-index-tsx.md. Structure: the first of five ranked (rows then rail, totals in the margin; then facing columns across the rail, the top card set whole, a margin index of cards, a totals sentence). Build path: code-led. seed:d49f20dac50e8dce

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
