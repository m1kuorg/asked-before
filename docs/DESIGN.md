---
name: Asked Before
description: Your own repeated questions, set as type on plum and pink outside, and as pink dots on a grey track inside a light, soft app.
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

Asked Before has two rooms built from one palette and one typeface. The public pages (landing, log in, sign up, 404) are type and nothing else: full-bleed fields of plum and white, one enormous statement per chapter in Schibsted Grotesk at 800, everything else small, square corners, and colour that changes by chapter instead of pictures. The visitor's own material, the same question asked nine different ways, is the picture. The app (`/app/*`) and the docs page are the opposite temperature: a light, soft, editorial workspace on a white ground, a 240px open-plane sidebar behind one hairline, tonal panels one step off white toward the plum, regular-weight numbers, and nothing louder than 24px.

What ties the rooms together is the ask strip: pink dots on a 2px grey track, one per time you asked, with a plum-black tick on the day you proved you could do it without AI. It is the product's mark, the main data element of every list, and the one place pink appears inside the app. Pink is rare on purpose: in the app it is data, not decoration.

Density in the app is calm and readable (14px body, 32px nav rows, 8px gaps between row cards). The public pages run at the opposite extreme of scale: 9 to 21vw display lines against 15 to 19px text, with nothing in between.

**Key Characteristics:**
- One typeface (Schibsted Grotesk, 400 to 900); JetBrains Mono only in code, API keys, and IDs.
- Public pages: square (0 radius), plum-black / plum-field / plum-surface / white chapters, pink primary buttons with plum-black words.
- App: white ground, `#f7f2f5` tonal panels at 16px radius, white row cards at 12px, 10px controls, fully round pills.
- The ask strip is the signature: pink on white only, a plum-black proven tick.
- Flat at rest; shadows only on menus, sheets, and toasts.
- Pale status pairs with dark ink of the same hue: To prove, Proven, Asked since proven, Not yet.

## Colors

A near-black plum and a hot pink, bracketing a white working surface whose greys all lean slightly toward the plum.

### Primary
- **Plum Black** (`plum-black`): the landing's ground and the footer, ink on pink buttons, the app's one filled primary button per screen, the focus ring on light grounds, and the proven tick on the ask strip. In the app it is also `--primary`.
- **Exam-Hall Plum** (`plum-field`): the hero and CTA chapters of the landing, the left half of log in and sign up, and the 404 field. The deepest saturated colour; it carries white ink only.
- **Plum Surface** (`plum-surface`): the landing's Proof chapter and the alternating dark rows (tables, agent rows) on plum-black.

