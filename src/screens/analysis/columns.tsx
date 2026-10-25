// One column per month on a shared baseline, for every month's messages and
// for cold reps. Series stack up from the baseline in the order given (the
// first touches it), and `below` hangs under it, for Not yet. While the
// tallest column is small, each column is a pile of square cells, one per
// message or rep, so a count is read by counting; past that, the columns
// are solid on a y scale of round ticks. Either way, 2px of white parts the
// series, and the chart is only as wide as its months need (40px each at
// most), so a short history stays a small chart.
//
// It's SVG laid out in pixels from its box's width, with every position an
// attribute, as the policy allows no style attribute. The hover only names
// the month under the pointer (onActive); the table beside it carries every
// number, for the keyboard and screen readers too.

import { cn } from "cn";
import { Fragment } from "react";
import { count } from "@/lib/format";
import { monthShort } from "./sentences";
import { useWidth } from "./use-width";

export type Series = { name: string; values: number[]; /** Its fill, as a Tailwind class. */ mark: string };

type ColumnsProps = {
  months: string[];
  above: Series[];
  below?: Series;
  /** The chart's text alternative. */
  label: string;
  active: number | null;
  onActive: (month: number | null) => void;
  className?: string;
};

/** The widest a month's slot grows, so a few months stay a small chart. */
const MAX_SLOT = 40;
/** The 2px of white between cells and between stacked series. */
const GAP = 2;
/** The tallest a pile of cells grows before the columns turn solid. */
const MAX_PILE = 200;
const BAR_HEIGHT = 160;
const AXIS = 28;
const TOP = 6;
const LABELS = 22;

/** Round ticks from 0 past `max`: steps of 1, 2, or 5 times a power of ten, four or five of them. */
function ticks(max: number): number[] {
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

export function Columns({ months, above, below, label, active, onActive, className }: ColumnsProps) {
  const [box, width] = useWidth<HTMLDivElement>();
  const n = months.length;
  const totals = months.map((_, i) => above.reduce((sum, series) => sum + series.values[i]!, 0));
  const maxUp = Math.max(1, ...totals);
  const maxDown = below ? Math.max(0, ...below.values) : 0;

  const fit = (axis: number) => Math.max(3, Math.min(MAX_SLOT, Math.floor((width - axis) / Math.max(n, 1))));
  const slotIfPiled = fit(0);
  const cell = Math.max(2, Math.min(12, Math.round(slotIfPiled * 0.5)));
  const piled = cell >= 5 && maxUp * (cell + GAP) <= MAX_PILE && maxDown * (cell + GAP) <= MAX_PILE / 2;
  const axis = piled ? 0 : AXIS;
  const slot = piled ? slotIfPiled : fit(AXIS);
  // Solid columns stay thin, 16px at most, so the pink is marks rather than blocks.
  const column = piled ? cell : Math.max(2, Math.min(16, Math.round(slot * 0.5)));

  // Heights: a pile is as tall as its tallest column (at least two cells); solid columns share one scale.
  const scaleTicks = piled ? [] : ticks(Math.max(maxUp, maxDown));
  const unit = piled ? cell + GAP : BAR_HEIGHT / scaleTicks.at(-1)!;
  const upHeight = piled ? Math.max(2, maxUp) * unit : BAR_HEIGHT;
  const downHeight = below ? (piled ? Math.max(1, maxDown) * unit : Math.ceil(maxDown * unit)) : 0;
  const baseline = TOP + upHeight;
  const height = baseline + downHeight + (below ? GAP : 0) + LABELS;
  const plot = slot * n;

  // Month labels: as many as fit, the year on the first and wherever it changes.
  const every = Math.max(1, Math.ceil(64 / slot));
  let lastYear = "";
  const labels = months.flatMap((month, i) => {
    if (i % every) return [];
    const year = month.slice(0, 4);
    const text = monthShort(month, year !== lastYear);
    lastYear = year;
    const center = axis + i * slot + slot / 2;
    const half = text.length * 3.4;
    const anchor: "start" | "middle" | "end" = center - half < 0 ? "start" : center + half > axis + plot ? "end" : "middle";
    return [{ i, text, anchor, x: anchor === "start" ? axis + i * slot : anchor === "end" ? axis + (i + 1) * slot : center }];
  });

  /** A stack of `values` from the baseline, upward (1) or downward (-1), as cells or one solid bar per series. */
  const stack = (i: number, list: Series[], direction: 1 | -1) => {
    const x = axis + i * slot + (slot - column) / 2;
    let used = 0;
    return list.map((series) => {
      const value = series.values[i]!;
      if (!value) return null;
      const from = used;
      used += value;
      if (piled) {
        return (
          <Fragment key={series.name}>
            {Array.from({ length: value }, (_, k) => {
              const step = from + k;
              const y = direction === 1 ? baseline - (step + 1) * unit + GAP : baseline + GAP + step * unit;
              return <rect key={k} x={x} y={y} width={column} height={cell} className={series.mark} />;
            })}
          </Fragment>
        );
      }
      // Solid: a 2px white seam above any series under it.
      const seam = from > 0 ? GAP : 0;
      const top = direction === 1 ? baseline - used * unit : baseline + GAP + from * unit + seam;
      const size = Math.max(1, value * unit - seam);
      return <rect key={series.name} x={x} y={top} width={column} height={size} className={series.mark} />;
    });
  };

  return (
    <div ref={box} className={cn("w-full", className)}>
      {width > 0 && (
        <svg role="img" aria-label={label} width={axis + plot} height={height} className="block overflow-visible" onPointerLeave={() => onActive(null)}>
          {scaleTicks.map((tick) => {
            const y = Math.round(baseline - tick * unit) + 0.5;
            return (
              <g key={tick}>
                {tick > 0 && <line x1={axis} x2={axis + plot} y1={y} y2={y} className="stroke-border" strokeWidth={1} />}
                <text x={axis - 6} y={y} dy="0.32em" textAnchor="end" className="fill-faint text-xs tabular-nums">
                  {count(tick)}
                </text>
              </g>
            );
          })}
          {months.map((month, i) => (
            <g key={month} className={cn(active !== null && active !== i && "opacity-40")}>
              {stack(i, above, 1)}
              {below && stack(i, [below], -1)}
            </g>
          ))}
          <line x1={axis} x2={axis + plot} y1={baseline + 0.5} y2={baseline + 0.5} className="stroke-edge" strokeWidth={1} />
          {labels.map(({ i, text, x, anchor }) => (
            <text key={i} x={x} y={height - 6} textAnchor={anchor} className={cn("text-xs", active === i ? "fill-foreground" : "fill-muted-foreground")}>
              {text}
            </text>
          ))}
          {/* The hover targets: each month's whole slot, over the marks. */}
          {months.map((month, i) => (
            <rect key={month} x={axis + i * slot} y={0} width={slot} height={height - LABELS} className="fill-transparent" onPointerEnter={() => onActive(i)} />
          ))}
        </svg>
      )}
    </div>
  );
}
