// The Load screen. Before anything is sent, it says how many of your own
// messages the demo export holds and that only those go to the model, with the
// one load action. If the export can't be read, it shows the parser's error and
// a retry instead, never a count.

import { PRIVACY_LINE } from "../main";
import type { LoadProps } from "../types";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function button(text: string, onClick: () => void, className = "") {
  const node = element("button", className, text);
  node.addEventListener("click", onClick);
  return node;
}

export function mountLoad(root: HTMLElement, { state, onLoad, onRetry }: LoadProps) {
  if ("error" in state) {
    const error = element("p", "error", state.error);
    error.setAttribute("role", "alert");
    root.append(
      element(
        "section",
        "block",
        element("h1", "", "The chat export can't be read"),
        error,
        element("p", "", "Nothing was sent to the model."),
        button("Read it again", onRetry, "retry"),
      ),
    );
    return;
  }

  root.append(
    element(
      "section",
      "block",
      element("h1", "", "The demo chat export"),
      element("p", "plate", element("b", "", String(state.messages.length)), " ", element("span", "", "of your own messages")),
      element("p", "", "Loading it sorts your messages into cards, one for each question you asked more than once."),
      element("p", "privacy-line", PRIVACY_LINE),
      button("Load the demo export", onLoad),
    ),
  );
}