### Secondary
- **Hot Pink** (`pink`, the app's `--ask`): on the public pages, primary buttons and footer links on plum; in the app, only the ask strip's dots and span, and the sidebar mark. It sits under 3:1 on the tinted panel, so it goes on white or plum only. `pink-hover` is the pink button under the pointer.
- **Pink Ink** (`ask-ink`): pink when it has to be text on white (6.0:1), and the caret colour of every input and textarea.
- **Selection Pink** (`selection`): text selection, with navy ink.

### Neutral
- **White** (`background`): the app's ground, row cards, inputs, and the landing's white chapters.
- **Navy-Black Ink** (`foreground`): all text on white and on the panel.
- **Plum Panel** (`panel`): the tonal panel of Home, settings panels, the Features statement cell on the landing. One step off white toward the plum; the face of the app.
- **Panel Edge** (`border`): row-card and panel edges, table and tab rules.
- **Row Rule** (`rule`): the quietest line, between rows inside lists.
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
**The Pink Is Data Rule.** In the app, pink appears only in the ask strip and the sidebar mark, under 2% of pixels. Buttons, links, headings, and highlights are never pink inside `/app`.

**The White Behind Pink Rule.** The ask strip sits on white (a row card, the card page, a `data-ui` fragment), never directly on the panel tint, where pink drops under 3:1.

**The Colour By Chapter Rule.** On the landing, each chapter is one full-bleed field with one ink: hero `plum-field`/white, Nine ways white/navy, Showcase `plum-black`/white, How it works white/navy, Proof `plum-surface`/white, Features `panel`/navy beside `plum-black` rows, FAQ white/navy, CTA `plum-field`/white, footer `plum-black` with pink links. The fixed header's two corners take the ink and ground of the chapter beneath them.

**The Red Is For Failure Rule.** Red (destructive, negative) marks a failing fact or an irreversible action, never emphasis.

## Typography

**Display Font:** Schibsted Grotesk (variable 400 to 900, self-hosted, with ui-sans-serif, system-ui)
**Body Font:** Schibsted Grotesk
**Label/Mono Font:** JetBrains Mono 400/500 (self-hosted), for `<pre>`, `<code>`, API keys, and IDs only

**Character:** One grotesk doing two jobs: set at 800 with -0.05em tracking it becomes a poster; set at 14/400 with tracking 0 it is a quiet working face. Schibsted replaced the dealt General Sans for licence reasons, so its tabular figures are used through the `Figure` component, which keeps the comma and period proportional.

### Hierarchy
Public pages use five steps (small, body, lead, head, display) and nothing between them.
- **Display** (800, 9.5 to 21vw, line-height 0.88, -0.05em): the hero "Asked before?", chapter statements ("Your words, / not your data", "Agents file it / as you ask."), the CTA's question at both edges, the cropped footer wordmark, the log-in and sign-up h1, the showcase input. Each line sits in its own clipped mask with 0.14em of room for descenders.
- **Headline** (800, clamp 32 to 64px, 0.95, -0.05em): chapter h2s such as "Nine ways to ask one thing", "How it works", "Fair questions".
- **Lead** (400 or 600, clamp 20 to 26px, 1.3): the hero's supporting sentence, the privacy line, row titles in dark rows, "Read the docs".
- **Body** (400, clamp 17 to 19px, 1.5): paragraphs, the Proof table, FAQ answers with the question as a 600 run-in, button labels.
- **Small** (400 or 600, 15px, 1.4): dates, the header links, table heads, footer legal line.

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

**App: open plane.** A 240px sidebar on the white ground, separated from the canvas by one 1px `border` hairline: the mark and name at the top, Home with its queue count, a 12px grey "Shelves" group label with 20px of air above, each shelf (truncated, with a tooltip when cut), All shelves, then Docs, Settings, and the user row pushed to the bottom. Nav rows are 32px on a 34px pitch, with 16px outline icons at 1.5px stroke. The canvas is fluid to `max-width: 1100px` (Settings 1152px) with 32px gutters, 36px from the top. Under 1024px the sidebar folds into a sticky 48px top bar with the screen's name and a menu button opening a full-screen sheet; content takes 16px margins.

**Home grid.** A 12-column grid with 16px gutters whose spans change by row but share column lines: four count tiles at 3/3/3/3 (128px, 2 x 2 on a phone), then Prove next at 9 beside Your shelves at 3, then Latest asks and Latest proven at 6 + 6. Spans stack below a 1100px container. Prove next's rows share their columns through a subgrid so every ask strip starts and ends on the same x.

**Settings.** Each section is one row: a label column (16/500 title, 14px grey description) beside a panel, in a 5fr + 32px + 8fr grid, stacking under 64rem.

**Public pages.** One pair of page margins (20px, 32px from 768px) and a 12-column grid with 24px gutters. Chapters are full bleed with 112px vertical padding (160px from 768px). Each chapter moves to a different horizontal position (statement left, sentence right, table full, FAQ pushed to columns 5 to 12), so the page moves without imagery. Log in and sign up split in half from 1024px: plum field left, white form column (max 384px) right.

**Rhythm.** A 4px base: 8px between row cards and in-row groups, 16px between panels and fields, 20px panel padding, 32px section gutters. Tables become two-line rows below 640px.

**Motion.** The app has feedback only: hover colour, a 1px press, focus, a sheet or menu opening, and the Proven stamp settling in once. The landing has entrances: the hero's lines rise out of their masks in 1.2s, each chapter's parts rise 24px once as they arrive (70ms stagger, `cubic-bezier(0.16, 1, 0.3, 1)` over 900ms), the header's ink follows the chapter in 300ms, buttons scale to 0.97 on press, and the exam-hall photograph drifts inside its frame with the scroll. Nothing loops, and every hidden starting state is inside `prefers-reduced-motion: no-preference`, so the reduced page is the finished page.

## Elevation & Depth

Flat. Depth in the app is tonal: white ground, a panel one step toward the plum, a white row card inside it with a border one step darker. On the landing, depth is the change of field between chapters and the tone alternation of dark rows. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Menu** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): dropdown menus.
- **Overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the phone nav sheet, submenus, and toasts.

### Named Rules
**The Flat At Rest Rule.** No shadow on panels, tiles, row cards, buttons, or inputs. Only menus, sheets, popovers, and toasts lift.

**The One Layer Rule.** A panel holds its title and content directly; a white row card sits inside a panel only for list rows. Never a panel inside a panel, or a tray around every block.

## Shapes

