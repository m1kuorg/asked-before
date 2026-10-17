---
version: 1
slug: "src-pages-landing-ts"
primary_target: "src/pages/landing.ts"
related_targets: ["public/index.html","public/styles/landing.css"]
---

# Landing page

Scope: the public landing page at `/`, ticket m1kuorg/basics#52. Visitor mode: Persuade. A visitor who keeps asking a chatbot how to do things decides in seconds whether Asked Before is for them, sees a real card, learns the three steps, what leaves their computer, and that their coding agent can reach it, then signs up or logs in.

Constraints: the Centre Rail world in docs/DESIGN.md is fixed, with no direction workshop, no images, and no comps; the card is the demo export's card A, set with the app's own rail markup and stack.css, and labeled demo data; the spec's privacy line, verbatim; no claims about users, testimonials, or numbers; glossary words only, and "chat export", never the chatbot's brand. Product truth comes from devpost/scope.md, devpost/prd.md, and the spec m1kuorg/basics#40, standing in for PRODUCT.md.

## Direction contract

THESIS: The landing page is the edition's opening page: one sentence on what Asked Before does, then a real card set in the block exactly as the app sets it, so the visitor sees nine of someone's own questions twinned with their dates around a vermilion rail before any explanation. It refuses the category default of a centred hero over a framed screenshot, a row of icon feature cards, testimonials, and a closing CTA band.

OWN-WORLD: Proof-gray ground, one white block ruled in 1px iron hairlines, square corners, Hanken Grotesk only, tabular figures, phrasings in the italic. Vermilion only on the card's rail keys. One reversed plate: the card's 9. Each section below opens on an iron hairline on the rail's own columns: its heading, and each item's title, set against the centre on the left, facing their words on the right as a phrasing faces its date; side-notes sit in the wide margin beside the section they annotate, as the edition's apparatus.

STORY: The visitor reads the pitch, watches a real card's nine keys drop, learns the three steps and exactly what leaves their computer, sees that Claude Code, Claude Desktop, and Cursor can record their questions too, and signs up in the block's last section without leaving the page.

FIRST VIEWPORT: Public nav. Block head: the pitch at display size across the block; under it the lede in the left column, and Sign up in the right, seated on the lede's first line, going to the sign-up form that closes the page (Log in stays in the nav and the close: the critique found the head's Log in doubled the nav's). A hairline, then "Undo a git commit" with its Demo data label, "Borrowed 9 times, March 2025 to September 2026", and the whole rail, closing inside the 1080 frame, with keys dropping in date order; the plate's 9 hangs over the block's right edge beside the card; the margin's side-note, level with the card, says what the card is and how to read it, and on a narrow screen follows the rail. Signature interaction: the key drop, once, on load; nothing else moves.

FORM: an extension of rw-centre-rail-reference-setting; no new world or structure was rolled for this page (the ticket forbids a workshop), so it carries that world's roll, recorded in .impeccable/surfaces/apps-src-index-tsx.md; `concept-seed --check-seed` reports it unknown on this machine (exit 1), so that record is its corroboration. Build path: code-led, no image generation. seed:d49f20dac50e8dce

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
