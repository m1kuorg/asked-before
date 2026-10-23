// A list that comes a page at a time (inventory.md, "Shared behaviour"):
// "Show more" fetches the page after, with "Finding more…" beside it while it
// runs, and an error with "Try again" in its place if it fails. Focus stays
// on "Show more" while there's more; after the last page it moves to the
// first row that page brought, so it never drops to the page's top. Rows mark
// themselves with data-row={index}, inside the element given `list`.

import { useEffect, useRef, useState } from "react";
import { ErrorNotice } from "@/components/error-notice";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WaitLine } from "@/components/wait-line";
import { count } from "@/lib/format";

export type Page<T> = { items: T[]; next: string | null };

export function usePages<T>(first: Page<T>, fetchPage: (cursor: string) => Promise<Page<T>>, signal: AbortSignal) {
  const [items, setItems] = useState(first.items);
  const [next, setNext] = useState(first.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRow === null) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-row="${focusRow}"]`);
    if (row) {
      row.tabIndex = -1;
      row.focus();
    }
    setFocusRow(null);
  }, [focusRow]);

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      const page = await fetchPage(next);
      if (signal.aborted) return;
      const from = items.length;
      setItems((shown) => [...shown, ...page.items]);
      setNext(page.next);
      if (!page.next && page.items.length) setFocusRow(from);
    } catch (thrown) {
      if (!signal.aborted) setError(thrown);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return { items, next, busy, error, more, list };
}

/** Under the list: how many are shown, and "Show more" while there's a page after. */
export function ShowMore({ pages, noun }: { pages: ReturnType<typeof usePages<unknown>>; noun: string }) {
  if (!pages.next && pages.error === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 pt-4">
      {pages.error !== null ? (
        <ErrorNotice error={pages.error} title="The next page didn't load." onRetry={pages.more} />
      ) : (
        <>
          <Button variant="secondary" size="sm" aria-disabled={pages.busy || undefined} onClick={pages.more}>
            {pages.busy && <Spinner data-icon="inline-start" />}
            Show more
          </Button>
          {pages.busy ? <WaitLine>Finding more…</WaitLine> : <p className="text-sm text-muted-foreground">{`${count(pages.items.length)} ${noun} shown`}</p>}
        </>
      )}
    </div>
  );
}
