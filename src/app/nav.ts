// The app's top navigation: the product name, Dashboard, Projects, and
// Settings, with the current one filled white; then the account and Log out.

import type { Account } from "@asked-before/sdk";
import { button, el, link } from "../parts/dom";
import { client } from "./client";
import type { Section } from "./router";

const PLACES: [Section, string, string][] = [
  ["dashboard", "Dashboard", "/app"],
  ["projects", "Projects", "/app/projects"],
  ["settings", "Settings", "/app/settings"],
];

export function mountNav(before: HTMLElement, account: Account) {
  const links = PLACES.map(([section, text, href]) => [section, link(text, href, "nav-item")] as const);
  const name = el("span", "nav-account", account.name);
  name.title = account.email;
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
    link("Asked Before", "/app", "nav-name"),
    el("ul", undefined, ...links.map(([, a]) => el("li", undefined, a))),
    el("div", "nav-end", name, logOut),
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
