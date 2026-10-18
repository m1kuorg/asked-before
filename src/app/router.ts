// The app's client-side routing. Each route maps a path under /app to the
// screen module that draws it; a screen mounts into the emptied root with
// typed props, and its stylesheet scopes itself under #app[data-screen].
// Links to app paths are followed without reloading, and back and forward
// redraw. Leaving a screen aborts its `signal`, so nothing it was still
// fetching draws over the next one.

import type { Account, Client } from "@asked-before/sdk";

/** The names of a path's `:params`, such as "shelfId" for "/app/shelves/:shelfId". */
export type Params<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type ScreenProps<P extends string = never> = {
  /** The path's params, decoded. */
  params: Record<P, string>;
  query: URLSearchParams;
  client: Client;
  /** Who is logged in. */
  account: Account;
  /** After the account changes (its name or email), so the navigation shows it. */
  setAccount: (account: Account) => void;
  /** Goes to another app path, as following a link would. */
  navigate: (path: string, options?: { replace?: boolean }) => void;
  /** Aborted when the learner leaves this screen. */
  signal: AbortSignal;
};

/** A screen draws itself into `root`, which the router has emptied. */
export type Screen<P extends string = never> = (root: HTMLElement, props: ScreenProps<P>) => void | Promise<void>;

/** The part of the navigation a route belongs to. */
export type Section = "desk" | "shelves" | "settings";

export type Route = {
  /** The screen's name, set as #app's data-screen. */
  name: string;
  path: string;
  section: Section | null;
  /** The page's title, before " · Asked Before". A screen may set a closer one itself. */
  title: string;
  screen: Screen<string>;
};

export const route = <P extends string>(name: string, path: P, section: Section | null, title: string, screen: Screen<Params<P>>): Route => ({
  name,
  path,
  section,
  title,
  screen: screen as Screen<string>,
});

export const isAppPath = (pathname: string) => pathname === "/app" || pathname.startsWith("/app/");

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function match(routes: Route[], pathname: string): { route: Route; params: Record<string, string> } | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  for (const route of routes) {
    const pattern = route.path.split("/");
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const fits = pattern.every((segment, i) => {
      if (segment.startsWith(":")) {
        // A malformed escape, such as a lone "%", matches nothing, so the address shows as not found.
        const value = safeDecode(parts[i]!);
        if (!value) return false;
        params[segment.slice(1)] = value;
        return true;
      }
      return segment === parts[i];
    });
    if (fits) return { route, params };
  }
  return null;
}

export type RouterOptions = {
  root: HTMLElement;
  routes: Route[];
  /** Drawn for any app path no route matches. */
  notFound: Route;
  client: Client;
  account: Account;
  /** Marks the current section in the navigation, and shows a changed account. */
  onShow: (section: Section | null) => void;
  onAccount: (account: Account) => void;
};

export function startRouter({ root, routes, notFound, client, account, onShow, onAccount }: RouterOptions): void {
  let leaving: AbortController | undefined;

  const navigate = (path: string, { replace = false } = {}) => {
    if (replace) history.replaceState(null, "", path);
    else history.pushState(null, "", path);
    show();
  };

  const setAccount = (next: Account) => {
    account = next;
    onAccount(next);
  };

  function show() {
    leaving?.abort();
    leaving = new AbortController();
    const found = match(routes, location.pathname);
    const { route, params } = found ?? { route: notFound, params: {} };
    root.replaceChildren();
    root.dataset.screen = route.name;
    document.title = `${route.title} · Asked Before`;
    onShow(route.section);
    window.scrollTo(0, 0);
    void route.screen(root, {
      params,
      query: new URLSearchParams(location.search),
      client,
      account,
      setAccount,
      navigate,
      signal: leaving.signal,
    });
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  addEventListener("popstate", show);
  show();
}
