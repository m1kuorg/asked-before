// A code block: a setup snippet in a recessed well, set in the text family
// (the world has no monospace), under a caption with its copy button.

import { button, el } from "./dom";

/** `caption` names the snippet, such as "Claude Code"; `code` is set as text, line breaks kept. */
export function codeBlock(caption: string, code: string): HTMLElement {
  const copy = button("Copy", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select it to copy";
    }
    setTimeout(() => (copy.textContent = "Copy"), 2000);
  }, "secondary");
  copy.setAttribute("aria-label", `Copy the ${caption} snippet`);
  copy.setAttribute("aria-live", "polite");
  return el("figure", "code-block", el("figcaption", undefined, el("span", undefined, caption), copy), el("pre", undefined, el("code", undefined, code)));
}
