---
name: Asked Before
description: Your own repeated questions, set as type on plum and white beside found black-and-white pictures outside, and as pink dots on a grey track inside a light, soft app.
colors:
  plum-black: "#0d060b"
  plum-surface: "#1b0e17"
  plum-field: "#470c35"
  pink: "#ff488b"
  pink-hover: "#ff6fa3"
  ask-ink: "#c0185a"
  muted-on-dark: "#9a8f97"
  background: "#ffffff"
  foreground: "#101421"
  panel: "#f7f2f5"
  border: "#ece4e9"
  rule: "#f0e9ee"
  edge: "#d9cfd6"
  input: "#857b8a"
  muted-foreground: "#5d5562"
  faint: "#6b6470"
  active: "#efe7ec"
  active-foreground: "#3b3240"
  track: "#e3dae0"
  selection: "#f9cfe0"
  destructive: "#c4242a"
  positive: "#dcfae5"
  positive-foreground: "#04250e"
  notice: "#fffbeb"
  notice-foreground: "#92400e"
  notice-border: "#fde68a"
  negative: "#ffedea"
  negative-foreground: "#831c1e"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.6vw"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.3rem + 3.2vw, 4rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.05em"
  lead:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body-public:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  small-public:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  app-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0"
  app-greeting:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "0"
  app-body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: "0"
  app-label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  public-margin-phone: "20px"
  public-margin: "32px"
components:
  button-primary:
    backgroundColor: "{colors.plum-black}"
    textColor: "{colors.background}"
    typography: "{typography.app-body}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.panel}"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.panel}"
  button-destructive:
    backgroundColor: "{colors.background}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-destructive-hover:
    backgroundColor: "{colors.negative}"
  button-public:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.plum-black}"
    typography: "{typography.body-public}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  button-public-hover:
    backgroundColor: "{colors.pink-hover}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
    height: "40px"
  pill-to-prove:
    backgroundColor: "{colors.active}"
    textColor: "{colors.active-foreground}"
    typography: "{typography.app-label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "20px"
  pill-proven:
    backgroundColor: "{colors.positive}"
    textColor: "{colors.positive-foreground}"
    typography: "{typography.app-label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "20px"
  pill-asked-since-proven:
    backgroundColor: "{colors.notice}"
    textColor: "{colors.notice-foreground}"
    typography: "{typography.app-label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "20px"
  pill-not-yet:
    backgroundColor: "{colors.negative}"
    textColor: "{colors.negative-foreground}"
    typography: "{typography.app-label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "20px"
  chip-demo-data:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.app-label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "20px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  row-card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    height: "63px"
  rule-row:
    textColor: "{colors.foreground}"
    typography: "{typography.app-body}"
    padding: "10px 0"
  photo:
    backgroundColor: "{colors.plum-surface}"
    rounded: "{rounded.none}"
  count-tile:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.2xl}"
    padding: "16px"
    height: "128px"
  nav-item:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.app-body}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.active}"
    textColor: "{colors.foreground}"
  sidebar:
    backgroundColor: "{colors.background}"
    width: "240px"
---

# Design System: Asked Before

## Overview

**Creative North Star: "The Repeated Question, Typeset"**

Asked Before has two rooms built from one palette and one typeface. The public pages (landing, log in, sign up, 404) lead with type: full-bleed fields of plum and white, one enormous statement per chapter in Schibsted Grotesk at 800, everything else small, square corners, and colour that changes by chapter. The visitor's own material, the same question asked nine different ways, is the main picture. Beside it, the landing carries found documents of the same habit from before AI: four archival black-and-white photographs (a card catalog, a pupil at the blackboard, an examination hall) and one muted newsreel loop of a written examination, all square, untouched, and captioned with what and when. The landing's direction contract still says "type and nothing else"; the build added the pictures, and this record follows the build. The app (`/app/*`) and the two reading pages, docs and privacy, are the opposite temperature: a light, soft, editorial workspace on a white ground, a 240px open-plane sidebar behind one hairline, tonal panels one step off white toward the plum, regular-weight numbers, and nothing louder than 24px.

What ties the rooms together is the ask strip: pink dots on a 2px grey track, one per time you asked, with a plum-black tick on the day you proved you could do it without AI. It is the product's mark, the main data element of every list, and the one place pink appears inside the app. Pink is rare on purpose: in the app it is data, not decoration.

