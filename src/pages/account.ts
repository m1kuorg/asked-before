// What log in and sign up share: the block's two columns either side of a
// centre hairline, with the form on the left and the other way in on the
// right, and `next`, the app path to go back to afterwards, carried across.

import { createClient } from "@asked-before/sdk";
import { el, link } from "../parts/dom";
import { frame } from "../parts/frame";

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

export function mountAccountPage({ title, note, form, other }: AccountPage) {
  const root = document.querySelector<HTMLElement>("#app")!;
  const { block } = frame(root, [el("p", undefined, note)]);
  block.append(
    el(
      "div",
      "account-columns",
      el("div", undefined, el("h1", undefined, title), form),
      el("section", undefined, el("h2", undefined, other.heading), el("p", undefined, other.body), link(other.action, withNext(other.href), "button secondary")),
    ),
  );
  form.querySelector("input")?.focus();
}
