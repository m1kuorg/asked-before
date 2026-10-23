// A count on its way to a total, as a line of words over a bar at the true
// ratio: what's happening at the left, "500 of 1,204 sent" at the right. The
// words are the live status, which a screen reader hears when they change
// and at each quarter of the way, never at every count; the count sits
// outside it, and the bar is the progressbar (whose children ARIA treats as
// presentational, so the status sits outside it too).

import { Figure } from "@/components/figure";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

const QUARTERS = ["", "A quarter", "Half", "Three quarters", "All"];

type ProgressLineProps = { label: string; done: number; total: number; unit: string; spinner?: boolean };

export function ProgressLine({ label, done, total, unit, spinner = false }: ProgressLineProps) {
  const quarter = total > 0 ? Math.floor((Math.min(done, total) / total) * 4) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p role="status" className="flex items-center gap-2">
          {spinner && <Spinner className="self-center" />}
          {label}
          {quarter > 0 && <span className="sr-only">{` ${QUARTERS[quarter]} ${unit}.`}</span>}
        </p>
        <p className="text-muted-foreground">
          <Figure n={done} /> of <Figure n={total} /> {unit}
        </p>
      </div>
      <Progress value={done} max={Math.max(total, 1)} aria-label={label} getAriaValueText={() => `${done} of ${total} ${unit}`} />
    </div>
  );
}
