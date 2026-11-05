// "Every time you asked": each of the card's messages word for word, newest
// first, in one list per calendar year (local time), each with its day.
// Every message shows; above 12, the list opens on the 12 newest with
// "Show all <n>". A message longer than four lines is clamped, with a
// visible "Show the whole message".
import type { Borrow } from "@asked-before/sdk";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Phrasing } from "@/components/phrasing";
import { Button } from "@/components/ui/button";
import { PRIVACY_LINE } from "@/lib/copy";
import { count, plural } from "@/lib/format";

const SHOWN = 12;
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function Asks({ asks, className }: { asks: Borrow[]; className?: string }) {
  const [all, setAll] = useState(asks.length <= SHOWN);
  const [focusFrom, setFocusFrom] = useState<string | null>(null);
  const newest = [...asks].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const shown = all ? newest : newest.slice(0, SHOWN);
  const yearOf = (ask: Borrow) => new Date(ask.time).getFullYear();
  const totals = Map.groupBy(newest, yearOf);
  const years = [...Map.groupBy(shown, yearOf)];

  useEffect(() => {
    if (focusFrom) document.getElementById(`ask-${focusFrom}`)?.focus();
  }, [focusFrom]);

  function showAll() {
    setAll(true);
    setFocusFrom(newest[SHOWN]?.id ?? null);
  }

  return (
    <section aria-labelledby="asks-title" className={cn("flex flex-col gap-5", className)}>
      <h2 id="asks-title" className="text-base font-semibold">
        Every time you asked
      </h2>
      {years.map(([year, onYear]) => (
        <div key={year} className="flex flex-col">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <h3 id={`asks-${year}`} className="text-sm font-semibold tabular-nums">
              {year}
            </h3>
            <span className="text-xs text-muted-foreground">{plural(totals.get(year)?.length ?? 0, "time")}</span>
          </div>
          <ol aria-label={`Asked in ${year}`} className="flex flex-col">
            {onYear.map((ask) => (
              <Ask key={ask.id} ask={ask} />
            ))}
          </ol>
        </div>
      ))}
      {!all && (
        <Button variant="secondary" size="sm" className="self-start" onClick={showAll}>
          Show all {count(asks.length)}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">{PRIVACY_LINE}</p>
    </section>
  );
}

function Ask({ ask }: { ask: Borrow }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [whole, setWhole] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const node = text.current;
    if (!node || whole) return;
    const measure = () => setLong(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [whole]);

  return (
    <li id={`ask-${ask.id}`} tabIndex={-1} className="flex items-baseline gap-4 border-b border-rule py-2.5 last:border-0">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p ref={text} id={`ask-text-${ask.id}`} className={cn("break-words whitespace-pre-line", !whole && "line-clamp-4")}>
          <Phrasing text={ask.text} />
        </p>
        {long && (
          <Button variant="link" size="xs" aria-expanded={whole} aria-controls={`ask-text-${ask.id}`} onClick={() => setWhole(!whole)}>
            {whole ? "Show less" : "Show the whole message"}
          </Button>
        )}
      </div>
      <time dateTime={ask.time} className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {day.format(new Date(ask.time))}
      </time>
    </li>
  );
}
