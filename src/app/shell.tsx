// The app's shell, the open plane (brief sections 4 and 7): a 240px sidebar
// on the white ground behind one hairline, holding the one
// <nav aria-label="Asked Before">: the mark and name, Home with the count of
// cards that need a cold rep, the shelves (long names truncated, with a
// tooltip), All shelves, then Connect your AI, Playground, Docs, Settings
// (with its three areas under it while one is open, except for the guest,
// who has one), and the user row. Under 1024px it folds into a 48px top bar with the screen's name
// and a menu button opening the nav in a full-screen sheet. The shell loads
// desk.get() and shelves.list() once; a screen calls useShell().refreshShell()
// after anything that changes the counts or the shelves. "Skip to content"
// comes first, past the nav to <main>. ShellSkeleton is the frame while the
// app asks who's logged in, and ScreenSkeleton the column while a screen's
// chunk arrives.

import type { Account, Desk, Shelf } from "@asked-before/sdk";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { BookOpenIcon, HouseIcon, LibraryIcon, MenuIcon, PlugIcon, SettingsIcon, SquareTerminalIcon } from "lucide-react";
import { cn } from "cn";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { Mark } from "@/components/mark";
import { SkipLink } from "@/components/skip-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Resource } from "@/app/use-resource";
import { useResource } from "@/app/use-resource";
import type { Route } from "@/app/router";
import { canRetry, client } from "@/lib/client";
import { GUEST_LINE, GUEST_NAME } from "@/lib/copy";
import { count } from "@/lib/format";
import { clearSignedIn } from "@/lib/signed-in";

const ShellContext = createContext<{ refreshShell: () => void }>({ refreshShell: () => {} });

/** For screens: refreshShell() reloads the sidebar's counts and shelves (after a pass or fail, a sort, a shelf made, renamed, or deleted, an upload deleted, a profile save). */
export const useShell = () => useContext(ShellContext);

type ShellProps = { account: Account; route: Route; params: Record<string, string>; title: string; routeKey: string; children: ReactNode };

