---
name: Asked Before
description: Your own phrasings and their dates, twinned around one rail with a vermilion key for every borrow.
colors:
  rubric: "#B42D16"
  proof-gray: "#E8EBED"
  block-white: "#FFFFFF"
  iron-black: "#1A1A1A"
  rule-gray: "#C3C8CC"
  gray-200: "#D5D9DC"
  gray-600: "#606263"
  gray-800: "#373839"
typography:
  display:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "3.375rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  display-narrow:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  count:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "9.375rem"
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-row:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.25
    fontFeature: "tnum"
  label:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  label-small:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.45
  label-button:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.2
  label-nav:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
  label-stamp:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
  apparatus:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.5rem"
  space-6: "2rem"
  space-7: "2.5rem"
  column: "32.5rem"
  rail-width: "4.5rem"
  measure: "60ch"
components:
  button-primary:
    backgroundColor: "{colors.iron-black}"
    textColor: "{colors.block-white}"
    typography: "{typography.label-button}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1.5rem"
  button-primary-active:
    backgroundColor: "{colors.gray-800}"
    textColor: "{colors.block-white}"
  button-primary-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.gray-600}"
  button-retry:
    backgroundColor: "{colors.block-white}"
    textColor: "{colors.iron-black}"
    typography: "{typography.label-button}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1.5rem"
  button-retry-hover:
    backgroundColor: "{colors.gray-200}"
  button-retry-active:
    backgroundColor: "{colors.rule-gray}"
  button-secondary:
    backgroundColor: "{colors.block-white}"
    textColor: "{colors.iron-black}"
    typography: "{typography.label-button}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1.5rem"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.iron-black}"
    typography: "{typography.label-nav}"
    padding: "0.5rem 0.75rem"
  button-quiet-hover:
    backgroundColor: "{colors.gray-200}"
  margin-key:
    backgroundColor: "transparent"
    textColor: "{colors.iron-black}"
    typography: "{typography.label}"
    padding: "0.75rem 0.5rem"
  margin-key-hover:
    backgroundColor: "{colors.gray-200}"
  margin-key-active:
    backgroundColor: "{colors.rule-gray}"
  margin-key-current:
    backgroundColor: "{colors.block-white}"
  margin-key-letter:
    textColor: "{colors.rubric}"
  rail-channel:
    backgroundColor: "{colors.proof-gray}"
    width: "{spacing.rail-width}"
  rail-key:
    backgroundColor: "{colors.rubric}"
    rounded: "{rounded.none}"
    size: "1.375rem"
  rail-detent:
    size: "1.875rem"
  plate:
    backgroundColor: "{colors.iron-black}"
    textColor: "{colors.block-white}"
    typography: "{typography.label}"
    padding: "1rem 1.5rem 1.5rem"
    width: "14rem"
  block:
    backgroundColor: "{colors.block-white}"
    rounded: "{rounded.none}"
    padding: "{spacing.space-7}"
  verdict:
    textColor: "{colors.iron-black}"
    padding: "1rem 1.5rem"
  answer-box:
    backgroundColor: "{colors.block-white}"
    textColor: "{colors.iron-black}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
    height: "9.5rem"
  answer-box-disabled:
    textColor: "{colors.gray-600}"
  error:
    textColor: "{colors.iron-black}"
    padding: "0.75rem 1rem"
  demo-label:
    textColor: "{colors.iron-black}"
    typography: "{typography.label-stamp}"
    padding: "0.25rem 0.75rem"
  nav:
    backgroundColor: "{colors.proof-gray}"
    textColor: "{colors.iron-black}"
    typography: "{typography.label-nav}"
    padding: "0 2.5rem"
    height: "3.75rem"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.iron-black}"
    typography: "{typography.label-nav}"
    padding: "0 0.75rem"
    height: "3.6875rem"
  nav-item-hover:
    backgroundColor: "{colors.gray-200}"
  nav-item-current:
    backgroundColor: "{colors.block-white}"
  field-input:
    backgroundColor: "{colors.block-white}"
    textColor: "{colors.iron-black}"
    typography: "{typography.body-row}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
    width: "{spacing.column}"
  field-input-locked:
    textColor: "{colors.iron-black}"
  rows:
    textColor: "{colors.iron-black}"
    typography: "{typography.body-row}"
    padding: "0.5625rem 1rem"
  rows-header:
    typography: "{typography.label-stamp}"
  confirm:
    backgroundColor: "{colors.block-white}"
    textColor: "{colors.iron-black}"
    padding: "1rem 1.5rem 1.5rem"
  drop-zone:
    backgroundColor: "{colors.proof-gray}"
    textColor: "{colors.iron-black}"
    padding: "{spacing.space-6}"
    height: "15rem"
  drop-zone-over:
    backgroundColor: "{colors.gray-200}"
  code-block:
    backgroundColor: "{colors.proof-gray}"
    textColor: "{colors.iron-black}"
    typography: "{typography.body}"
    padding: "1rem 1.5rem"
