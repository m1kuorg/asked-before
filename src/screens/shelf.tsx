// A shelf (/app/shelves/:shelfId, ?view=once or ?view=uploads; brief section
// 4 item 3, as amended in section 7). The question: which of this shelf's
// cards do I still need to prove? The h1 is the shelf's name (with "Demo
// data"), over "5 cards from 20 of your messages, last upload Oct 23, 2026.",
// where 20 is the sum of the cards' counts; "Upload an export" is the one
// primary action. Underline tabs switch the view in the URL: Cards (the
// filter, as ?status=, and the rows on one ask-strip axis), Not on a card,
// and Uploads; after a switch, focus is on the view's heading.
// Every view loads the same four things (data.ts), and on a switch between
// views the last answer is drawn at once while the screen asks again. A 404 shows the
// in-app not-found screen. After an upload is deleted the view reloads, its
// heading takes focus, and the shell's counts refresh.

import { useEffect, useId, useRef } from "react";
import { flushSync } from "react-dom";
import { UploadIcon } from "lucide-react";
import { cn } from "cn";
import { notFound, type ScreenProps } from "@/app/router";
import { useShell } from "@/app/shell";
import { useResource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/client";
import { NOT_ON_A_CARD } from "@/lib/copy";
import { count, DASH, plural, shortDate } from "@/lib/format";
import { CardsView, filterOf } from "@/screens/shelf/cards-view";
import { lastSeen, loadShelf, pageCount, shelfPath, uploadPath, viewOf, type ShelfData, type View } from "@/screens/shelf/data";
import { OnceView } from "@/screens/shelf/once-view";
import { UploadsView } from "@/screens/shelf/uploads-view";
import { ViewTabs } from "@/screens/shelf/view-tabs";

const HEADINGS: Record<View, string> = { cards: "Cards", once: NOT_ON_A_CARD, uploads: "Uploads" };

export function Shelf({ client, params, query, navigate, setTitle, signal }: ScreenProps<"shelfId">) {
  const shelfId = params.shelfId;
  const view = viewOf(query.get("view"));
  const { refreshShell } = useShell();
  const head = useResource(() => loadShelf(client, shelfId), [shelfId]);
  const data = head.data ?? lastSeen.get(shelfId);
  const name = data?.shelf.name;
  const failed = !data && head.error !== null;
  const headingId = useId();
  const viewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (head.data) lastSeen.set(shelfId, head.data);
  }, [head.data, shelfId]);
  // Remembered only for a switch to another view of this shelf; anywhere else may change it.
  useEffect(
    () => () => {
      if (location.pathname.replace(/\/+$/, "") !== shelfPath(shelfId)) lastSeen.delete(shelfId);
    },
    [shelfId],
  );
  useEffect(() => {
    if (name) setTitle(name);
  }, [name, setTitle]);
  if (isNotFound(head.error)) {
    lastSeen.delete(shelfId);
    notFound();
  }

  /** After a delete: the view as it's left, its heading focused, and the sidebar's counts. */
  async function afterDelete() {
    refreshShell();
    try {
      const fresh = await loadShelf(client, shelfId);
      if (signal.aborted) return;
      lastSeen.set(shelfId, fresh);
      flushSync(() => head.setData(fresh));
    } catch {
      head.retry();
    }
    viewHeading.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className={name || failed ? "line-clamp-2 min-w-0 text-2xl font-semibold break-words" : "sr-only"}>{name ?? "Shelf"}</h1>
            {!name && !failed && <Skeleton className="h-8 w-48" />}
            {data?.shelf.demo && <DemoChip />}
          </div>
          {data ? <p className="text-sm text-muted-foreground">{subline(data)}</p> : !failed && <Skeleton className="h-5 w-80 max-w-full" />}
        </div>
        <a href={uploadPath(shelfId)} className={cn(buttonVariants(), "self-start")}>
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          Upload an export
        </a>
      </header>

      <ViewTabs
        shelfId={shelfId}
        name={name}
        current={view}
        counts={
          data
            ? { cards: count(data.cards.length), once: pageCount(data.once.phrasings, data.once.next), uploads: pageCount(data.uploads.uploads, data.uploads.next) }
            : failed
              ? { cards: DASH, once: DASH, uploads: DASH }
              : undefined
        }
      />

      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <h2 id={headingId} ref={viewHeading} tabIndex={-1} data-view-heading className="sr-only">
          {HEADINGS[view]}
        </h2>
        {data && head.error !== null && <ErrorNotice error={head.error} title="This shelf didn't reload." onRetry={head.retry} />}
        {data ? (
          view === "cards" ? (
            <CardsView
              shelf={data.shelf}
              cards={data.cards}
              uploads={data.uploads.uploads}
              filter={filterOf(query.get("status"))}
              setFilter={(filter) => navigate(filter === "all" ? shelfPath(shelfId) : `${shelfPath(shelfId)}?status=${filter}`, { replace: true })}
              signal={signal}
            />
          ) : view === "once" ? (
            <OnceView key={data.loaded} client={client} shelf={data.shelf} first={data.once} uploads={data.uploads.uploads} signal={signal} />
          ) : (
            <UploadsView key={data.loaded} client={client} shelf={data.shelf} cards={data.cards} once={data.once} first={data.uploads} signal={signal} onDeleted={afterDelete} />
          )
        ) : head.error !== null ? (
          <ErrorNotice error={head.error} title="This shelf didn't load." onRetry={head.retry} />
        ) : (
          <Loading view={view} />
        )}
      </section>
    </div>
  );
}

/** "5 cards from 20 of your messages, last upload Oct 23, 2026.": the 20 is the cards' asks added up. */
function subline({ shelf, cards }: ShelfData): string {
  const asks = cards.reduce((sum, card) => sum + card.count, 0);
  const made = cards.length ? `${plural(cards.length, "card")} from ${count(asks)} of your messages` : "0 cards";
  return `${made}, ${shelf.lastUploadAt ? `last upload ${shortDate(shelf.lastUploadAt)}` : "nothing uploaded yet"}.`;
}

/** The view's final layout with flat bars where its rows will be. */
function Loading({ view }: { view: View }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        Finding the shelf…
      </p>
      {view === "cards" ? <Skeleton className="h-9 w-full max-w-md rounded-lg" /> : <Skeleton className="h-5 w-full max-w-xl" />}
      <div className="flex flex-col">
        <div className="h-9 border-b border-border" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex h-12 items-center gap-6 border-b border-rule">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
