// The delete confirmation: a notice in place, never a modal, framed like an
// error, that names what is deleted and everything that goes with it. Focus
// starts on the safe choice, Escape takes it, and the delete locks while it
// runs; a failure shows its message in the notice.

import { button, el, uniqueId } from "./dom";
import { notice } from "./frame";
import { messageOf } from "./messages";

export type ConfirmOptions = {
  /** The question, such as "Delete Work?". */
  title: string;
  /** Everything that goes, and that it can't be undone. */
  body: string;
  /** The delete button's words, such as "Delete Work". */
  action: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export function confirmDelete({ title, body, action, onConfirm, onCancel }: ConfirmOptions): HTMLElement {
  const heading = el("h2", undefined, title);
  heading.id = uniqueId("confirm");
  const keep = button("Keep it", onCancel, "secondary");
  const go = button(action, async () => {
    shown?.remove();
    go.disabled = keep.disabled = true;
    try {
      await onConfirm();
    } catch (error) {
      shown = notice(messageOf(error));
      node.append(shown);
      go.disabled = keep.disabled = false;
    }
  });
  let shown: HTMLElement | undefined;
  const node = el("div", "confirm", heading, el("p", undefined, body), el("div", "actions", go, keep));
  node.setAttribute("role", "group");
  node.setAttribute("aria-labelledby", heading.id);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !keep.disabled) onCancel();
  });
  // Once the caller has placed it, the safe choice takes focus.
  queueMicrotask(() => {
    if (keep.isConnected) keep.focus();
  });
  return node;
}
