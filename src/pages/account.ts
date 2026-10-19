// What log in and sign up share: the block's two columns either side of a
// centre hairline, with the form on the left and the other ways in on the
// right, signing in as a guest among them, and `next`, the app path to go
// back to afterwards, carried across. The landing page signs in as a guest
// with the same part.

import { createClient } from "@asked-before/sdk";
import { button, el, link } from "../parts/dom";
import { frame, notice } from "../parts/frame";
import { messageOf } from "../parts/messages";

/** The public pages' client: no session yet, so a 401 is an answer to show, not a reason to leave. */
export const client = createClient();

/** The app path the visitor was sent here from, if any; the server follows it only when it's inside the app. */
export const next = new URLSearchParams(location.search).get("next") ?? undefined;

/** A public page's address, carrying `next` along. */
export const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

export type AccountPage = {
  title: string;
  note: string;
  form: HTMLFormElement;
  other: { heading: string; body: string; action: string; href: string };
};

/** What signing in as a guest means, said wherever it's offered. */
export const GUEST_NOTE = "Every guest shares one workspace, with the demo shelf already sorted: guests see each other's uploads and cold reps, and it's wiped daily at midnight UTC.";

/**
 * "Sign in as a guest": the shared Guest account, with no password, then
 * `next` or the Desk. A failure, such as too many tries, shows as a notice
 * after it until it's pressed again.
 */
export function guestSignIn(): HTMLElement {
  let shown: HTMLElement | undefined;
  const action = button(
    "Sign in as a guest",
    async () => {
      action.disabled = true;
      shown?.remove();
      try {
        location.assign((await client.auth.signInAsGuest({ next })).next);
      } catch (error) {
        action.disabled = false;
        shown = notice(messageOf(error));
        action.after(shown);
      }
    },
    "secondary",
  );
  return action;
}

export function mountAccountPage({ title, note, form, other }: AccountPage) {
  const root = document.querySelector<HTMLElement>("#app")!;
  const { block } = frame(root, [el("p", undefined, note)]);
  block.append(
    el(
      "div",
      "account-columns",
      el("div", undefined, el("h1", undefined, title), form),
      el(
        "div",
        undefined,
        el("section", undefined, el("h2", undefined, other.heading), el("p", undefined, other.body), link(other.action, withNext(other.href), "button secondary")),
        el("section", undefined, el("h2", undefined, "Just looking?"), el("p", undefined, GUEST_NOTE), guestSignIn()),
      ),
    ),
  );
  form.querySelector("input")?.focus();
}
