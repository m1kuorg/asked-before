// The app's client routing, under /app only (brief section 4; inventory.md,
// "Router behaviour"). Trailing slashes are ignored, and a malformed %
// escape in a :param matches nothing, so it shows not-found. Same-origin
// links to /app paths are followed without a reload (not with a modifier
// key, another button, target, or download), and back and forward redraw.
// Each path (pathname and query) mounts its screen afresh, with an
// AbortSignal aborted when it's left; the title becomes "<screen> · Asked
// Before" (a screen may name itself with setTitle), the page scrolls to the
// top, and focus moves to the new h1, or to the screen's view heading when
// only the query changed (another view of a shelf). A link that only changes
// the hash, such as "Skip to content", is left to the browser. A route's
// `local` query params (the shelf's ?status=) are the screen's own: changing
// one redraws the screen with the new query, but doesn't remount it, scroll,
// or move focus. A screen whose main resource answers 404 calls notFound()
// while rendering, and shows the not-found screen. Card, Settings, Upload,
// Search, Analysis, Roadmap, Connect your AI, and Playground come in chunks
// of their own (later()), fetched as the app starts.

import type { Account, Client } from "@asked-before/sdk";
import { Component, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { ErrorNotice } from "@/components/error-notice";
import { Home } from "@/screens/home";
import { NotFound } from "@/screens/not-found";
import { Shelf } from "@/screens/shelf";
import { Shelves } from "@/screens/shelves";

/** The names of a path's :params, such as "shelfId" for "/app/shelves/:shelfId". */
type Params<P extends string> = P extends `${string}:${infer Name}/${infer Rest}` ? Name | Params<`/${Rest}`> : P extends `${string}:${infer Name}` ? Name : never;

export type ScreenProps<P extends string = never> = {
  /** The path's params, decoded. */
  params: Record<P, string>;
  query: URLSearchParams;
  client: Client;
  /** Who is logged in. */
  account: Account;
  /** After a profile save, so the shell shows the new name. */
  setAccount: (account: Account) => void;
  /** Goes to another app path, as following a link would; `replace` leaves no history entry. */
  navigate: (path: string, options?: { replace?: boolean }) => void;
  /** Names the screen once its data is here, such as the shelf's name: the tab title and the phone's top bar. */
  setTitle: (title: string) => void;
  /** Aborted when the learner leaves this screen. */
  signal: AbortSignal;
};

/** The part of the sidebar a route belongs to. */
export type Section = "home" | "search" | "analysis" | "roadmap" | "shelves" | "connect" | "playground" | "settings";

/** `local`: query params the screen changes in place, which don't make it a new screen. */
export type Route = { name: string; path: string; section: Section | null; title: string; screen: ComponentType<ScreenProps<string>>; local: string[] };

const route = <P extends string>(name: string, path: P, section: Section | null, title: string, screen: ComponentType<ScreenProps<Params<P>>>, local: string[] = []): Route => ({
  name,
  path,
  section,
  title,
  screen: screen as unknown as ComponentType<ScreenProps<string>>,
  local,
});

/** What takes focus once the new screen draws it: its h1, or its view heading after a change of query alone. */
let focusDue: "heading" | "view" | null = null;

/** Moves focus as the last route change asked, if the screen has drawn its target yet. */
function focusScreen(): void {
  if (!focusDue) return;
  const target = (focusDue === "view" && document.querySelector<HTMLElement>("main [data-view-heading]")) || document.querySelector<HTMLElement>("main h1");
  if (!target) return;
  focusDue = null;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

const preloads: (() => void)[] = [];

/** Starts fetching every screen that comes in a chunk of its own, so a visit to one draws at once. */
export const preloadScreens = () => preloads.forEach((preload) => preload());

/**
 * A screen in a chunk of its own, so the app's first chunk is smaller. Until
 * the chunk is here, the screen suspends (main.tsx draws a skeleton in its
 * place), then it takes the focus a route change left waiting for it. If the
 * chunk can't be fetched, the screen says so, and "Try again" reloads the page.
 */
function later<P extends string>(title: string, load: () => Promise<ComponentType<ScreenProps<P>>>) {
  type Loaded = { screen: ComponentType<ScreenProps<P>> } | { error: unknown };
  let loaded: Loaded | null = null;
  let loading: Promise<Loaded> | null = null;
  // A chunk that failed stays failed until the page reloads, as the browser's own module map keeps it.
  const fetch = () => (loading ??= load().then((screen) => (loaded = { screen }), (error: unknown) => ({ error })));
  preloads.push(() => void fetch());

  function Later(props: ScreenProps<P>) {
    const done = loaded ?? use(fetch());
    useLayoutEffect(focusScreen, []);
    if ("error" in done) {
      return (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <ErrorNotice error={done.error} title="This page didn't load." onRetry={() => location.reload()} />
        </div>
      );
    }
    const Screen = done.screen;
    return <Screen {...props} />;
  }
  return Later;
}

const Card = later("Card", () => import("@/screens/card").then((module) => module.Card));
const SettingsAccount = later("Account", () => import("@/screens/settings").then((module) => module.SettingsAccount));
const SettingsKeys = later("API keys", () => import("@/screens/settings").then((module) => module.SettingsKeys));
const SettingsData = later("Your data", () => import("@/screens/settings").then((module) => module.SettingsData));
const Connect = later("Connect your AI", () => import("@/screens/connect").then((module) => module.Connect));
const Playground = later("Playground", () => import("@/screens/playground").then((module) => module.Playground));
const Upload = later("Upload a chat export", () => import("@/screens/upload").then((module) => module.Upload));
const Search = later("Search", () => import("@/screens/search").then((module) => module.Search));
const Analysis = later("Analysis", () => import("@/screens/analysis").then((module) => module.Analysis));
const Roadmap = later("Roadmap", () => import("@/screens/roadmap").then((module) => module.Roadmap));

const ROUTES = [
  route("home", "/app", "home", "Home", Home),
  route("home", "/app/desk", "home", "Home", Home),
  route("search", "/app/search", "search", "Search", Search, ["q"]),
  route("analysis", "/app/analysis", "analysis", "Analysis", Analysis, ["shelf"]),
  route("roadmap", "/app/roadmap", "roadmap", "Roadmap", Roadmap),
  route("shelves", "/app/shelves", "shelves", "Shelves", Shelves),
  route("shelf", "/app/shelves/:shelfId", "shelves", "Shelf", Shelf, ["status"]),
  route("upload", "/app/shelves/:shelfId/upload", "shelves", "Upload a chat export", Upload),
  route("card", "/app/cards/:cardId", "shelves", "Card", Card),
  route("connect", "/app/connect", "connect", "Connect your AI", Connect),
  route("playground", "/app/playground", "playground", "Playground", Playground, ["endpoint"]),
  route("settings", "/app/settings", "settings", "Account", SettingsAccount),
  route("settings-keys", "/app/settings/keys", "settings", "API keys", SettingsKeys),
  route("settings-data", "/app/settings/data", "settings", "Your data", SettingsData),
];
const NOT_FOUND = route("not-found", "/app/*", null, "Page not found", NotFound);

function match(pathname: string): { route: Route; params: Record<string, string> } {
  const parts = pathname.replace(/\/+$/, "").split("/");
  for (const candidate of ROUTES) {
    const pattern = candidate.path.split("/");
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const fits = pattern.every((segment, i) => {
      if (!segment.startsWith(":")) return segment === parts[i];
      try {
        params[segment.slice(1)] = decodeURIComponent(parts[i]!);
        return true;
      } catch {
        return false;
      }
    });
    if (fits) return { route: candidate, params };
  }
  return { route: NOT_FOUND, params: {} };
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    removeEventListener("popstate", listener);
  };
}
const here = () => location.pathname + location.search;

/** Goes to an app path without reloading, as a link would. */
export function navigate(path: string, { replace = false } = {}): void {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  for (const listener of listeners) listener();
}

const isAppPath = (pathname: string) => pathname === "/app" || pathname.startsWith("/app/");

function followLink(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
  // Only the hash changes ("Skip to content"): the browser scrolls there and moves focus itself.
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
}

/** The path without the route's local params: what tells one screen from the next. */
function screenKey(url: URL, route: Route): string {
  if (!route.local.length) return url.pathname + url.search;
  const query = new URLSearchParams(url.search);
  for (const name of route.local) query.delete(name);
  return url.pathname + (query.size ? `?${query}` : "");
}

/** The current route, its params and query, the screen's signal, and its title. `key` is the path, less the route's local params: a new one mounts a new screen. */
export function useRouter() {
  const href = useSyncExternalStore(subscribe, here);
  const url = new URL(href, location.origin);
  const { route, params } = useMemo(() => match(url.pathname), [url.pathname]);
  const query = useMemo(() => new URLSearchParams(url.search), [url.search]);
  const key = screenKey(url, route);
  const leaving = useRef<AbortController>(undefined);
  const controller = useMemo(() => {
    leaving.current?.abort();
    return (leaving.current = new AbortController());
  }, [key]);
  const [named, setNamed] = useState<{ key: string; title: string } | null>(null);
  const title = named?.key === key ? named.title : route.title;
  const setTitle = useCallback((next: string) => setNamed({ key, title: next }), [key]);

  useEffect(() => {
    document.addEventListener("click", followLink);
    return () => document.removeEventListener("click", followLink);
  }, []);
  useEffect(() => {
    document.title = `${title} · Asked Before`;
  }, [title]);
  // On the first draw focus stays at the top of the page; after that it moves to the new screen.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const pathname = new URL(key, location.origin).pathname;
    const before = shown.current;
    shown.current = pathname;
    if (before === null) return;
    window.scrollTo(0, 0);
    focusDue = before === pathname ? "view" : "heading";
    focusScreen();
  }, [key]);

  return { key, route, params, query, signal: controller.signal, title, setTitle };
}

class NotFoundSignal extends Error {}

/** Shows the in-app not-found screen in place of this one. Call it while rendering, when the screen's own shelf, card, or upload answered 404. */
export function notFound(): never {
  throw new NotFoundSignal("Not found");
}

/** createRoot's onCaughtError: the not-found signal is expected, so only other errors are logged. */
export function reportCaughtError(error: unknown): void {
  if (!(error instanceof NotFoundSignal)) console.error(error);
}

/** Catches notFound() in the screen under it and draws `fallback`; any other error goes on up. Key it by the path. */
export class NotFoundBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { error: unknown }> {
  override state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    if (this.state.error === null) return this.props.children;
    if (this.state.error instanceof NotFoundSignal) return this.props.fallback;
    throw this.state.error;
  }
}