export function Shell({ account, route, params, title, routeKey, children }: ShellProps) {
  const desk = useResource(() => client.desk.get(), []);
  const shelves = useResource(() => client.shelves.list(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const shell = useMemo(
    () => ({
      refreshShell: () => {
        desk.retry();
        shelves.retry();
      },
    }),
    [desk.retry, shelves.retry],
  );
  useEffect(() => setMenuOpen(false), [routeKey]);

  const current: Current = route.section === "shelves" && params.shelfId ? { shelfId: params.shelfId } : route.name === "shelves" ? "all-shelves" : route.section;
  // Exactly one <nav>: the sidebar's, or the sheet's while it's open.
  const nav = <Nav account={account} current={current} routeName={route.name} desk={desk} shelves={shelves} />;

  return (
    <ShellContext.Provider value={shell}>
      <SkipLink />
      <div className="min-h-svh text-sm lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background px-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menu" />}>
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="gap-0 p-0 data-[side=left]:w-full data-[side=left]:sm:max-w-none">
              <SheetTitle className="sr-only">Asked Before</SheetTitle>
              {menuOpen && nav}
            </SheetContent>
          </Sheet>
          <span className="min-w-0 truncate text-base font-medium">{title}</span>
        </header>
        <div className="sticky top-0 hidden h-svh border-r border-border lg:block">{!menuOpen && nav}</div>
        <main id="main" tabIndex={-1} data-screen={route.name} className="min-w-0 px-4 pt-6 pb-16 lg:px-8 lg:pt-9">
          <div className={cn("mx-auto w-full", WIDTHS[route.section ?? ""] ?? "max-w-275")}>{children}</div>
        </main>
      </div>
    </ShellContext.Provider>
  );
}

/** The canvas's width by section, where it isn't the usual 1100px. */
const WIDTHS: Record<string, string> = { settings: "max-w-288", playground: "max-w-360" };

type Current = Route["section"] | "all-shelves" | { shelfId: string };

type NavProps = { account: Account; current: Current; routeName: string; desk: Resource<Desk>; shelves: Resource<Shelf[]> };

/** Settings' areas, each its own view (app-screens.md 8.2), listed under Settings while one is open. */
const SETTINGS_AREAS = [
  { name: "settings", href: "/app/settings", label: "Account" },
  { name: "settings-keys", href: "/app/settings/keys", label: "API keys" },
  { name: "settings-data", href: "/app/settings/data", label: "Your data" },
];

function Nav({ account, current, routeName, desk, shelves }: NavProps) {
  const areas = current === "settings" && !account.guest;
  const queue = desk.data ? desk.data.totals.borrowed + desk.data.totals.borrowedAgain : 0;
  return (
    <nav aria-label="Asked Before" className="flex h-full flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
      <a href="/app/desk" className="mb-4 flex h-10 items-center gap-2 rounded-md px-2 text-base font-semibold text-foreground max-lg:h-11 pointer-coarse:h-11">
        <Mark />
        Asked Before
      </a>
      <NavItem href="/app/desk" icon={HouseIcon} current={current === "home"}>
        <span className="flex-1">Home</span>
        {queue > 0 && (
          <>
            <span aria-hidden="true">
              <Figure n={queue} className="text-xs text-muted-foreground" />
            </span>
            <span className="sr-only">, {queue === 1 ? "1 card needs" : `${count(queue)} cards need`} a cold rep</span>
          </>
        )}
      </NavItem>
      <p id="nav-shelves" className="mt-5 mb-1 px-2 text-xs text-muted-foreground">
        Shelves
      </p>
      <ShelfItems current={current} shelves={shelves} />
      <NavItem href="/app/shelves" icon={LibraryIcon} current={current === "all-shelves"}>
        All shelves
      </NavItem>
      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        <NavItem href="/app/connect" icon={PlugIcon} current={current === "connect"}>
          Connect your AI
        </NavItem>
        <NavItem href="/app/playground" icon={SquareTerminalIcon} current={current === "playground"}>
          Playground
        </NavItem>
        <NavItem href="/docs" icon={BookOpenIcon} current={false}>
          Docs
        </NavItem>
        {/* With its areas open, the area is the current page and Settings is only their heading. */}
        <NavItem href="/app/settings" icon={SettingsIcon} current={current === "settings" && !areas} className={cn(areas && "text-foreground")}>
          Settings
        </NavItem>
        {areas && (
          <ul aria-label="Settings" className="flex flex-col gap-0.5">
            {SETTINGS_AREAS.map((area) => (
              <li key={area.name}>
                <a href={area.href} aria-current={routeName === area.name ? "page" : undefined} className={cn(itemClass, "pl-8.5")}>
                  {area.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <UserRow account={account} />
      </div>
    </nav>
  );
}

// 32px rows, or 44px under 1024px (the phone's sheet) or on a coarse pointer.
const itemHeight = "h-8 max-lg:h-11 pointer-coarse:h-11";
const itemClass = cn(
  itemHeight,
  "flex min-w-0 items-center gap-2.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-active aria-[current=page]:text-foreground",
);

function NavItem({ href, icon: Icon, current, className, children }: { href: string; icon: ComponentType<{ className?: string }>; current: boolean; className?: string; children: ReactNode }) {
  return (
    <a href={href} aria-current={current ? "page" : undefined} className={cn(itemClass, className)}>
      <Icon aria-hidden="true" className="size-4 shrink-0 stroke-[1.5]" />
      {children}
    </a>
  );
}

function ShelfItems({ current, shelves }: { current: Current; shelves: Resource<Shelf[]> }) {
  const currentShelf = typeof current === "object" && current !== null ? current.shelfId : undefined;
  if (shelves.data) {
    return (
      <ul aria-labelledby="nav-shelves" className="flex flex-col gap-0.5">
        {shelves.data.map((shelf) => (
          <li key={shelf.id}>
            <ShelfItem shelf={shelf} current={currentShelf === shelf.id} />
          </li>
        ))}
      </ul>
    );
  }
  if (shelves.error !== null) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 px-2 py-1.5 text-xs text-muted-foreground">
        Your shelves didn't load.
        {canRetry(shelves.error) && (
          <Button variant="link" size="xs" onClick={shelves.retry}>
            Try again
          </Button>
        )}
      </p>
    );
  }
  return (
    <div aria-hidden="true" className="flex flex-col gap-0.5">
      {[0, 1].map((i) => (
        <div key={i} className={cn(itemHeight, "flex items-center px-2")}>
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** A shelf's link: its name truncated to the sidebar, with the whole name in a tooltip only when it's cut. */
function ShelfItem({ shelf, current }: { shelf: Shelf; current: boolean }) {
  const name = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const node = name.current;
    if (!node) return;
    const measure = () => setCut(node.scrollWidth > node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shelf.name]);

  return (
    <Tooltip>
      <TooltipTrigger
        disabled={!cut}
        render={<a href={`/app/shelves/${encodeURIComponent(shelf.id)}`} aria-current={current ? "page" : undefined} className={cn(itemClass, "pl-8.5")} />}
      >
        <span ref={name} className="min-w-0 flex-1 truncate">
          {shelf.name}
        </span>
        {shelf.demo && <DemoChip />}
      </TooltipTrigger>
      <TooltipContent side="right">{shelf.name}</TooltipContent>
    </Tooltip>
  );
}

function UserRow({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false);

  async function logOut() {
    setBusy(true);
    try {
      await client.auth.logOut();
    } catch {
      // Logged out or not, the next stop is the log-in page.
    }
    clearSignedIn();
    location.assign("/login");
  }

  const logOutButton = (
    <Button variant="ghost" size="sm" disabled={busy} onClick={logOut}>
      Log out
    </Button>
  );

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border px-2 pt-3">
      {account.guest ? (
        <>
          <p className="font-medium text-foreground">{GUEST_NAME}</p>
          <p className="text-xs text-muted-foreground">{GUEST_LINE}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" size="sm" href="/signup">
              Sign up
            </ButtonLink>
            {logOutButton}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="font-medium break-words text-foreground">{account.name}</p>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          </div>
          {logOutButton}
        </div>
      )}
    </div>
  );
}

/** The shell's frame while the app asks who's logged in: the top bar or the sidebar with the name, and the column with flat bars where the screen goes. */
export function ShellSkeleton() {
  return (
    <div className="min-h-svh text-sm lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background px-2 lg:hidden">
        <MenuIcon aria-hidden="true" className="mx-3 size-4 text-faint" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="sticky top-0 hidden h-svh border-r border-border lg:block">
        <div className="flex flex-col gap-0.5 px-3 pt-3 pb-4">
          <p className="mb-4 flex h-10 items-center gap-2 px-2 text-base font-semibold">
            <Mark />
            Asked Before
          </p>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(itemHeight, "flex items-center px-2", i === 1 && "mt-5")}>
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
      <main className="min-w-0 px-4 pt-6 pb-16 lg:px-8 lg:pt-9">
        <div className="mx-auto w-full max-w-275">
          <ScreenSkeleton said="Opening Asked Before…" />
        </div>
      </main>
    </div>
  );
}

/** A screen's column before it draws: the h1, its line, and a panel, as flat bars, with `said` for a screen reader. */
export function ScreenSkeleton({ said }: { said: string }) {
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        {said}
      </p>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
