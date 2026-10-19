// The app's top navigation: the product name, Desk, Shelves, and
// Settings, with the current one filled white; then the account and Log out.
// The shared guest (m1kuorg/basics#73) has no Settings, and is named as the
// shared guest, with Sign up, which leads to an account of one's own.

import type { Account } from "@asked-before/sdk";
import { button, el, link } from "../parts/dom";
import { client } from "./client";
import type { Section } from "./router";

const PLACES: [Section, string, string][] = [
  ["desk", "Desk", "/app/desk"],
  ["shelves", "Shelves", "/app/shelves"],
  ["settings", "Settings", "/app/settings"],
];

export function mountNav(before: HTMLElement, account: Account) {
  const places = account.guest ? PLACES.filter(([section]) => section !== "settings") : PLACES;
  const links = places.map(([section, text, href]) => [section, link(text, href, "nav-item")] as const);
  const name = el("span", "nav-account", account.guest ? "Shared guest" : account.name);
  name.title = account.guest ? "Every guest shares this workspace, and it's wiped daily at midnight UTC." : account.email;
  const logOut = button(
    "Log out",
    async () => {
      logOut.disabled = true;
      try {
        await client.auth.logOut();
      } finally {
        location.assign("/login");
      }
    },
    "nav-item",
  );
  const nav = el(
    "nav",
    undefined,
    link("Asked Before", "/app/desk", "nav-name"),
    el("ul", undefined, ...links.map(([, a]) => el("li", undefined, a))),
    el("div", "nav-end", name, ...(account.guest ? [link("Sign up", "/signup", "button")] : []), logOut),
  );
  nav.setAttribute("aria-label", "Asked Before");
  before.before(nav);

  return {
    /** Marks the section the current screen belongs to. */
    setCurrent(current: Section | null) {
      for (const [section, a] of links) {
        if (section === current) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
    },
    setAccount(next: Account) {
      name.textContent = next.name;
      name.title = next.email;
    },
  };
}
