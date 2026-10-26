// The current values a settings section is about, in its label column under
// the description (.taste-skill/app/direction.json, "Settings in two
// columns": a summary of the current values rather than a void beside a
// taller panel), as a key-value list on row rules: the term in grey on the
// left, the value in ink on the right (a count in its own tabular Figure).
// Facts only, from the API. A value still loading is a flat bar on the line's
// centre, so nothing moves when it lands.

import type { ReactNode } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

/** One term and its value; `undefined` while it loads. */
export type Fact = { term: string; value: ReactNode | undefined };

export function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl aria-busy={facts.some((fact) => fact.value === undefined) || undefined} className="mt-1 flex max-w-sm flex-col border-t border-border @5xl:max-w-none">
      {facts.map(({ term, value }) => (
        <div key={term} className="flex items-baseline justify-between gap-4 border-b border-border py-2">
          <dt className="shrink-0">{term}</dt>
          {/* A bar has no baseline to share with its term, so it centres on the row instead. */}
          <dd className={cn("min-w-0 text-right break-words text-foreground", value === undefined && "self-center")}>{value === undefined ? <Skeleton className="my-0.5 h-4 w-20" /> : value}</dd>
        </div>
      ))}
    </dl>
  );
}