Two corner languages, switched by one variable. The app is soft: controls at 10px (`--radius`), row cards and in-place confirmations at 12px, panels and tiles at 16px, nav items at 8px, pills and chips fully round. The public pages set `--radius: 0` on their root, so buttons, notices, and the guest panel are square; any `data-ui` fragment (a real app piece shown on the landing) sets `--radius: 10px` back and keeps the app's soft corners. Borders are 1px throughout; the only 2px lines are the ask strip's track, the active tab's underline, and the showcase input's bottom rule. The Proven stamp is the one tilted shape (-2deg, 2px border).

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
- **Row card:** white, 12px corners, 1px panel-edge border, at least 63px tall, 10px by 16px padding, 8px apart.
- **Count tile:** panel tint, 16px corners, 128px tall, 16px padding: a 14/500 label, the value at 24/400 in tabular figures, a 12px grey caption pinned to the bottom. The four tiles sum visibly.
- **In-place confirmation:** a white 12px box with a 1px border under the row it confirms (`role="group"`), a 14/600 heading naming what goes, the destructive action and "Keep it", focus on the safe choice. Never a modal.

### Inputs / Fields
- **Style:** 40px, white even on a panel, 1px control-grey border, 10px corners, 12px sides, faint placeholder, pink-ink caret. Textareas grow with content from 96px.
- **Focus:** the one focus mark everywhere: a 2px outline 2px out in the ring colour (plum-black on light, white on plum, pink in the showcase).
- **Error / Disabled:** invalid turns the border red with a 3px red ring at 15%; disabled and read-only fill with the panel tint.
- **Segmented control:** panel tint inside a 1px control border, 10px corners, 2px inset; the pressed segment turns white with a panel-edge border.

### Navigation
- **App sidebar:** 14/400 muted rows, 32px tall, 8px corners, 16px outline icons. Hover tints the row with the panel and inks the text; the current page is the neutral active pill with ink text. Counts sit right-aligned at 12px grey in tabular figures.
- **Tabs:** underline tabs on a 1px rule, 14/500 grey labels, 24px apart; the active tab is ink with a 2px ink line under it.
- **Public header:** fixed, no bar: the wordmark top left and Docs, Log in, and the pink action top right, each corner taking its chapter's ink. Links use an underline that arrives on hover (0.08em thick, 0.2em offset).

### Ask Strip (signature)
The card's asks on a time axis shared by every strip in a list (from the first day of the earliest ask's month to today), drawn as a small SVG that takes the width it's given, with an `aria-label` such as "Asked 9 times, March 2025 to September 2026, proven October 23, 2026".
- **Every ask** (card page, landing): a 2px track-grey line, a 4.5px-radius pink dot per ask with a 1.5px white stroke; asks on the same day sit side by side, a dot and a gap apart.
- **Span** (list rows): a 4px round-capped pink bar from first to last ask, never narrower than 6px, with the count beside it at 12px grey.
- **Proven tick:** a 2px plum-black vertical line at the strip's full height, taller than the bar.
- **The mark:** the same grammar at 24px (three pink dots on the track, the plum-black tick) beside "Asked Before" in the sidebar. Never a letter in a square.

### Proven Stamp
The card page's one authored moment: "Proven" at 24/600 over its date, in the positive pair with a 2px border at 70%, 12px corners, tilted -2deg. After a pass it fades in from 105% and settles in 300ms, once.

## Do's and Don'ts

### Do:
- **Do** keep pink in the app to the ask strip and the sidebar mark, on white surfaces only.
- **Do** use the four status words and their pairs exactly: To prove, Proven, Asked since proven, and Not yet for a failed check; "Not on a card" for messages no card asks yet; "Start a cold rep" as the one rep verb.
- **Do** set numbers at regular weight with the `Figure` component's tabular digits.
- **Do** use one filled primary button per app screen, and one pink action per landing chapter.
- **Do** keep confirmations in place under their row, with focus on the safe choice and Escape to keep.
- **Do** show loading as flat bars in the panel-edge grey (8px corners) at the final size, with no shimmer and no layout shift.
- **Do** set `--radius: 10px` on any app fragment shown on a square public page.
- **Do** keep every hidden starting state of an entrance inside `prefers-reduced-motion: no-preference`.

### Don't:
- **Don't** put shadows on anything at rest; only menus, sheets, popovers, and toasts lift.
- **Don't** use gradients, glass, glow, violet or indigo, or cream with terracotta.
- **Don't** put a small label, number, or tracked uppercase line above a heading to introduce it.
- **Don't** set icons in tinted squares or use emoji; icons are 16px lucide outlines in grey.
- **Don't** use the monospace outside code, API keys, and IDs.
- **Don't** go above 24px for an app heading, or add a sixth type step on public pages.
- **Don't** put the ask strip, or any pink, on the panel tint.
- **Don't** animate forever: no infinite loops, no `animate-pulse`, no spinner outside an in-flight request.
- **Don't** open a modal to confirm a delete.