Density in the app is calm and readable (14px body, 32px nav rows, 8px gaps between row cards). The public pages run at the opposite extreme of scale: 9 to 21vw display lines against 15 to 19px text, with nothing in between.

**Key Characteristics:**
- One typeface (Schibsted Grotesk, 400 to 900); JetBrains Mono only in code, API keys, and IDs.
- Public pages: square (0 radius), plum-black / plum-field / plum-surface / white chapters, pink primary buttons with plum-black words.
- Found pictures in one treatment: untouched black and white, square, the plum surface behind them while they load, a small grey caption and date under each, credited in the footer.
- App: white ground, `#f7f2f5` tonal panels at 16px radius, rule-separated rows inside them, white row cards at 12px only where a row holds the ask strip, 10px controls, fully round pills.
- The ask strip is the signature: pink on white only, a plum-black proven tick.
- Flat at rest; shadows only on menus, sheets, and toasts.
- Pale status pairs with dark ink of the same hue: To prove, Proven, Asked since proven, Not yet.

## Colors

A near-black plum and a hot pink, bracketing a white working surface whose greys all lean slightly toward the plum.

### Primary
- **Plum Black** (`plum-black`): the landing's ground and the footer, ink on pink buttons, the app's one filled primary button per screen, the focus ring on light grounds, and the proven tick on the ask strip. In the app it is also `--primary`.
- **Exam-Hall Plum** (`plum-field`): the hero and CTA chapters of the landing, the left half of log in and sign up, and the 404 field. The deepest saturated colour; it carries white ink only.
- **Plum Surface** (`plum-surface`): the landing's Proof chapter, the alternating dark rows (tables, agent rows) on plum-black, and the ground behind every found picture and the film while they load.

