// The card's ask strip in its every-ask mode (the scaffold's AskStrip), on
// one axis from the month of its first ask to today, with the axis read out
// under it: the first month, each new year at its own tick, and "Today". When
// the card is proven, the tick is named above the strip. Labels that would
// touch are left out; the strip's own aria-label says it all in words.
import type { CardDetail } from "@asked-before/sdk";
import { useLayoutEffect, useRef, useState } from "react";
import { askAxis, AskStrip } from "@/components/ask-strip";
import { shortDate } from "@/lib/format";

const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/** About how wide a 12px label is, to keep labels apart. */
const labelWidth = (text: string) => text.length * 6.6 + 4;

export function CardStrip({ card }: { card: CardDetail }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [now] = useState(() => Date.now());
  const axis = askAxis([card.firstBorrowAt], now);
  const at = (time: number) => ((time - axis.from) / (axis.to - axis.from)) * width;

  const first = shortMonth.format(axis.from);
  const end = "Today";
  const years: { x: number; label: string }[] = [];
  for (let year = new Date(axis.from).getFullYear() + 1; year <= new Date(axis.to).getFullYear(); year++) {
    const x = at(new Date(year, 0, 1).getTime());
    const label = String(year);
    // Each year's label sits just after its tick; keep it clear of the first month and of "Today".
    if (x > labelWidth(first) + 8 && x + 4 + labelWidth(label) < width - labelWidth(end) - 8) years.push({ x, label });
  }

  const proven = card.returnedAt ? { x: at(Date.parse(card.returnedAt)), label: `Proven ${shortDate(card.returnedAt)}` } : null;
  const provenLeft = proven && proven.x + labelWidth(proven.label) > width;

  return (
    <div ref={box} className="flex flex-col gap-1">
      {proven && width > 0 && (
        <svg aria-hidden="true" className="h-4 w-full overflow-visible">
          <text x={provenLeft ? proven.x + 1 : proven.x - 1} y="12" textAnchor={provenLeft ? "end" : "start"} className="fill-foreground text-xs font-medium">
            {proven.label}
          </text>
        </svg>
      )}
      <AskStrip axis={axis} asks={card.borrows.map((ask) => ask.time)} provenAt={card.returnedAt} />
      <svg aria-hidden="true" className="h-4 w-full overflow-visible">
        {width > 0 && (
          <>
            <text x="0" y="12" className="fill-muted-foreground text-xs">
              {first}
            </text>
            {years.map(({ x, label }) => (
              <g key={label}>
                <line x1={x} x2={x} y1="-13" y2="0" className="stroke-input" strokeWidth={1} />
                <text x={x + 4} y="12" className="fill-muted-foreground text-xs tabular-nums">
                  {label}
                </text>
              </g>
            ))}
            <text x={width} y="12" textAnchor="end" className="fill-muted-foreground text-xs">
              {end}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/** The element's width in pixels, kept up to date as it resizes. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
