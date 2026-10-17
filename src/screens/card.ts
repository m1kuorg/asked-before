// One card and its cold rep: a placeholder until m1kuorg/basics#46 sets the
// card's borrows, its status, its earlier reps, and the rep here, keeping
// the proof of concept's look (public/styles/stack.css and rep.css).

import type { ScreenProps } from "../app/router";
import { el, link } from "../parts/dom";
import { frame } from "../parts/frame";

export function mountCard(root: HTMLElement, _props: ScreenProps<"cardId">) {
  const { block } = frame(root);
  block.append(
    el("h1", undefined, "Card"),
    el("p", undefined, "A card's borrows, its stamps, and its cold rep will be set out here."),
    el("p", undefined, link("Go to your projects", "/app/projects")),
  );
}
