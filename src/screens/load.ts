// The Load screen, as a placeholder until m1kuorg/basics#26 lands: its inputs
// as plain text, with its controls.

import { PRIVACY_LINE } from "../main";
import type { LoadProps } from "../types";

export function mountLoad(root: HTMLElement, { state, onLoad, onRetry }: LoadProps) {
  if ("error" in state) {
    const error = document.createElement("p");
    error.className = "error";
    error.textContent = state.error;
    const retry = document.createElement("button");
    retry.className = "retry";
    retry.textContent = "Try again";
    retry.addEventListener("click", onRetry);
    root.append(error, retry);
    return;
  }

  const privacy = document.createElement("p");
  privacy.className = "privacy-line";
  privacy.textContent = PRIVACY_LINE;
  const count = document.createElement("p");
  count.textContent = `${state.messages.length} of your own messages are ready to send.`;
  const load = document.createElement("button");
  load.textContent = "Load the demo export";
  load.addEventListener("click", onLoad);
  root.append(privacy, count, load);
}
