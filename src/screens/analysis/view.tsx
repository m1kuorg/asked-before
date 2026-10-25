// One view of Analysis, the panel under its figure tab: on the left (8 of 12
// columns) its 16/500 heading with the legend on its right, the finding in
// one plain sentence, then the chart and its numbers as a table; on the right
// (4 of 12), "How this is counted", in grey. Everything sits on the white
// ground: pink marks go on white only. Under a 68.75rem canvas the note
// follows the chart.

import { useId, type ReactNode } from "react";
import { Figure } from "@/components/figure";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthName } from "./sentences";

type ViewProps = { title: string; finding: ReactNode; legend?: ReactNode; note: ReactNode; children?: ReactNode };

export function View({ title, finding, legend, note, children }: ViewProps) {
  const heading = useId();
  const noteHeading = useId();
  return (
    <section aria-labelledby={heading} className="grid gap-x-4 gap-y-8 @min-[68.75rem]/analysis:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-5 @min-[68.75rem]/analysis:col-span-8">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id={heading} className="text-base font-medium">
              {title}
            </h2>
            {legend}
          </div>
          <p className="max-w-[70ch] text-sm">{finding}</p>
        </div>
        {children}
      </div>
      <aside aria-labelledby={noteHeading} className="flex flex-col gap-1.5 @min-[68.75rem]/analysis:col-span-4">
        <h3 id={noteHeading} className="text-sm font-semibold">
          How this is counted
        </h3>
        <div className="flex max-w-[70ch] flex-col gap-2 text-sm text-muted-foreground">{note}</div>
      </aside>
    </section>
  );
}

/** A legend of square swatches, each the chart's own cell scaled down. */
export function Legend({ items }: { items: { name: string; mark: string }[] }) {
  return (
    <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ name, mark }) => (
        <li key={name} className="flex items-center gap-1.5">
          <svg aria-hidden="true" className="size-2.5">
            <rect width="100%" height="100%" className={mark} />
          </svg>
          {name}
        </li>
      ))}
    </ul>
  );
}

/** Under the chart: its numbers behind a disclosure on the left, and on the right, what the pointer is on. */
export function UnderChart({ table, readout }: { table: ReactNode; readout: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      {table}
      <p aria-hidden="true" className="text-xs text-muted-foreground">
        {readout}
      </p>
    </div>
  );
}

/** A view's counts in their pills, for when there are too few to chart: "Passed 1", "Not yet 1". */
export function Tally({ label, items }: { label: string; items: { name: string; n: number; pill: "positive" | "notice" | "negative" }[] }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {items.map(({ name, n, pill }) => (
        <li key={name} className="flex items-center gap-2">
          <Badge variant={pill}>{name}</Badge>
          <Figure n={n} />
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers, every month, as a table behind a disclosure: the way to them without a pointer. */
export function MonthTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: { month: string; values: number[] }[] }) {
  return (
    <details className="group text-sm">
      <summary className="w-fit cursor-pointer text-muted-foreground underline decoration-input underline-offset-4 hover:text-foreground hover:decoration-foreground">
        {caption}
      </summary>
      <Table className="mt-2 max-w-md">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            {columns.map((column) => (
              <TableHead key={column} className="text-right">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ month, values }) => (
            <TableRow key={month}>
              <TableCell>{monthName(month)}</TableCell>
              {values.map((value, i) => (
                <TableCell key={columns[i]} className="text-right">
                  <Figure n={value} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}
