// An app path no route matches: the not-found page's block, inside the app.

import type { ScreenProps } from "../app/router";
import { el, link } from "../parts/dom";
import { frame } from "../parts/frame";

export function mountNotFound(root: HTMLElement, _props: ScreenProps) {
  const { block } = frame(root);
  block.append(
    el("h1", undefined, "This page doesn't exist"),
    el("p", undefined, "Nothing is filed at this address. It may be mistyped, or the page may have moved."),
    el("p", undefined, link("Go to the Desk", "/app/desk")),
  );
}
