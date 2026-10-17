// An empty state: a section that opens on an iron hairline, names what isn't
// here yet, says how it gets here, and leads there.

import { el, type Child } from "./dom";

export function emptyState(title: string, body: string, ...actions: Child[]): HTMLElement {
  const section = el("section", "empty", el("h2", undefined, title), el("p", undefined, body));
  if (actions.length) section.append(el("div", "actions", ...actions));
  return section;
}