---

# Asked Before design

The visual world for Asked Before, chosen in [impeccable](/.claude/skills/impeccable/SKILL.md)'s direction workshop on October 16, 2026, with rules grounded in a search of X the same day, and recorded from the shipped stylesheets, now split per surface under `public/styles/`. The frontmatter's tokens are normative and match the custom properties in `public/styles/base.css`. [The scope](/devpost/scope.md) owns what the product is, the [card stack surface brief](/.impeccable/surfaces/apps-src-index-tsx.md) owns that screen's composition, the [app shell surface brief](/.impeccable/surfaces/src-app-main-ts.md) owns the shell's and the shared parts', and the [landing page surface brief](/.impeccable/surfaces/src-pages-landing-ts.md) owns the landing page's; this file is strictly visual. When a review catches a visual mistake, add a one-line Named Rule here.

Contents:

1.  [Overview](#overview)
1.  [Colors](#colors)
    1.  [Primary colors](#primary-colors)
    1.  [Neutral colors](#neutral-colors)
    1.  [Color rules](#color-rules)
1.  [Typography](#typography)
    1.  [Type hierarchy](#type-hierarchy)
    1.  [Type rules](#type-rules)
1.  [Layout](#layout)
1.  [Elevation & Depth](#elevation--depth)
1.  [Shapes](#shapes)
1.  [Components](#components)
    1.  [Buttons](#buttons)
    1.  [Navigation](#navigation)
    1.  [Links](#links)
    1.  [Margin keys](#margin-keys)
    1.  [The rail](#the-rail)
    1.  [The reversed plate](#the-reversed-plate)
    1.  [Verdicts](#verdicts)
    1.  [The answer box](#the-answer-box)
    1.  [Waits and errors](#waits-and-errors)
    1.  [Form fields](#form-fields)
    1.  [Rows](#rows)
    1.  [Empty states](#empty-states)
    1.  [The delete confirmation](#the-delete-confirmation)
    1.  [Wells: the drop zone and code blocks](#wells-the-drop-zone-and-code-blocks)
    1.  [The landing page](#the-landing-page)
1.  [Do's and Don'ts](#dos-and-donts)
    1.  [Design do's](#design-dos)
    1.  [Design don'ts](#design-donts)
1.  [See also](#see-also)

## Overview

**Creative North Star: "The Centre Rail"**

Every screen is set like a page of a wide-margin reference edition drawn by a ruling engine. A small, dense block holds the work; a wide margin around it carries the apparatus; and down the middle of the block runs one rail with a vermilion key on it for every borrow. Your own words sit on one side of the rail and what they point to sits on the other, so the keys show how often you asked before any number does.

The surface is for operating, not reading: navigation, buttons, and inputs stay the web's standard controls, and the world lends only type, palette, density, and the rail. The edition's bone stock and text serif are translated to proof gray and a grotesk, because a warm cream ground with a serif is the default look the user ruled out. Density is high and calm: one block per screen, ruled in 1px hairlines, with nothing that glows, floats, or bounces.

Motion has one grammar: a key drops into its detent along a single damped axis with no overshoot. That drop is the only orchestrated motion. It runs in date order, across the year cut, every time a borrowed card is set in the block: each key falls 120% of its height into its detent over 400ms, one 55ms step after the key before it, so nine keys are seated in 840ms. The easing is a critically damped spring written as `linear()` that never passes 1, and the detent clips the key, so nothing fades. A returned card's keys are already seated and don't drop. Under reduced motion the keys are simply in place.

**Key Characteristics:**

- One rail per block, one vermilion key per borrow.
- Proof-gray ground, white block, iron-black ink, one rubric.
- One reversed black plate per screen, for the number that matters.
- Square corners and 1px hairlines; no shadows and no radius.
- Standard controls in the world's type, never a costume of a printed page.

## Colors

Two inks on proof gray: iron black does the work, and rubric vermilion marks only the borrows.

### Primary colors

- **Rubric Vermilion** (#B42D16): the rail's keys and the key letters in the margin list. It meets 5.3:1 on proof gray and 6.3:1 on white.

### Neutral colors

- **Proof Gray** (#E8EBED): the page ground, the margin, and the rail's recessed bar.
- **Block White** (#FFFFFF): the block that holds the work, the answer box, the current margin key, and the retry button.
- **Iron Black** (#1A1A1A): text, hairlines, the reversed plate, and the primary button.
- **Rule Gray** (#C3C8CC): the rules between rows inside the block, and the pressed fill of the retry button and margin keys.
- **Hover Gray** (#D5D9DC): the instant hover fill of the retry button and margin keys.
- **Disabled Gray** (#606263): disabled text and dotted frames, placeholders, and the locked answer's frame; 5.1:1 on proof gray.
- **Pressed Iron** (#373839): the pressed primary button.

### Color rules

**The One Rubric Rule.** Vermilion appears only on the rail's keys and the margin's key letters. On a heading, a border, a background, or a state, it's wrong.

**The One Ramp Rule.** Every neutral comes from one fixed ramp between Proof Gray and Iron Black, stepped in OKLab: Proof Gray, Hover Gray, Rule Gray, Disabled Gray, Pressed Iron, Iron Black. No one-off grays.

**The No New Ink Rule.** States add no color: a returned card's margin key is struck through in iron black, and a failed rep's verdict frame goes from 1px to 3px iron black.

## Typography

**Body and UI font:** Hanken Grotesk (with sans-serif), self-hosted as the roman and italic variable faces under the OFL.
**Apparatus:** tracked capitals in Hanken Grotesk. It has no true small caps (`smcp`), and at 15px the capitals' height matches the 20px body's x-height, so they read as small caps without a second family.

**Character:** a plain, sturdy grotesk standing in for the edition's text serif, so the page reads as a reference work without reading as a bookish default. Figures are tabular wherever a date or count appears, and your own phrasings are set in the italic.

### Type hierarchy

- **Display** (900, 54px, 1.0, −0.02em): the skill name or heading at the head of the block; 40px on narrow screens.
- **Count** (900, 150px, 0.85, −0.02em): the number on the reversed plate, and nowhere else.
- **Headline** (500, 24px, 1.4): the rep's problem.
- **Title** (800, 20px, 1.2): the headings of the lesson, the problem, and the verdict.
- **Body** (400, 20px, 1.5): prose, captions, and the answer box, capped at 60ch. In the rail rows the line height is 1.25, so nine rows fit the 1080 frame.
- **Label** (600–800, 16–18px): navigation, buttons, the margin list, the plate's caption, the demo-data label, and the privacy line. Key letters are single capitals at 18px, weight 800.
- **Apparatus** (700, 15px, +0.08em, uppercase): margin headings only. Margin notes stay in sentence case at the 16px label size.

### Type rules

**The 1080p Floor Rule.** In the demo video's 1080p frame, body text renders at 20px or more and labels and apparatus at 14px or more; size the CSS for the viewport the video records. Judges may only see the video, and one builder's rule for product videos is "body text ≥ 20px at 1080p" ([@elie2222][x-video]). The sketch's 13px and 17px sizes fall below it and don't carry over.

**The No Display Face Rule.** No display face beyond the text family, and no monospace. Apparatus stays in tracked capitals of the same family.

[x-video]: https://x.com/elie2222/status/2107186094777434454

## Layout

The block holds its measure and the margin absorbs the width: two short columns of equal measure (520px, about 52 characters) around a 72px rail, inside 40px of padding, which makes the block 1194px. Extra desktop width goes to the margins in a 5:3 split, never to the line length: the wide left margin carries the keys, notes, and the privacy line at its foot, and the narrower right margin holds the plate. The block sits 32px below the navigation. Space steps are 4, 8, 12, 16, 24, 32, and 40px, and rail rows are padded 9px top and bottom.

The cold rep keeps the same two columns either side of a centre hairline: the verdict and lesson on the left, the problem and answer box on the right. After a pass, "Back to the stack" sits under the Returned verdict in the left column, so it stays in the frame however long the locked answer runs.

At 67.5rem (1080px) and below there's one column, with the margin above the block, 16px of page padding, and 16px of block padding. The rail moves outboard to the text's left edge as the same gray bar, each key spanning its phrasing and the date under it; it never becomes a colored edge stripe. The plate goes in flow with 24px above it, hanging 12px past the block's right edge.

**The Rows Stack Rule.** A row's actions and its notice never scroll out of a narrow screen; a wide list stacks its cells. A projects table that scrolled sideways inside its hairlines, hiding Rename and Delete and clipping its delete confirmation at 390px, was the mistake.

**The Rail's Columns Rule.** Every section below a card sits on the rail's columns: its heading and each item's title on the left, set against the centre, and their words on the right. Landing sections with headings across the block and prose running across the centre, out of the rail's columns, were the mistake.

**The Narrow Wins Rule.** On a narrow screen every heading and title sits flush left with its words, and the narrow rule must outrank the desktop one. Section headings stuck right-aligned on a narrow screen, because the desktop rule's selector outranked the narrow one, were the mistake.

## Elevation & Depth

The system is flat. Nothing has a shadow; depth comes from 1px hairlines, from the rail's bar recessed in proof gray, and from one reversed plate that hangs over the block's edge. That overlap is the only place one surface sits on another, and it overlaps only 32px of the block's 40px padding, never a stamp or the rep's problem.

**The Reversed Plate Rule.** One element per screen sits on a black plate with white type: the number that matters most on that screen. A second plate means the first one isn't the point.

**The Plate Counts Rule.** A plate holds a count from the library, never a status code or a label. A "404" plate on the not-found page, which counted nothing and ran past the outer margin, was the mistake.

**The Plate Holds Rule.** Every state of a screen keeps its one plate, inside the block's padding: waiting and error too. A plate that drops out of a short state, or hangs past the block's foot, is wrong.

## Shapes

Square everywhere: no radius on blocks, buttons, inputs, plates, or keys. Keys are small vermilion squares (22px) seated in square detents (30px) along the rail's bar. Frames are 1px iron-black rules; heavier rules carry meaning, at one 3px weight: a failed verdict's frame, a returned rail's end rule, and the head rule of a notice (an error, or a delete confirmation). Control states use the world's printed marks: square brackets for focus, a fill one ramp step down for pressed, and a dotted frame for disabled or locked. None reuses the 2px strike that marks a returned card.

**The One Bar Rule.** Each year's rail is one continuous gray bar between two iron hairlines, and a key has no cell or frame of its own. Keys in separate gray cells read as a column of checkboxes.

## Components

Standard controls, set in the world's type and printed marks. Hover fills are instant, with no transition.

### Buttons

- **Shape:** square (0px), with a 1px iron frame.
- **Primary:** iron-black fill, white label at 18px weight 800, padded 14px by 24px. Pressed fills Pressed Iron.
- **Retry and secondary:** the same shape outlined, white fill and iron label; it fills Hover Gray on hover and Rule Gray when pressed. The secondary is the safe choice beside a primary one, such as "Keep it" beside a delete.
- **Quiet:** a row's or the navigation's action, such as Rename or Delete in a list: no frame, an underlined label at 18px weight 700, filled Hover Gray on hover and Rule Gray with an iron frame when pressed.
- **Links styled as buttons** take the primary or secondary look, for an action that goes somewhere, such as "Upload a chat export" or "Open key A".
- **Focus:** printed square brackets, 2px iron, standing 8px outside each side and 6px above and below; anything that isn't a button gets a 2px iron outline offset 3px.
- **Disabled:** the frame drops to a dotted Disabled Gray rule, the fill lifts, and the label goes Disabled Gray.

**The Pressed Link Rule.** A link drawn as the primary button fills Pressed Iron when pressed, as a button does. "Open key A" as a link that stayed iron black under the pointer while pressed, because its hover rule outranked the press, was the mistake.

### Navigation

The web's standard top bar on proof gray, 60px tall, closed by an iron hairline. The product name is 20px weight 900 and leads home. The app's places (Dashboard, Projects, Settings) are cells at 18px weight 700 that run the bar's full height; the current one fills Block White from the bar's top to its hairline and goes to weight 800, like the current margin key, and the others fill Hover Gray on hover. The learner's name (weight 600) and Log out, a cell too, sit at the far right. A cell's focus is the 2px iron rule set 4px inside it, so it stays within the bar. A public page's bar carries Docs, then Log in as a cell and Sign up as a compact primary button; on the log-in or sign-up page, that page's own item is the current cell. On narrow screens the bar wraps.

**The Full Cell Rule.** A navigation cell runs the bar's full height, so the current page fills it edge to edge, like a current key. Cells floating as short white tabs inside the bar were the mistake.

The demo-data label is a 1px iron frame at 16px weight 700 that sits beside a demo project's name, in its heading and in its row, wherever it shows.

### Links

Underlined iron, 1px, offset 0.2em, filled Hover Gray on hover, instantly.

### Margin keys

Full-width rows between iron hairlines: the vermilion key letter, the skill, and its count right-aligned in tabular figures. The current key fills Block White and goes to weight 800; others fill Hover Gray on hover and Rule Gray when pressed. A returned key is struck through with a 2px iron line; a key borrowed again isn't struck, and says "Borrowed again" under its skill at weight 500. The margin heading above them is in apparatus capitals, and when a card's borrows span more than one year the margin carries the note "A cut in the rail marks a new year of asking."

On a project's page the margin opens with the project's name at 20px weight 800, beside its demo-data label, then the way to its views (Cards, Unsorted phrasings, Upload history, and Upload a chat export) as underlined notes, the view on screen at weight 800 without its underline, then the keys. The block holds the chosen card, or one view's list in rows under the project's plate of cards. A card borrowed again closes its rail with the line "Returned <date>, then borrowed again." and its keys drop again.

### The rail

One rail per year of borrows, each opening on an iron hairline. Each row sets the phrasing right-aligned in italic, the key in the bar, and the date in tabular figures, with Rule Gray rules between rows. The bar is Proof Gray between two iron hairlines, closed at its foot; the 12px gap between rails is the year cut. The detent has no fill or frame and only clips the key's drop. A returned card's rail closes with a 3px iron end rule carrying "Returned" and the date.

### The reversed plate

An iron-black plate, at least 14rem wide, with the count at 150px over a balanced white caption at 18px weight 600. On desktop it hangs from the block's top padding, overlapping only the padding and standing outboard into the right margin. A short block (waiting, error) has a 19.5rem minimum height, so it holds the whole plate.

### Verdicts

A framed note at the head of the rep's left column: 1px iron for Returned, with a framed "Stamped returned" date stamp at 16px weight 700; 3px iron for Still borrowed. The lesson and the problem open on an iron hairline instead of a frame.

### The answer box

A square textarea with a 1px iron frame, white fill, body type, a 152px minimum height, and Disabled Gray placeholder. While locked (read-only or disabled), its words stay readable and its frame drops to a dotted Disabled Gray rule; it grows to fit its text up to 13 whole lines, then scrolls, so the 1080 frame never cuts a line.

### Waits and errors

A waiting line opens with a short piece of rail, the same gray bar empty of keys, with the line beside it at weight 500. An error is a notice: a 1px iron frame with a 3px head rule, so it can't be mistaken for a disabled control, followed by an outlined retry. A form's notice sits above its button (under it, when the field and button share a line), and the button locks while the form is sent.

### Form fields

A label at 18px weight 700 over a square box: a 1px iron frame, white fill, body type at 20px, 12px by 16px of padding, one column (520px) wide, with Disabled Gray placeholders. A hint sits under the box at 16px weight 500, and the box is described by it. When a failure's message names one field, that field's frame goes to 3px iron, it's described by the notice too, and it takes focus; a message that names several, such as "Wrong email or password.", marks none. A locked box keeps its words in iron and drops its frame to a dotted Disabled Gray rule. Fields stack one under another with 24px between them; a single field and its button can share one line, the button seated on the field's foot. The browser's autofill tint is held off, so a saved password brings no new ink.

### Rows

A list is a table set between two iron hairlines: a header row in 16px weight 700 closed by a hairline, then rows in body type at the rail rows' leading and padding, with Rule Gray between them. Words sit flush with the block's heading; counts and dates are right-aligned in tabular figures; quiet actions close each row. A row can open a full-width row under it, such as its delete confirmation. On a narrow screen the header row goes and each row stacks: its title, a line of its counts each led by its column's name at 16px weight 600, then its actions and any notice at the screen's width.

### Empty states

A section that opens on an iron hairline, like the lesson and the problem: a 20px weight 800 title that names what isn't here yet, one sentence on how it gets here, and the action that leads there.

### The delete confirmation

A notice in place, never a modal: the error's frame with its 3px head rule, on white, under the row it deletes. It asks "Delete Work?", names everything that goes and that it can't be undone, and offers the delete as a primary button named for what it deletes, then "Keep it", outlined, which takes focus first; Escape keeps it too. Nothing turns red.

### Wells: the drop zone and code blocks

A well is recessed proof gray inside the white block, framed by a 1px iron rule, like the rail's bar. The drop zone is a 240px well with its title at 20px weight 800, a line on what it takes, and a "Choose a file" control drawn as an outlined button; a file held over it fills it Hover Gray, and it takes the focus rule from the keyboard. A code block is a well holding a setup snippet in Hanken Grotesk at 20px (the world has no monospace), scrolling sideways inside itself, under a 18px weight 700 caption with an outlined Copy button that says "Copied" for two seconds.

### The landing page

The landing page sets one real card and the sections after it in the block, with their apparatus in the margin.

- **The head:** the pitch at display size across the block, then the lede at weight 500 in the left column and Sign up in the right, seated on the lede's first line.
- **The card:** card A of the demo export, with the card stack's rail markup. It opens on an iron hairline 24px below the pitch, with 16px of padding, so its whole rail closes inside the 1080 frame. Its name is 40px weight 900 beside the demo-data label, over its borrow line at weight 500; the rails start 16px below, 12px apart at the year cut. The plate hangs over the block's right edge level with the card's name, overlapping only the padding. On a narrow screen the plate goes in flow with 24px above it, hanging 12px past the block's right edge.
- **Sections:** each opens on an iron hairline, 40px below the last, with 24px of padding, set on the rail's columns. The heading (40px weight 900) and each item's title (20px weight 800) sit right-aligned against the centre on the left, facing their words on the right; items are padded 16px, with Rule Gray between rows. What leaves the computer is said once, at the headline size. On a narrow screen there's one column, with everything flush left.
- **Side-notes:** margin notes in sentence case, as the margin sets them. Each hangs into the margin column level with the section it annotates, starting at the section's padding. On a narrow screen it goes in flow under its section: 16px under the card's rail, and one 24px row gap under a section.

**The Clear Notes Rule.** A side-note is placed absolutely and pushes nothing, so each must end above the next one at every desktop width, down to the 16rem margin at 1440. Side-notes about to collide where the margin narrows to 16rem at 1440 were the mistake.

**The Phrasings First Rule.** On a narrow screen the card's phrasings come before its side-note. A narrow card that put its explanation before its phrasings was the mistake.

## Do's and Don'ts

These hold for every screen. The ones from X cite the post they came from; the rest come from the user's answers in the direction workshop, [the scope's voice](/devpost/scope.md#inspiration--identity), and [the PRD's look and feel](/devpost/prd.md#look-and-feel).

### Design do's

- **Do** build from the chosen sketch and the world's [quality-bar board][board], not from adjectives; a builder's advice for avoiding the model's default look is "Steal a reference, don't describe one" ([@ArchiveExplorer][x-ref]).
- **Do** keep to three signature elements: the rail, the reversed plate, and the hairlines. One designer's checklist for distinctive AI-built UI says "1–3 strong custom elements beat 20 random assets" ([@Hartdrawss][x-mood]).
- **Do** take texture only from the real object, the ruling engine's hairlines. One post calls the skeuomorphism revival "already as obnoxious and overplayed" ([@PalmyrPar][x-revival]), and a reply says "we don't need AI to give a UI a paper texture and a fun font" ([@Mirteaaa][x-costume]).
- **Do** keep the reversed plate's number readable at thumbnail size, and let motion settle before the next interaction, so a recording never shows half-moved state.

[board]: https://impeccable.style/worlds/cards/rw-centre-rail-reference-setting.webp
[x-mood]: https://x.com/Hartdrawss/status/2027768326852681798
[x-revival]: https://x.com/PalmyrPar/status/2018395048878936451
[x-costume]: https://x.com/Mirteaaa/status/2066932459632017499

### Design don'ts

- **Don't** use a warm cream ground or a serif display face; together they're the bookish default the user ruled out.
- **Don't** make it feel like an app kit: no rounded cards, soft shadows, toasts, or progress bars. The user ruled these out too.
- **Don't** use the tells from a widely shared list of reasons a site "looks vibe-coded": Inter, Geist, or Space Grotesk; Lucide icons; emoji; sparkle icons; bento grids; dot grids; a colored left stripe; soft corner radius; hover animations ([@suraj_sharma14][x-vibe]).
- **Don't** fade or slide sections in on load, and don't stagger reveals; "everything fading in" is the model's default look ([@ArchiveExplorer][x-ref]), even though a widely shared aesthetics prompt recommends staggered reveals ([@vincenteliezer][x-stagger]). The rail's key drop is the only orchestrated motion.
- **Don't** add purple gradients, all-caps eyebrow labels above headings, or "→" on buttons ([the PRD's Avoid list](/devpost/prd.md#look-and-feel)). Apparatus lives in the margin, never as an eyebrow.
- **Don't** draw streaks, flames, badges, scores, or charts. [The PRD's Avoid list](/devpost/prd.md#look-and-feel) rules out streaks, badges, scores, and charts, and one critique says Duolingo "monetizes guilt through streaks, badges & reminders" ([@StockSavvyShay][x-guilt]).

[x-vibe]: https://x.com/suraj_sharma14/status/2102254059151565233
[x-stagger]: https://x.com/vincenteliezer/status/1991480152585347102
[x-guilt]: https://x.com/StockSavvyShay/status/2014690330952806725

## See also

- [Card stack surface brief](/.impeccable/surfaces/apps-src-index-tsx.md), with the direction contract
- [App shell surface brief](/.impeccable/surfaces/src-app-main-ts.md), with the shell's direction contract
- [Landing page surface brief](/.impeccable/surfaces/src-pages-landing-ts.md), with the landing page's direction contract
- [Chosen card stack sketch](/.impeccable/mocks/decision/r2-lead.html) and its [Centre Rail figure](/.impeccable/mocks/decision/r2-lead.png)
- [Asked Before scope](/devpost/scope.md)
- [Asked Before product requirements](/devpost/prd.md)
- [Asked Before technical spec, Look and Feel](/devpost/spec.md#look-and-feel)

[x-ref]: https://x.com/ArchiveExplorer/status/2105023417716191488
