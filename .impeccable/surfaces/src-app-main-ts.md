---
version: 1
slug: "src-app-main-ts"
primary_target: "src/app/main.ts"
related_targets: ["public/styles/shell.css","public/styles/parts.css","src/screens/shelves.ts","src/parts","src/pages"]
---

# App shell and shared parts

Scope: the app's top navigation and screen frame, the public log in, sign up, and not-found pages, the shelves list, and the shared parts every later screen composes (form fields, rows, empty states, delete confirmation, the drop zone, code blocks). Visitor mode: Operate. The learner signs up, lands in the app, and keeps a shelf for each part of their life; later screens (upload, settings, the Desk, the stack, the rep) are built from these parts.

Constraints: the Centre Rail world in docs/DESIGN.md is fixed; the card stack and rep screens keep their look; the page reaches the server only through the SDK; no images, no comps, no direction workshop (the world was chosen on October 16, 2026). Product truth comes from devpost/scope.md, devpost/prd.md, and the spec m1kuorg/basics#40, standing in for PRODUCT.md.

## Direction contract

THESIS: The shell is the edition's running head and the parts are its standard furniture, set by the same ruling engine as the stack: a proof-gray bar, one white block, hairline rows. It refuses the app-kit default of a sidebar, rounded cards, modal dialogs, and toasts.

OWN-WORLD: Proof-gray ground and nav, white block, iron ink, 1px hairlines opening and closing every list with Rule Gray between rows, square controls, Hanken Grotesk only, tabular figures. Notices (errors and delete confirmations) share one frame with a 3px head rule. Wells (the drop zone, code blocks) are recessed proof gray between iron hairlines, like the rail's bar. No vermilion outside rail keys and key letters.

STORY: The learner signs up in one block, lands on the Desk, opens Shelves, makes Work and Bootcamp, renames one, deletes one after reading exactly what goes, and logs out knowing where everything is.

FIRST VIEWPORT: The 60px proof-gray nav: Asked Before, then Desk, Shelves, Settings as full-height cells, the current one filled white at weight 800; the learner's name and Log out at the right. Below, the left margin's note, and the block: "Shelves" at display size, hairline rows of shelves with their card counts in tabular figures and quiet Rename and Delete actions, then the New shelf field and its button closing the block. Signature interaction: Delete opens a notice inside the list, under its row, naming everything that goes, with focus on Keep it.

FORM: an extension of rw-centre-rail-reference-setting, the world the card stack's round 2 dealt; no new world or structure was rolled for the shell, so it carries that world's roll, recorded in .impeccable/surfaces/apps-src-index-tsx.md. seed:d49f20dac50e8dce

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
