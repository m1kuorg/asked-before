// "Prove next" (brief sections 4 and 7), the panel that answers Home's
// question: up to 10 cards that need a cold rep, most asked first, each a
// white row card with the skill (to the card, which spends no model request),
// its shelf, its ask strip on one axis shared by every row (the earliest first
// ask to today), "asked 9 times", and "Start a cold rep" to
// /app/cards/<id>?rep=start. The top row's is the screen's one filled
// primary. The rows share their column lines through a subgrid, so every
// strip starts and ends on the same x. Each strip draws the span first, then
// one dot per ask once that card's detail arrives (useAskTimes), in the same
// box, so nothing moves.
import type { Desk, DeskCard } from "@asked-before/sdk";
import type { ReactNode } from "react";
import { cn } from "cn";
import { AskStrip, askAxis, type Axis } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { Showing } from "@/components/showing";
import { Time } from "@/components/time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COLD_REP_GLOSS, START_REP, startRepName } from "@/lib/copy";
import { count, shortMonths } from "@/lib/format";
import { useAskTimes } from "@/lib/use-ask-times";
import { Panel, nameLink, rowCard } from "./panel";
import { queueOf } from "./sentences";

const GLOSS = `${COLD_REP_GLOSS.charAt(0).toUpperCase()}${COLD_REP_GLOSS.slice(1)}.`;

// Narrow (a phone, or a stacked panel): the skill beside the action, the strip beside the count, in two fixed
// columns so every strip has one width. From 40rem: four columns shared through a subgrid.
const columns = "@min-[40rem]/rows:grid-cols-[minmax(0,1.9fr)_minmax(6rem,1fr)_auto_auto] @min-[40rem]/rows:gap-x-4";
const narrow = "grid grid-cols-[minmax(0,1fr)_8.5rem] gap-x-3 [grid-template-areas:'id_action'_'strip_count']";
const wide = "@min-[40rem]/rows:col-span-full @min-[40rem]/rows:grid-cols-subgrid @min-[40rem]/rows:[grid-template-areas:none]";
// Literal class names, so Tailwind finds them in this file.
const area = {
  id: "[grid-area:id] @min-[40rem]/rows:[grid-area:auto]",
  strip: "[grid-area:strip] @min-[40rem]/rows:[grid-area:auto]",
  count: "[grid-area:count] @min-[40rem]/rows:[grid-area:auto]",
  action: "[grid-area:action] @min-[40rem]/rows:[grid-area:auto]",
};

export function ProveNext({ desk, empty, signal, className }: { desk: Desk; empty?: ReactNode; signal: AbortSignal; className?: string }) {
  const rows = desk.mostBorrowed;
  const queue = queueOf(desk.totals);
  return (
    <Panel
      title="Prove next"
      className={className}
      chip={
        queue > 0 && (
          <Badge>
            {count(queue)}
            <span className="sr-only">{queue === 1 ? " card" : " cards"}</span>
          </Badge>
        )
      }
      description={rows.length ? `Most asked first. ${GLOSS}` : GLOSS}
      footer={rows.length < queue && <Showing shown={rows.length} of={queue} />}
    >
      {rows.length ? <Rows rows={rows} signal={signal} /> : empty}
    </Panel>
  );
}

function Rows({ rows, signal }: { rows: DeskCard[]; signal: AbortSignal }) {
  const axis = askAxis(rows.map((row) => row.firstBorrowAt));
  const timesOf = useAskTimes(rows, signal);
  return (
    <div className="@container/rows">
      <div className={cn("flex flex-col gap-2 @min-[40rem]/rows:grid", columns)}>
        <AxisLabels axis={axis} />
        <ol className="flex flex-col gap-2 @min-[40rem]/rows:col-span-full @min-[40rem]/rows:grid @min-[40rem]/rows:grid-cols-subgrid">
          {rows.map((row, i) => (
            <Row key={row.id} card={row} axis={axis} times={timesOf(row)} top={i === 0} />
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The shared axis's ends, over the strip column: its first month and today. The strips carry their own labels. */
function AxisLabels({ axis }: { axis: Axis }) {
  const from = new Date(axis.from).toISOString();
  return (
    <div aria-hidden="true" className={cn(narrow, wide, "px-3.25 text-xs text-muted-foreground sm:px-4.25 @min-[40rem]/rows:px-0")}>
      <span className="flex justify-between [grid-area:strip] @min-[40rem]/rows:[grid-area:1/2/2/3]">
        <span>{shortMonths(from, from)}</span>
        <span>Today</span>
      </span>
    </div>
  );
}

function Row({ card, axis, times, top }: { card: DeskCard; axis: Axis; times: string[] | undefined; top: boolean }) {
  const cardPath = `/app/cards/${encodeURIComponent(card.id)}`;
  const askedAgain = card.status === "borrowed_again";
  return (
    <li className={cn(rowCard, narrow, wide, "items-center gap-y-2 @min-[40rem]/rows:gap-y-0")}>
      <div className={cn(area.id, "flex min-w-0 flex-col gap-0.5")}>
        <a href={cardPath} className={cn(nameLink, "line-clamp-3 min-w-0 @min-[40rem]/rows:line-clamp-2")}>
          {card.skill}
        </a>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <a href={`/app/shelves/${encodeURIComponent(card.shelf.id)}`} className="truncate underline-offset-4 hover:text-foreground hover:underline">
            {card.shelf.name}
          </a>
          {card.shelf.demo && <DemoChip />}
        </span>
        {/* Asked since proven: the strip carries the proven tick, and this line the day it was asked again. */}
        {askedAgain && (
          <span className="text-xs text-notice-foreground">
            asked again <Time iso={card.lastBorrowAt} />
          </span>
        )}
      </div>
      {times ? (
        <AskStrip axis={axis} asks={times} provenAt={card.returnedAt} inRow className={area.strip} />
      ) : (
        <AskStrip axis={axis} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} showCount={false} className={area.strip} />
      )}
      <span className={cn(area.count, "text-right text-sm whitespace-nowrap text-muted-foreground")}>
        asked <Figure n={card.count} className="font-medium text-foreground" /> {card.count === 1 ? "time" : "times"}
      </span>
      {/* A link styled as a button: Base UI's Button would give the <a> role="button". */}
      <a href={`${cardPath}?rep=start`} aria-label={startRepName(card.skill)} className={cn(buttonVariants({ variant: top ? "default" : "ghost", size: "sm" }), area.action, "justify-self-end")}>
        {START_REP}
      </a>
    </li>
  );
}


/** Rows at their real size while the desk loads. */
export function ProveNextLoading({ className }: { className?: string }) {
  return (
    <Panel title="Prove next" description={GLOSS} className={className}>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(rowCard, "flex items-center gap-4")}>
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="hidden h-1 w-40 sm:block" />
            <Skeleton className="h-8 w-32 max-lg:h-11 pointer-coarse:h-11" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
