---
version: 1
slug: "src-app-main-tsx"
primary_target: "src/app/main.tsx"
related_targets: ["src/app","src/screens","src/components"]
---

# App shell and screens

Scope: everything under `/app`: Home, Shelves, Shelf, Upload, Card and its cold rep, Settings, and not-found. Visitor mode: Operate. The learner's job: clear the queue of cards that need a cold rep. Open one, prove it without AI, move to the next. The frequency is a periodic check-up, plus captures from agents. Constraints: the page reaches the server only through the SDK; the password never leaves the page; CSP `default-src 'self'`; 20 model requests a day for the whole app. The style was dealt by design-taste-frontend (`.taste-skill/app/direction.json`, seed 1983195124).

## Direction contract

THESIS: A personal workspace that answers "what should I prove next?" with a typeset sentence and a queue. Each card carries its own history as an ask strip. It refuses the template dashboard (dark sidebar, KPI icon tiles, sparklines).

OWN-WORLD: Editorial greeting, light. White ground, #f7f2f5 plum-tinted panels, ink #101421, a near-black plum primary. Pink #ff488b only on the ask strip's dots and spans, under 2% of pixels, with a plum-black tick for the proven date. Schibsted Grotesk at 12/14/16/24, tabular figures. Soft radii: 16 on panels, 10 on controls. Pale status pairs: To prove, Proven, Asked since proven.

STORY: The learner opens Home, reads how many cards need a cold rep, starts the top one in one click, answers without AI, gets "Not yet" with the lesson again or "Proven <date>", and moves to Next.

FIRST VIEWPORT: A 240px open-plane sidebar holds the mark, Home with its count, the shelves, Docs, Settings and the user row. The canvas is a centred 12-column grid. The h1 sentence is 24/400, with a grey line under it. Four count tiles sit 3+3+3+3. Then 8+4: the left column stacks Prove next (white row cards, each with every ask as a dot on one shared axis and "Start a cold rep", the top one filled), Your shelves, and Latest proven; the right column is Latest asks as a rail of recent messages. Amended 2026-10-24 at the finish review from the dealt 9+3 then 6+6: every one of these blocks is a list whose length is the account's own (4 to prove and 1 proven for one learner, 5 and 0 for the guest), so side-by-side pairs ended ragged for nearly every account (design-taste inspector ragged-row, app-screens §4.2), while app-screens §3.4 gives a stable secondary stream of recent items its own right rail. The queue stays the screen's biggest block and is read first.

FORM: design-taste-frontend app style "editorial-greeting", shell "Open plane", palette and type kept from the landing sheet. seed: none. The roll was skipped, not unavailable: on 2026-10-23 the user said "Skip impeccable visual world, use /design-taste-frontend".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
