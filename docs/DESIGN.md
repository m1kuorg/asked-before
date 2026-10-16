---
name: Asked Before
description: Your own phrasings and their dates, twinned around one vermilion rail with a key for every borrow.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Asked Before design

The visual world for Asked Before, chosen in [impeccable](/.claude/skills/impeccable/SKILL.md)'s direction workshop on October 16, 2026, with rules grounded in a search of X the same day. It's a seed: it commits the world and its rules, and the real tokens come from the first build. [PRODUCT.md](/docs/PRODUCT.md) owns what the product is, and the [card stack surface brief](/.impeccable/surfaces/apps-src-index-tsx.md) owns that screen's composition; this file is strictly visual. When a review catches a visual mistake, add a one-line Named Rule here.

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
1.  [Do's and Don'ts](#dos-and-donts)
    1.  [Design do's](#design-dos)
    1.  [Design don'ts](#design-donts)
1.  [See also](#see-also)

## Overview

**Creative North Star: "The Centre Rail"**

Every screen is set like a page of a wide-margin reference edition drawn by a ruling engine. A small, dense block holds the work; a wide margin around it carries the apparatus; and down the middle of the block runs one vermilion rail with a key on it for every borrow. Your own words sit on one side of the rail and what they point to sits on the other, so the keys show how often you asked before any number does.

The surface is for operating, not reading: navigation, buttons, and inputs stay the web's standard controls, and the world lends only type, palette, density, and the rail. The edition's bone stock and text serif are translated to proof gray and a grotesk, because a warm cream ground with a serif is the default look the user ruled out. Density is high and calm: one block per screen, ruled in 1px hairlines, with nothing that glows, floats, or bounces.

Motion has one grammar: a key drops into its detent along a single damped axis with no overshoot. That drop is the only orchestrated motion; when it runs, and whether keys drop together or in date order, is [to be resolved during implementation]. Under reduced motion the keys are simply in place.

**Key Characteristics:**

- One vermilion rail per block, one key per borrow.
- Proof-gray ground, white block, iron-black ink, one rubric.
- One reversed black plate per screen, for the number that matters.
- Square corners and 1px hairlines; no shadows and no radius.
- Standard controls in the world's type, never a costume of a printed page.

## Colors

Two inks on proof gray: iron black does the work, and rubric vermilion marks only the borrows.

### Primary colors

- **Rubric Vermilion** (#B42D16): the rail's keys and the key letters in the margin list. It meets 5.3:1 on proof gray and 6.3:1 on white.

### Neutral colors

- **Proof Gray** (#E8EBED): the page ground and the margin.
- **Block White** (#FFFFFF): the block that holds the work.
- **Iron Black** (#1A1A1A): text, hairlines, the reversed plate, and the primary button.
- **Rule Gray** (#C3C8CC): the rules between rows inside the block.
- Further neutral steps: [to be resolved during implementation], on one ramp from Proof Gray to Iron Black.

### Color rules

**The One Rubric Rule.** Vermilion appears only on the rail's keys and the margin's key letters. On a heading, a border, a background, or a state, it's wrong.

**The One Ramp Rule.** Every neutral comes from one fixed ramp between Proof Gray and Iron Black. No one-off grays.

**The No New Ink Rule.** States add no color: a returned card's margin key is struck through in iron black. How a failed rep shows within the two inks is [to be resolved during implementation].

## Typography

**Body and UI font:** Hanken Grotesk (with sans-serif)
**Apparatus:** [to be resolved during implementation]. Hanken Grotesk has no true small caps (`smcp`), so the choice is tracked capitals in Hanken Grotesk or a second family with real small caps.

**Character:** a plain, sturdy grotesk standing in for the edition's text serif, so the page reads as a reference work without reading as a bookish default. Figures are tabular wherever a date or count appears.

### Type hierarchy

- **Display** (900, 54px, 1.0, −0.02em): the heading at the head of the block.
- **Count** (900, 150px, 0.85): the number on the reversed plate, and nowhere else.
- **Body** (400, at least 20px, line height [to be resolved during implementation]): your words, dates, and prose. The chosen sketch set 17px; the floor below raises it.
- **Label** (600–800, 14–18px): navigation, buttons, the margin list, the demo-data label, and the privacy line.
- **Apparatus** (at least 14px): margin notes and key letters, in the face and tracking chosen above.

### Type rules

**The 1080p Floor Rule.** In the demo video's 1080p frame, body text renders at 20px or more and labels and apparatus at 14px or more; size the CSS for the viewport the video records. Judges may only see the video, and one builder's rule for product videos is "body text ≥ 20px at 1080p" ([@elie2222][x-video]). The sketch's 13px and 17px sizes fall below it and don't carry over.

**The No Display Face Rule.** No display face beyond the text family, and no monospace. Apparatus may add one small-caps family if the decision above needs it.

[x-video]: https://x.com/elie2222/status/2107186094777434454

## Layout

The block holds its measure and the margin absorbs the width: two short columns of equal measure around a narrow rail, with extra desktop width going to the margins, never to the line length. The exact measure and the spacing scale are [to be resolved during implementation]. The top navigation is the standard one, with the demo-data label always visible while the demo export is loaded.

On narrow screens, where the rail goes is [to be resolved during implementation]; it must not become a colored edge stripe.

## Elevation & Depth

The system is flat. Nothing has a shadow; depth comes from 1px hairlines and from one reversed plate that hangs over the block's edge. That overlap is the only place one surface sits on another.

**The Reversed Plate Rule.** One element per screen sits on a black plate with white type: the number that matters most on that screen. A second plate means the first one isn't the point.

## Shapes

Square everywhere: no radius on blocks, buttons, inputs, or keys. Keys are small vermilion squares seated in square detents cut into the rail. Frames are 1px iron-black rules. Control states (focus, pressed, disabled) are [to be resolved during implementation] in the world's printed marks, such as brackets and fills, and must not reuse the strike that marks a returned card.

## Do's and Don'ts

These hold for every screen. The ones from X cite the post they came from; the rest come from the user's answers in the direction workshop, [PRODUCT.md](/docs/PRODUCT.md#asked-before-voice), and [CONTEXT.md](/docs/CONTEXT.md#avoid-the-generic-ai-look).

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
- **Don't** add purple gradients, all-caps eyebrow labels above headings, or "→" on buttons ([CONTEXT.md](/docs/CONTEXT.md#avoid-the-generic-ai-look)). Apparatus lives in the margin, never as an eyebrow.
- **Don't** draw streaks, flames, badges, scores, or charts. [PRODUCT.md](/docs/PRODUCT.md#asked-before-voice) rules them out, and one critique says Duolingo "monetizes guilt through streaks, badges & reminders" ([@StockSavvyShay][x-guilt]).

[x-vibe]: https://x.com/suraj_sharma14/status/2102254059151565233
[x-stagger]: https://x.com/vincenteliezer/status/1991480152585347102
[x-guilt]: https://x.com/StockSavvyShay/status/2014690330952806725

## See also

- [Card stack surface brief](/.impeccable/surfaces/apps-src-index-tsx.md), with the direction contract
- [Chosen card stack sketch](/.impeccable/mocks/decision/r2-lead.html) and its [Centre Rail figure](/.impeccable/mocks/decision/r2-lead.png)
- [Asked Before product](/docs/PRODUCT.md)
- [Asked Before product requirements](/docs/PRD.md)
- [Hackathon context](/docs/CONTEXT.md)

[x-ref]: https://x.com/ArchiveExplorer/status/2105023417716191488
