// The figures as tabs over one view (the Plausible pattern, in the house's
// underline tabs): four counts in a row, each the tab that opens its view
// below. A label (grey, ink when open), the figure at 24/400 in tabular
// figures, and a 12px grey line saying what it's of. The open tab carries the
// 2px ink rule on the list's 1px one. On a phone the row scrolls sideways
// inside itself, never the page, so the rule never floats inside a grid.

import type { Analysis } from "@asked-before/sdk";
import type { ReactNode } from "react";
import { Figure } from "@/components/figure";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DASH, count, plural } from "@/lib/format";
import { daysText } from "./sentences";

const VIEWS = ["months", "gaps", "reps", "proven"] as const;
export type ViewId = (typeof VIEWS)[number];

/** The view a hash names ("#gaps"), or every month's messages. */
export const viewOf = (hash: string): ViewId => VIEWS.find((view) => `#${view}` === hash) ?? "months";

const LIST = "h-auto w-full min-w-max items-stretch justify-start gap-8 @min-[48rem]/analysis:grid @min-[48rem]/analysis:min-w-0 @min-[48rem]/analysis:grid-cols-4 @min-[48rem]/analysis:gap-6";
const TAB = "h-auto min-w-36 flex-col items-start justify-start gap-1 pt-1 pb-3 text-left whitespace-normal";

type Tab = { id: ViewId; label: string; value: ReactNode; of: string };

function tabsOf({ messages, reasks, gaps, reps, afterProof }: Analysis): Tab[] {
  const checked = reps.passed + reps.failed;
  return [
    { id: "months", label: "Asked before", value: <Figure n={reasks} />, of: `of ${plural(messages, "message")}` },
    {
      id: "gaps",
      label: "Until you asked again",
      value:
        gaps.medianDays === null ? DASH : <Days days={gaps.medianDays} />,
      of: gaps.count ? `the median of ${plural(gaps.count, "gap")}` : "no card asked twice yet",
    },
    { id: "reps", label: "Cold reps passed", value: <Figure n={reps.passed} />, of: checked ? `${count(reps.failed)} not yet, of ${count(checked)} checked` : "none checked yet" },
    { id: "proven", label: "Asked since proven", value: <Figure n={afterProof.askedSince} />, of: afterProof.proven ? `of ${plural(afterProof.proven, "proven card")}` : "no card proven yet" },
  ];
}

/** Days as daysText says them, the number at the figure's size and its unit in grey: "85 days", or "under a day" in words. */
function Days({ days }: { days: number }) {
  if (days < 1) return <>{daysText(days)}</>;
  return (
    <>
      <Figure n={Math.round(days)} />
      <span className="text-sm text-muted-foreground"> {daysText(days).split(" ")[1]}</span>
    </>
  );
}

export function FigureTabs({ analysis }: { analysis: Analysis }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <TabsList aria-label="Views" className={LIST}>
        {tabsOf(analysis).map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className={TAB}>
            <span>{tab.label}</span>
            <span className="text-2xl font-normal text-foreground">{tab.value}</span>
            <span className="text-xs font-normal text-muted-foreground">{tab.of}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}

/** The tabs at their real size while the analysis loads. */
export function FigureTabsLoading() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-6 border-b border-border pb-3 @min-[48rem]/analysis:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
