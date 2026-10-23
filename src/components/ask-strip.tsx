// The signature element (brief sections 3 and 7): a card's asks on a time
// axis that every strip in a list shares. Pink dots on a 2px grey track, one
// per ask (`asks`, the card page), or the span from first to last ask
// (`first`, `last`, `count`, the list rows) with the count beside it; a
// plum-black tick, taller than the bar, on the day it was proven. Dots on the
// same day sit side by side; a span is at least 6px wide. Draw it on white
// only: the pink is under 3:1 on the panel. Positions are percentages, so it
// takes the width it's given.
//
//   const axis = askAxis(cards.map((card) => card.firstBorrowAt));
//   <AskStrip axis={axis} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} />
//   <AskStrip axis={askAxis([first])} asks={card.borrows.map((ask) => ask.time)} provenAt={card.returnedAt} />
//
// A list row that has fetched its card's asks draws its dots `inRow`: in the
// span's own box, so the row trades its span for its dots without moving.
//
//   <AskStrip axis={axis} asks={times} provenAt={card.returnedAt} inRow />

import { cn } from "cn";
import { Figure } from "@/components/figure";
import { isoDate, longDate, months, plural } from "@/lib/format";

/** A time axis in epoch milliseconds. */
export type Axis = { from: number; to: number };

/** One axis for every strip in a list: from the first day of the month of the earliest ask to now. */
export function askAxis(firstAsks: string[], now = Date.now()): Axis {
  const start = new Date(Math.min(now, ...firstAsks.map((iso) => Date.parse(iso))));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { from: start.getTime(), to: Math.max(now, start.getTime() + 86_400_000) };
}

const DOT = 4.5;

type Common = { axis: Axis; provenAt?: string | null; className?: string };
type EveryAsk = Common & { asks: string[]; inRow?: boolean };
type Span = Common & { first: string; last: string; count: number; showCount?: boolean };

export function AskStrip(props: EveryAsk | Span) {
  const { axis, provenAt, className } = props;
  const x = (iso: string) => `${(Math.min(1, Math.max(0, (Date.parse(iso) - axis.from) / (axis.to - axis.from))) * 100).toFixed(3)}%`;

  if ("asks" in props) {
    const sorted = [...props.asks].sort();
    const label = sorted.length ? `${said(sorted.length, sorted[0]!, sorted.at(-1)!)}${provenText(provenAt)}` : "Not asked yet";
    // Asks on one day are drawn side by side around that day, a dot and a gap apart.
    const days = Map.groupBy(sorted, isoDate);
    const strip = (
      <svg role="img" aria-label={label} className={props.inRow ? "h-3.5 w-full min-w-16 overflow-visible" : cn("h-5 w-full overflow-visible", className)}>
        <line x1="0" x2="100%" y1="50%" y2="50%" className="stroke-track" strokeWidth={2} />
        {[...days.values()].flatMap((onDay) =>
          onDay.map((iso, i) => (
            <circle
              key={`${iso}-${i}`}
              cx={x(iso)}
              cy="50%"
              r={DOT}
              transform={`translate(${(i - (onDay.length - 1) / 2) * (DOT * 2 + 1.5)} 0)`}
              className="fill-ask stroke-background"
              strokeWidth={1.5}
            />
          )),
        )}
        {provenAt && <ProvenTick x={x(provenAt)} />}
      </svg>
    );
    return props.inRow ? <span className={cn("flex min-w-0 items-center gap-2", className)}>{strip}</span> : strip;
  }

  const { first, last, count, showCount = true } = props;
  const middle = `${((parseFloat(x(first)) + parseFloat(x(last))) / 2).toFixed(3)}%`;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <svg role="img" aria-label={`${said(count, first, last)}${provenText(provenAt)}`} className="h-3.5 w-full min-w-16 overflow-visible">
        <line x1="0" x2="100%" y1="50%" y2="50%" className="stroke-track" strokeWidth={2} />
        <line x1={x(first)} x2={x(last)} y1="50%" y2="50%" className="stroke-ask" strokeWidth={4} strokeLinecap="round" />
        {/* The span's least width: 6px around its middle, for a card asked twice in a week. */}
        <rect x={middle} y="50%" width={6} height={4} rx={2} transform="translate(-3 -2)" className="fill-ask" />
        {provenAt && <ProvenTick x={x(provenAt)} />}
      </svg>
      {showCount && (
        <span aria-hidden="true">
          <Figure n={count} className="text-xs text-muted-foreground" />
        </span>
      )}
    </span>
  );
}

/** The day a cold rep passed: plum-black, the strip's full height. */
function ProvenTick({ x }: { x: string }) {
  return <line x1={x} x2={x} y1="0" y2="100%" className="stroke-primary" strokeWidth={2} />;
}

/** "Asked 9 times, March 2025 to September 2026". */
const said = (n: number, first: string, last: string) => `Asked ${plural(n, "time")}, ${months(first, last)}`;

const provenText = (provenAt: string | null | undefined) => (provenAt ? `, proven ${longDate(provenAt)}` : "");
