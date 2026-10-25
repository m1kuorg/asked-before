// "The skills you re-ask most": up to 10 cards, most asked first, each a rule
// row on white that opens its card: its skill and shelf, every ask as a pink
// dot on one axis all the rows share (the span first, then the dots once its
// card arrives, as on Home), how many times you asked, the median gap between
// asks, and its status. The heading row holds the screen's one filled
// button, "Start a cold rep", on the most asked card that needs one: the
// way from what you keep asking to proving you can do it alone.

import type { AnalysisSkill } from "@asked-before/sdk";
import { cn } from "cn";
import { useId } from "react";
import { AskStrip, askAxis } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { START_REP, startRepName } from "@/lib/copy";
import { DASH, plural, shortMonths } from "@/lib/format";
import { needsRep } from "@/lib/status";
import { useAskTimes } from "@/lib/use-ask-times";
import { daysText } from "./sentences";

// Skill, every ask, times asked, median gap, status. 640px and up: one line.
const ROW = "sm:grid-cols-[minmax(0,2fr)_minmax(8rem,2fr)_4.5rem_6.5rem_9.5rem] sm:gap-x-6";

const cardPath = (id: string) => `/app/cards/${encodeURIComponent(id)}`;

export function Skills({ skills, signal }: { skills: AnalysisSkill[]; signal: AbortSignal }) {
  const heading = useId();
  const timesOf = useAskTimes(skills, signal);
  const next = skills.find((skill) => needsRep(skill.status));
  const top = skills[0];
  const axis = askAxis(skills.map((skill) => skill.firstBorrowAt));
  const axisStart = new Date(axis.from).toISOString();

  return (
    <section aria-labelledby={heading} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-[70ch] flex-col gap-1.5">
          <h2 id={heading} className="text-base font-medium">
            The skills you re-ask most
          </h2>
          <p className="text-sm">
            {top
              ? `${top.skill} leads: asked ${plural(top.count, "time")}${top.medianGapDays === null ? "" : `, ${daysText(top.medianGapDays)} apart at the median`}.`
              : "No card yet. A card appears once two of your messages ask how to do the same thing."}
          </p>
        </div>
        {next && (
          <a href={`${cardPath(next.id)}?rep=start`} aria-label={startRepName(next.skill)} className={buttonVariants()}>
            {START_REP}
          </a>
        )}
      </div>
      {skills.length > 0 && (
        <div>
          <div aria-hidden="true" className={cn("hidden h-9 items-center border-b border-border text-xs text-muted-foreground sm:grid", ROW)}>
            <span>Skill</span>
            <span className="flex justify-between gap-2">
              <span>{shortMonths(axisStart, axisStart)}</span>
              <span>Today</span>
            </span>
            <span className="text-right">Times asked</span>
            <span className="text-right">Median gap</span>
            <span>Status</span>
          </div>
          <ol aria-label="Your most asked cards, most asked first">
            {skills.map((skill) => (
              <Row key={skill.id} skill={skill} axis={axis} times={timesOf(skill)} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Row({ skill, axis, times }: { skill: AnalysisSkill; axis: ReturnType<typeof askAxis>; times: string[] | undefined }) {
  return (
    <li
      className={cn(
        "group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-rule py-3 last:border-0 has-[a:focus-visible]:rounded-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring sm:min-h-14 sm:py-2",
        ROW,
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <a
          href={cardPath(skill.id)}
          className="min-w-0 font-medium break-words group-hover:underline group-hover:underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {skill.skill}
        </a>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{skill.shelf.name}</span>
          {skill.shelf.demo && <DemoChip />}
        </span>
      </span>
      {times ? (
        <AskStrip axis={axis} asks={times} provenAt={skill.returnedAt} inRow className="col-span-2 row-start-3 sm:col-auto sm:row-auto" />
      ) : (
        <AskStrip axis={axis} first={skill.firstBorrowAt} last={skill.lastBorrowAt} count={skill.count} provenAt={skill.returnedAt} showCount={false} className="col-span-2 row-start-3 sm:col-auto sm:row-auto" />
      )}
      <span className="col-start-1 row-start-2 text-xs text-muted-foreground sm:col-auto sm:row-auto sm:text-right sm:text-sm sm:text-foreground">
        <span className="sm:hidden">asked </span>
        <Figure n={skill.count} />
        <span className="sm:sr-only"> {skill.count === 1 ? "time" : "times"}</span>
        <span className="sm:hidden">{skill.medianGapDays === null ? "" : `, ${daysText(skill.medianGapDays)} apart at the median`}</span>
      </span>
      <span className="hidden text-right text-sm text-muted-foreground sm:block">
        {skill.medianGapDays === null ? DASH : daysText(skill.medianGapDays)}
        <span className="sr-only"> apart at the median</span>
      </span>
      <span className="col-start-2 row-start-1 justify-self-end sm:col-auto sm:row-auto sm:justify-self-start">
        <StatusPill status={skill.status} />
      </span>
    </li>
  );
}
