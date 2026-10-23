// Home's four count tiles (taste-sheet-app.md, "home"; brief section 7): To
// prove, Asked since proven, Proven, and All cards, 3 columns each, 128px
// tall, 16px pad, the label over the value at regular weight in tabular
// figures and a plain caption. They sum visibly: All cards' caption is the
// other three added. A 2 x 2 grid on a phone.
import type { Desk } from "@asked-before/sdk";
import { Figure } from "@/components/figure";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_WORDS } from "@/lib/copy";
import { count } from "@/lib/format";

const grid = "grid grid-cols-2 gap-4 @min-[40rem]:grid-cols-4";
const tile = "flex h-32 min-w-0 flex-col rounded-2xl bg-panel p-4";

export function Tiles({ totals }: { totals: Desk["totals"] }) {
  const { borrowed, borrowedAgain, returned, cards } = totals;
  const tiles = [
    { label: STATUS_WORDS.borrowed, value: borrowed, caption: "Not proven yet" },
    { label: STATUS_WORDS.borrowed_again, value: borrowedAgain, caption: "Proven, then asked again" },
    { label: STATUS_WORDS.returned, value: returned, caption: "Passed a cold rep" },
    { label: "All cards", value: cards, caption: `${count(borrowed)} + ${count(borrowedAgain)} + ${count(returned)}` },
  ];
  return (
    <dl className={grid}>
      {tiles.map(({ label, value, caption }) => (
        <div key={label} className={tile}>
          <dt className="text-sm font-medium">{label}</dt>
          <dd className="mt-1 text-2xl">
            <Figure n={value} />
          </dd>
          <dd className="mt-auto text-xs text-muted-foreground">{caption}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TilesLoading() {
  return (
    <div aria-hidden="true" className={grid}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={tile}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-6 w-10" />
          <Skeleton className="mt-auto h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