### Secondary
- **Hot Pink** (`pink`, the app's `--ask`): on the public pages, primary buttons and footer links on plum; in the app, only the ask strip's dots and span, and the sidebar mark. It sits under 3:1 on the tinted panel, so it goes on white or plum only. `pink-hover` is the pink button under the pointer.
- **Pink Ink** (`ask-ink`): pink when it has to be text on white (6.0:1), and the caret colour of every input and textarea.
- **Selection Pink** (`selection`): text selection, with navy ink.

### Neutral
- **White** (`background`): the app's ground, row cards, inputs, and the landing's white chapters.
- **Navy-Black Ink** (`foreground`): all text on white and on the panel.
- **Plum Panel** (`panel`): the tonal panel of Home, settings panels, the Features statement cell on the landing. One step off white toward the plum; the face of the app.
- **Panel Edge** (`border`): row-card and panel edges, table and tab rules, and the 1px rule between rows of a list on the panel tint.
- **Row Rule** (`rule`): the quietest line, between rows of a list on white (the shelf's cards).
- **Quiet Edge** (`edge`): what isn't an input but needs an edge: the secondary button, the outline Demo data chip, dashed empty frames.
- **Control Edge** (`input`): every control's border (inputs, textarea, segmented control, drop target). 4.0:1 on white, for WCAG 1.4.11.
- **Muted Grey** (`muted-foreground`): sublines, captions, nav labels at rest. 7.1:1 on white, 6.5:1 on the panel.
- **Faint Grey** (`faint`): meta and placeholders.
- **Active Pill** (`active` / `active-foreground`): the active nav item, menu highlight, and the To prove pill.
- **Track Grey** (`track`): the ask strip's 2px track.
- **Muted on Dark** (`muted-on-dark`): secondary text on plum grounds only (6.4:1 on plum-black); on white use Muted Grey.

### Status
- **Proven** (`positive` / `positive-foreground`), **Asked since proven** (`notice` / `notice-foreground`, with `notice-border`), **Not yet and errors** (`negative` / `negative-foreground`): pale grounds with dark ink of the same hue. **Destructive Red** (`destructive`) is the outlined delete button and invalid-field border only.

### Named Rules
**The Pink Is Data Rule.** In the app, pink appears only in the ask strip and the sidebar mark, under 2% of pixels, and as Pink Ink on the literal values of the Playground's JSON. Buttons, links, headings, and highlights are never pink inside `/app`.

**The White Behind Pink Rule.** The ask strip sits on white (a row card, the card page, a `data-ui` fragment), never directly on the panel tint, where pink drops under 3:1.

**The Colour By Chapter Rule.** On the landing, each chapter is one full-bleed field with one ink: hero `plum-field`/white, Nine ways white/navy, Showcase `plum-black`/white, How it works white/navy, Proof `plum-surface`/white, Features `panel`/navy beside `plum-black` rows, FAQ white/navy, CTA `plum-field`/white, footer `plum-black` with pink links. The found pictures sit untouched only on white chapters (Nine ways, How it works, FAQ) and belong to them. The dark chapters (hero, Showcase, Proof, Features' dark half, CTA, footer) carry the same pictures as an ASCII field instead: the photograph rebuilt in the demo's own phrasings. Every chapter is at least one viewport tall (`min-h-svh`). The fixed header's two corners take the ink and the ground of the chapter beneath them, so the header stays a solid patch of that chapter over a picture and never shows it through its words.

**The Red Is For Failure Rule.** Red (destructive, negative) marks a failing fact or an irreversible action, never emphasis.

## Typography

**Display Font:** Schibsted Grotesk (variable 400 to 900, self-hosted, with ui-sans-serif, system-ui)
**Body Font:** Schibsted Grotesk
**Label/Mono Font:** JetBrains Mono 400/500 (self-hosted), for `<pre>`, `<code>`, API keys, and IDs only

**Character:** One grotesk doing two jobs: set at 800 with -0.05em tracking it becomes a poster; set at 14/400 with tracking 0 it is a quiet working face. Schibsted replaced the dealt General Sans for licence reasons, so its tabular figures are used through the `Figure` component, which keeps the comma and period proportional.

### Hierarchy
Public pages use five steps (small, body, lead, head, display) and nothing between them.
- **Display** (800, 9.5 to 21vw, line-height 0.88, -0.05em): the hero "Asked before?" (21vw, 15.6vw from 1024px), chapter statements ("Your words, / not your data", "Agents file it / as you ask.", 11vw, then clamp 48 to 88px from 768px), the CTA's question at both edges, the log-in and sign-up h1, the showcase input (9.5vw). The footer wordmark is sized to its container, not the viewport (`calc(100cqw / 6.15)`), so "Asked Before" fits between the margins at every width and is cut by the bottom edge only. Each line sits in its own clipped mask with 0.14em of room for descenders.
- **Headline** (800, clamp 32 to 64px, 0.95, -0.05em): chapter h2s such as "Nine ways to ask one thing", "How it works", "Fair questions".
- **Lead** (400 or 600, clamp 20 to 26px, 1.3): the hero's supporting sentence, the privacy line, row titles in dark rows, "Read the docs".
- **Body** (400, clamp 17 to 19px, 1.5): paragraphs, the Proof table, FAQ answers with the question as a 600 run-in, button labels.
- **Small** (400 or 600, 15px, 1.4): dates, the header links, table heads, picture captions and their dates, the film's Play / Pause, footer legal line.

The app uses four sizes only: 12, 14, 16, 24, tracking 0, weights 400/500/600.
- **App Title** (600, 24px): each screen's h1, clamped to two lines.
- **App Greeting** (400, 24px): Home's h1, a sentence built from the data ("4 cards need a cold rep, 1 is proven."), with a 14px grey line under it.
- **Body** (400, 14px): the app's default text; 600 for panel titles, 500 for row names, settings section titles at 16/500.
- **Label** (500, 12px): pills, chips, captions, axis labels, counts beside strips.
- **Figures** (24/400 in tiles, tabular): numbers are set at regular weight, never bold.

### Named Rules
**The Nothing In Between Rule.** On public pages, a size is one of the five steps. The jump from body to display is the point; don't add a 32px subhead to soften it.

**The Thirty-Two Ceiling Rule.** Nothing in the app is larger than 32px, and screen headings are 24px. Scale in the app comes from space and tone, not size.

**The Sentence Case Rule.** Every label is sentence case at tracking 0 or tighter. No uppercase, no letter-spaced labels, no text above a heading to introduce it.

## Layout

**App: open plane.** A 240px sidebar on the white ground, separated from the canvas by one 1px `border` hairline: the mark and name at the top, Home with its queue count, a 12px grey "Shelves" group label with 20px of air above, each shelf (truncated, with a tooltip when cut), All shelves, then Connect your AI, Playground, Docs, Settings, and the user row pushed to the bottom. While a settings view is open, its three areas (Account, API keys, Your data) sit under Settings as indented rows without icons. Nav rows are 32px on a 34px pitch, with 16px outline icons at 1.5px stroke. The canvas is fluid to `max-width: 1100px` (Settings 1152px, the Playground 1440px) with 32px gutters, 36px from the top. Under 1024px the sidebar folds into a sticky 48px top bar with the screen's name and a menu button opening a full-screen sheet; content takes 16px margins.

**Home grid.** A 12-column grid with 16px gutters (77px columns in the 1100px canvas): four count tiles at 3/3/3/3 (128px, 2 x 2 on a phone), then 8 + 4. The left eight stack Prove next, Your shelves, and Latest proven 16px apart; the right four is Latest asks, a rail of your newest messages. The row stretches so both columns end level, Latest proven taking the left column's remaining height. Everything stacks below a 1100px container. Prove next's rows share their columns through a subgrid so every ask strip starts and ends on the same x.

**Shelves.** The table of shelves, and under each shelf that has cards to prove, a full-width row of its three most asked cards that need a cold rep (skill, ask span, times asked, then "2 more on Demo"), every span on one axis across the page. Under the table, "How shelves work": four term and description pairs, two columns from 40rem.

**Upload and Uploads.** 8 + 4 of 12 from a 56rem canvas, the how-to at 4. Before a file is chosen, the drop target spans all 12, then "What leaves this computer" (the table without counts) takes the 8 beside the how-to. A shelf's Uploads view puts the list at 8 beside "Where your messages went" at 4 (a panel: on cards, not on a card, in all), with "What an upload sends" under the list.

**Settings.** One view per area, Account, API keys, and Your data, each with its name as the 24px h1 over one grey line, then its sections split by full-width rules. Each section is one row: a label column (16/500 title, 14px grey description, and, where it has them, the current values as term and value pairs on row rules) beside a panel, in a 5fr + 32px + 8fr grid, stacking under 64rem.

**Connect your AI.** From a 60rem canvas, the flow takes 8 of 12 columns and the rail 4 (729 + 16 + 355 in the 1100px canvas, Home's split); under it everything stacks, the keys first. The flow is an `<ol>` of four tonal step panels 16px apart, ordered by position alone, with no step numbers. The rail's blocks sit on the white ground with no frame, 40px apart, so the two columns end where their content does.

**Playground.** The endpoint list, a panel 15rem wide (17rem from a 72rem canvas), is sticky under the top with its own scroll, beside the work column; under a 42rem canvas it becomes a select at the top of the work. The work column stacks the address bar, the endpoint's lines, and any confirmation, then from a 48rem column the request with its code under it at 5 beside the response at 6; narrower, the request, the response, then the code.

**Roadmap.** Home's 12 columns: "Next on your path" at 8 (a panel whose one white row card holds the next card's ask strip and the screen's one filled "Start a cold rep") beside "Placed by the words in its name" at 4, a rail block saying the rule. Then the path at full width, under its 16/500 heading and its key (the three house pills, each with how many cards on the path it marks, and the two connectors scaled down). The path is an ordered list of the 13 areas, drawn from a 56rem map as roadmap.sh's spine in the house style: three columns per area, what it covers (14px grey, right-aligned to the spine) at 1fr, the node at 13rem, its cards at 1.5fr. The spine is a 2px plum-black line down the nodes' column; a node is a white 12px card with a 1px panel edge, its name at 14/600 over its count at 12px, and an area with no card is the same frame dashed in the quiet edge, its name grey, "No card on it yet": nothing is locked or filled. Cards hang off the node's right edge as stations: a 1px connector, dashed in the quiet edge to a card that needs a cold rep and solid plum-black to a Proven one, ending in a 10px dot (white with a control-grey ring, or filled plum-black), then the skill at 14/500, "asked 9 times · its name says “git” and “commit”" at 12px grey, and the status pill at the right, the row's one status mark. Each area ends on one 14px grey sentence ("Git: 0 of 1 proven."). A sticky index runs down the right edge, a 2rem column of ticks in the control grey, longer where an area holds cards, the area in view a 2px plum-black tick, each a link named on hover and focus. Under a 56rem map the same list is an indented tree: the spine down the left edge with a 12px ring at each area's 16/500 heading, and the cards as rule rows. The cards off the path follow as rule rows on the white ground. The spine and the index's tick are the app's other 2px lines, and the connectors its other dashed ones: the map is a chart.

**Public pages.** One pair of page margins (20px, 32px from 768px) and a 12-column grid with 24px gutters. Chapters are full bleed with 112px vertical padding (160px from 768px). Each chapter moves to a different horizontal position (statement left, sentence right, table full, FAQ pushed to columns 5 to 12). The pictures follow the same grid: the card catalog on the phrasings' column under Nine ways, the pupil under "Finally, prove it without AI." in How it works' left margin (first, at three-fifths width, without that margin), the examination hall full width after the exchanges, and the film under "Fair questions" in the left four columns from 1024px, beside the answers. Log in and sign up split in half from 1024px: plum field left, white form column (max 384px) right.

**Reading pages.** The docs and privacy pages share one layout on the app's light tokens: a top bar with the wordmark and "Open the app", the h1 at 64 to 128px (800, the display tracking and leading) over a lead line, then from 1024px a sticky 11.5rem index on the left, marking the section being read, beside a centred column up to 58rem with prose at a 70ch measure and 30px/700 section heads 96px apart. Under 1024px the index is a two- or three-column grid above the sections. Each page links to the other under its index. The privacy page adds a rail on the right, "In short": six one-line facts from its sections, 14px in ink, each linking to its section, sticky and as wide as the index, which makes the frame symmetric (both side columns at least 11.5rem). Under 1024px the rail follows the privacy line, and the column narrows to the prose's 70ch measure, centred, with the top bar on the same margins.

**Rhythm.** A 4px base: 8px between row cards and in-row groups, 16px between panels and fields, 20px panel padding, 32px section gutters. Tables become two-line rows below 640px.

**Motion.** The app has feedback only: hover colour, a 1px press, focus, a sheet or menu opening, and the Proven stamp settling in once. The landing has entrances: the hero's lines rise out of their masks in 1.2s, each chapter's headings and parts rise 24px once as they arrive (70ms stagger, `cubic-bezier(0.16, 1, 0.3, 1)` over 900ms), pictures fade in, the header's ink follows the chapter in 300ms, buttons scale to 0.97 on press, and the two large photographs (card catalog, examination hall) drift inside their frames with the scroll (106% of the frame's height). Reading text has no entrance: the FAQ answers are there when the eye arrives. The one loop is the newsreel: muted, playing only while in view, with Play / Pause beside its caption, and under reduced motion it waits on its poster until pressed. Every hidden starting state is inside `prefers-reduced-motion: no-preference`, so the reduced page is the finished page.

## Elevation & Depth

Flat. Depth in the app is tonal: white ground, a panel one step toward the plum, a white row card inside it with a border one step darker. On the landing, depth is the change of field between chapters and the tone alternation of dark rows. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Menu** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): dropdown menus.
- **Overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the phone nav sheet, submenus, and toasts.

### Named Rules
**The Flat At Rest Rule.** No shadow on panels, tiles, row cards, buttons, or inputs. Only menus, sheets, popovers, and toasts lift.

**The One Layer Rule.** A panel holds its title and content directly; a list in a panel is rows separated by 1px rules, with no card of their own. A white row card sits inside a panel only when the row holds the ask strip (Prove next), which needs white. Never a panel inside a panel, or a tray around every block.

## Shapes

Two corner languages, switched by one variable. The app is soft: controls at 10px (`--radius`), row cards and in-place confirmations at 12px, panels and tiles at 16px, nav items at 8px, pills and chips fully round. The public pages set `--radius: 0` on their root, so buttons, notices, and the guest panel are square; any `data-ui` fragment (a real app piece shown on the landing) sets `--radius: 10px` back and keeps the app's soft corners. Borders are 1px throughout; the only 2px lines are the ask strip's track, the active tab's underline, and the showcase input's bottom rule. Pictures and the film are square-cornered rectangles with no border, at their own proportions or cropped to a set frame. The Proven stamp is the one tilted shape (-2deg, 2px border).

## Components

### Buttons
- **Shape:** gently rounded (10px) in the app, square on public pages.
- **Primary:** plum-black fill, white 14/500 label, 40px tall, 16px sides; one per screen (on Home, only the top Prove next row's "Start a cold rep"). Hover lightens to 85%.
- **Secondary:** white with a 1px quiet edge; hover darkens the edge to the control grey and fills with the panel tint.
- **Ghost:** no edge until hovered (panel tint), used for row actions.
- **Destructive:** outlined in red at 60%, red text on white; hover fills with the pale negative.
- **Link:** ink text with a control-grey underline that turns ink on hover.
- **Public primary:** pink fill, plum-black 600 label at the body step, 48px (56px in the CTA), square, `pink-hover` under the pointer, scale 0.97 on press. On log in and sign up, the form's primary takes these colours through `--primary`.
- **Sizes and busy:** 32px and 28px small sizes grow to 44px under 1024px or on a coarse pointer. A busy button is disabled at 60% with a spinner before its words, only while the request is in flight.

### Pills and Chips
- **Style:** 20px tall, 12/500, fully round, a pale ground with dark ink of the same hue.
- **Status:** To prove (active pair), Proven (positive pair), Asked since proven (notice pair with its amber border), Not yet (negative pair). One status mark per row.
- **Demo data chip:** outline variant, white with a quiet edge and grey text, beside any demo shelf name and on every demo fragment.

### Cards / Containers
- **Panel:** panel tint, 16px corners, 20px padding (16px on a phone), a 14/600 title with an optional count pill and link on its right, a 14px grey line under it. No border, no shadow.
- **Row card:** white, 12px corners, 1px panel-edge border, at least 63px tall, 10px by 16px padding, 8px apart. Prove next's rows only: they hold the ask strip.
- **Rule row:** a list row in any other panel (Your shelves, Latest proven, Latest asks, Where your messages went): no ground of its own, 10px top and bottom, a 1px panel-edge rule under it and none under the last. Latest asks' rows take 11px for the two lines they hold. A column-label line above a rule-row list takes the same rule.
- **Count tile:** panel tint, 16px corners, 128px tall, 16px padding: a 14/500 label, the value at 24/400 in tabular figures, a 12px grey caption pinned to the bottom. The four tiles sum visibly.
- **In-place confirmation:** a white 12px box with a 1px border under the row it confirms (`role="group"`), a 14/600 heading naming what goes, the destructive action and "Keep it", focus on the safe choice. Never a modal.
- **Spend confirmation:** the Playground's second click before a request that spends model requests, in place under the address: the same box in the notice pair with its amber border, a 14/600 question, the cost in words, an outlined action and a ghost "Don't send", which has focus, so Send stays the one filled button.
- **Step panel:** a step of Connect your AI: panel tint, 16px corners, 16px padding (20px from 640px), a 16/500 heading that says what to do ("Give it a key").
- **Rail block:** reference beside a flow, on the ground with no frame of its own: a 14/600 heading with an optional link on its right, a 14px grey line, then its table or list.

### Inputs / Fields
- **Style:** 40px, white even on a panel, 1px control-grey border, 10px corners, 12px sides, faint placeholder, pink-ink caret. Textareas grow with content from 96px.
- **Focus:** the one focus mark everywhere: a 2px outline 2px out in the ring colour (plum-black on light, white on plum, pink in the showcase).
- **Error / Disabled:** invalid turns the border red with a 3px red ring at 15%; disabled and read-only fill with the panel tint.
- **Segmented control:** panel tint inside a 1px control border, 10px corners, 2px inset; the pressed segment turns white with a panel-edge border. The Playground's Send as (This session, An API key) is one.
- **Radio cards:** Pick your agent: each choice a white 12px card with a 1px panel-edge border on the step panel, the radio, the name at 14/500, a Recommended badge on the first, and a 14px grey line; the picked card takes an ink edge, and the focus ring draws around the card. Two across from a 32rem step.
- **Select:** the Playground's shelf picker and its phone endpoint list: a white 40px trigger (44px for the endpoints), its list a menu.

### Navigation
- **App sidebar:** 14/400 muted rows, 32px tall, 8px corners, 16px outline icons. Hover tints the row with the panel and inks the text; the current page is the neutral active pill with ink text. Counts sit right-aligned at 12px grey in tabular figures.
- **Settings' areas:** three indented rows without icons under Settings while a settings view is open; the open area is the active pill, and Settings stays in ink as their heading.
- **Endpoint list:** the Playground's left panel (panel tint, 8px padding): a 16/500 "Endpoints" heading, each area's name in 12px grey, then rows of the method in grey and the path in 14px code, the open row the active pill, the ones that don't run here in grey.
- **Tabs:** underline tabs on a 1px rule, 14/500 grey labels, 24px apart; the active tab is ink with a 2px ink line under it.
- **Public header:** fixed, no bar: the wordmark top left and Docs, Log in, and the pink action top right, each corner taking its chapter's ink. Links use an underline that arrives on hover (0.08em thick, 0.2em offset).

### Ask Strip (signature)
The card's asks on a time axis shared by every strip in a list (from the first day of the earliest ask's month to today), drawn as a small SVG that takes the width it's given, with an `aria-label` such as "Asked 9 times, March 2025 to September 2026, proven October 23, 2026".
- **Every ask** (card page, landing): a 2px track-grey line, a 4.5px-radius pink dot per ask with a 1.5px white stroke; asks on the same day sit side by side, a dot and a gap apart.
- **Span** (list rows): a 4px round-capped pink bar from first to last ask, never narrower than 6px, with the count beside it at 12px grey.
- **Span, then dots** (Prove next, and the first 25 rows of a shelf's filter): the row draws its span first, then trades it for one dot per ask in the same 14px-tall box once that card's asks arrive (four requests at a time, cancelled when the learner leaves), so nothing moves. A row whose request fails keeps its span. The Shelves page's top cards and rows past the 25th keep the span.
- **Proven tick:** a 2px plum-black vertical line at the strip's full height, taller than the bar.
- **The mark:** the same grammar at 24px (three pink dots on the track, the plum-black tick) beside "Asked Before" in the sidebar. Never a letter in a square.

### Found Picture and Film (landing)
- **Picture:** a square-cornered frame on the plum surface while it loads, the photograph untouched in black and white, lazy-loaded, with a 15px grey caption under it: what it shows on the left, its date on the right. A large picture may drift inside its frame with the scroll.
- **Film:** the same frame and caption, a muted H.264 loop with its first frame as the poster, playing only while in view; a 44px-tall Play / Pause link in 15px/600 sits on the caption's first line at the right.
- **Credits:** every picture and the film are credited in the footer from `public/images/credits.json`, title linked to the source and licence linked.

### ASCII Field (landing, dark chapters)
`src/pages/landing/ascii-field.tsx`: a `<canvas aria-hidden>` behind a dark chapter that rebuilds one of the found photographs in type, in the spirit of ascii-magic.com.
- **Characters:** the demo's re-asked phrasings, run in reading order through the grid, in JetBrains Mono on 13px rows (10px on phones), at most 4,000 cells.
- **Ink:** cells darker than 0.55 luminance stay empty. Brighter cells get pink letters on a faint pink tile, and the brightest get white letters. Each field caps its alpha (`peak`), up to 0.5. Proof uses ordered 4×4 Bayer dots instead of letters.
- **Text stays clear:** the field is cleared around every word, button, link, table and app fragment, measured from their boxes, so nothing lies under text.
- **Motion:** the words drift one cell every 200ms, and cells within 120px of the pointer brighten. It runs on `requestAnimationFrame` only while the chapter is near the viewport and the tab is visible. Under reduced motion it draws one still frame.
- **Where:** hero and footer use the 1958 exam hall in different crops. The Showcase uses the card catalogue, Proof the blackboard pupil as dots, Features the 1946 dictation, and the CTA the pupil in type.

### What Leaves This Computer
The privacy table, one component in three places: the upload preview (with this export's counts), under the drop target before a file is chosen (no counts, "In your export"), and under a shelf's uploads ("What an upload sends", "Stays on your computer"). Three columns (what, whether it leaves, whether the model sees it) on a 1px-ruled table; under 640px each row becomes what it is over one grey line saying where it goes.

### Proven Stamp
The card page's one authored moment: "Proven" at 24/600 over its date, in the positive pair with a 2px border at 70%, 12px corners, tilted -2deg. After a pass it fades in from 105% and settles in 300ms, once.

### Address Bar and Response (Playground)
- **Address bar:** one white line with a 1px quiet edge and 12px corners: the method as a 12/500 code chip on the panel tint, then the path in 14px code, its fixed parts grey, a filled id in ink and one still to fill faint, then Send, the screen's one filled primary, with its shortcut (⌘↵, or Ctrl↵) beside the word. Under a 28rem column, Send takes the full width.
- **Response:** a panel: the status and its phrase in a pale pair, positive under 400 and negative from there, with the time and the size in grey; the request it answers; what the status means; then the body.
- **JSON view:** 12/20 JetBrains Mono, a line per value indented by its depth and wrapping under its own indent: keys grey, strings ink, numbers, booleans, and null in the notice ink (`notice-foreground`, 6.4:1 on the panel), never pink, punctuation faint. An id that fills a field of the request is a button with a dotted underline. A long answer scrolls in its own box, at most 70% of the screen tall.
- **Code tabs:** the request as curl, the TypeScript SDK, and fetch, in underline tabs, each a copy block, always with `YOUR_API_KEY` and never a real key.

### Icons and Link Banners
- **Favicon** (`public/favicon.svg`): the mark redrawn on a 16px grid, transparent: three touching 4px pink asks on a 2px track-grey track, and a 2px plum-black tick. On a dark tab bar (`prefers-color-scheme: dark`) the track turns Muted on Dark and the tick white. `favicon.ico` is the light drawing at 16, 32, and 48.
- **App icons:** the mark on the plum field, with a white tick and a Muted on Dark track: `apple-touch-icon.png` (180, square, for iOS to round), `icon-192.png` and `icon-512.png` (a plum rounded square), and `icon-maskable-512.png` (the plum to every edge, the mark inside the 80% safe zone). The manifest's theme and background colours are white, the app's ground.
- **Theme colour:** the plum field on the landing, log in, sign up, and the 404; white on the docs, privacy, and the app.
- **Link banners** (`public/og/`, 1200×630): the landing's language at link size. The plum field and white ink: "Asked Before" at 30/600 at the top left; at the foot the page's title at 150px/800, -0.05em, leading 0.88; card A's nine asks as an ask strip, pink dots ringed in plum on a 3px Muted on Dark track across 80% of the width; then one 28px line. Everything sits inside the middle 80%, since X, iMessage, and Slack crop the edges. There are four: "Asked before?" (the landing and the 404), "Docs", "Privacy", and "Prove it without AI" (the app, log in, and sign up), each with alt text that says what it shows.
- **Provenance:** every raster icon and banner is recorded in `public/provenance.json`, with what it shows, what it was drawn from, and the script that drew it, as `credits.json` records the found pictures.
- **Without JavaScript:** one plain line in the page margins: "Asked Before needs JavaScript to show this page."

## Do's and Don'ts

### Do:
- **Do** keep pink in the app to the ask strip and the sidebar mark, on white surfaces only.
- **Do** use the four status words and their pairs exactly: To prove, Proven, Asked since proven, and Not yet for a failed check; "Not on a card" for messages no card asks yet; "Start a cold rep" as the one rep verb. Where the API's names show (the docs), map each to its on-screen word.
- **Do** set numbers at regular weight with the `Figure` component's tabular digits.
- **Do** use one filled primary button per app screen, and one pink action per landing chapter.
- **Do** keep confirmations in place under their row, with focus on the safe choice and Escape to keep.
- **Do** show loading as flat bars in the panel-edge grey (8px corners) at the final size, with no shimmer and no layout shift.
- **Do** set `--radius: 10px` on any app fragment shown on a square public page.
- **Do** keep every hidden starting state of an entrance inside `prefers-reduced-motion: no-preference`.
- **Do** separate rows in a panel with 1px rules; keep white row cards for rows that carry the ask strip.
- **Do** set a found picture untouched in black and white, square, on a white chapter, with its caption and date under it and its credit in the footer.

### Don't:
- **Don't** put shadows on anything at rest; only menus, sheets, popovers, and toasts lift.
- **Don't** use gradients, glass, glow, violet or indigo, or cream with terracotta.
- **Don't** put a small label, number, or tracked uppercase line above a heading to introduce it.
- **Don't** set icons in tinted squares or use emoji; icons are 16px lucide outlines in grey.
- **Don't** use the monospace outside code, API keys, and IDs.
- **Don't** go above 24px for an app heading, or add a sixth type step on public pages.
- **Don't** put the ask strip, or any pink, on the panel tint.
- **Don't** animate forever: no infinite loops, no `animate-pulse`, no spinner outside an in-flight request. The landing's newsreel is the one loop: muted, in view only, with Pause beside it, still under reduced motion.
- **Don't** give reading text an entrance; only headings and set pieces rise.
- **Don't** tint, duotone, round, or overlay text on a found picture shown as itself. Its ASCII field on a dark chapter is a separate, credited treatment and is cleared under text.
- **Don't** open a modal to confirm a delete.
