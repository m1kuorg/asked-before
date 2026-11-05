// The shelf's three views as underline tabs: Cards, Not on a card, and
// Uploads, each with its count. They're links, not ARIA tabs, because the
// view lives in ?view= (back, forward, and a shared link all land on it); the
// current one has aria-current="page". On a phone the row scrolls sideways
// inside itself, never the page.

import { cn } from "cn";
import { tabsListVariants } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { NOT_ON_A_CARD } from "@/lib/copy";
import { viewPath, type View } from "@/screens/shelf/data";

const LABELS: Record<View, string> = { cards: "Cards", once: NOT_ON_A_CARD, uploads: "Uploads" };

export function ViewTabs({ shelfId, name, current, counts }: { shelfId: string; name: string | undefined; current: View; counts: Record<View, string> | undefined }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul aria-label={name ? `Views of ${name}` : "Views of this shelf"} className={cn(tabsListVariants({ variant: "line" }), "min-w-max")}>
        {(Object.keys(LABELS) as View[]).map((view) => (
          <li key={view} className="h-full">
            <a
              href={viewPath(shelfId, view)}
              aria-current={view === current ? "page" : undefined}
              className={cn(
                "relative inline-flex h-full items-center gap-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100",
              )}
            >
              {LABELS[view]}{" "}
              {counts ? (
                <span className="text-muted-foreground tabular-nums">{counts[view]}</span>
              ) : (
                <Skeleton className="h-3.5 w-4" />
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
