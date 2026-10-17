// The frame every screen is set in: the margin's apparatus on the left and
// the block that holds the work, mounted into the emptied root, plus the
// pieces every screen's states share: the reversed plate, the waiting line,
// and the error notice with its retry.

import { button, el, type Child } from "./dom";
import { messageOf } from "./messages";

/** Mounts an `aside.margin` holding `margin` (notes in sentence case; an `h2` is set in apparatus capitals) and an empty `main.block`. */
export function frame(root: HTMLElement, margin: Child[] = []): { margin: HTMLElement; block: HTMLElement } {
  const aside = el("aside", "margin", ...margin);
  const block = el("main", "block");
  root.append(aside, block);
  return { margin: aside, block };
}

/** The reversed plate: the one number that matters on this screen, then what it counts. A block holds at most one. */
export function plate(count: number | string, caption: string): HTMLElement {
  return el("p", "plate", el("b", undefined, String(count)), " ", el("span", undefined, caption));
}

/** A waiting line, opening on a short piece of empty rail. Say what's happening in the library's words, ending with an ellipsis. */
export function waiting(line: string): HTMLElement {
  const node = el("p", "is-waiting", line);
  node.setAttribute("role", "status");
  return node;
}

/** An error notice. */
export function notice(message: string): HTMLElement {
  const node = el("p", "error", message);
  node.setAttribute("role", "alert");
  return node;
}

/** An error notice for a failure, and the outlined button that tries again. */
export function failure(error: unknown, onRetry: () => void): HTMLElement[] {
  return [notice(messageOf(error)), button("Try again", onRetry, "retry")];
}

/**
 * Fetches what a screen shows: a waiting line after `keep` (the heading and
 * the plate, which every state holds) while `request` runs, then `show` with
 * the result, or the error and a retry. Nothing is drawn once `signal` has
 * aborted, which the router does when the learner leaves the screen.
 */
export async function load<T>(
  block: HTMLElement,
  { keep = [], line, request, show, signal }: { keep?: Node[]; line: string; request: () => Promise<T>; show: (result: T) => void; signal: AbortSignal },
): Promise<void> {
  block.replaceChildren(...keep, waiting(line));
  try {
    const result = await request();
    if (!signal.aborted) show(result);
  } catch (error) {
    if (!signal.aborted) block.replaceChildren(...keep, ...failure(error, () => load(block, { keep, line, request, show, signal })));
  }
}
