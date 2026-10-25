// Analysis's four views, one per figure tab, each a finding over its chart and
// its own "How this is counted". With too few points to chart, a view says
// its finding in words and draws nothing, rather than stretching thin data
// across the screen.
//
// - Every month's messages: one cell per message, re-asks pink at the base
//   of each month's pile, every other message grey (the Pink rule: a pink
//   mark is one ask). Fewer than 5 messages: words.
// - How long until you asked again: the median and the middle half as
//   figures, then the gaps by how long they ran, as bars in ink. Fewer than 5
//   gaps: words.
// - Cold reps: passes above the line in plum-black, the proven tick's colour,
//   Not yet below it in the failure ink. Fewer than 5 checked, or one month:
//   words.
// - Proven, then asked again: proven cards split into Not asked since and
//   Asked since proven, in their status pairs. Fewer than 3 proven: words.

import type { Analysis, AnalysisSkill, GapBuckets } from "@asked-before/sdk";
import { useState } from "react";
import { Figure } from "@/components/figure";
import { TextLink } from "@/components/text-link";
import { startRepName } from "@/lib/copy";
import { count, plural } from "@/lib/format";
import { Columns } from "./columns";
import { daysText, fewMonths, gapsFinding, monthName, monthSpan, monthsFinding, provenFinding, repsFinding, zoneText } from "./sentences";
import { useWidth } from "./use-width";
import { Legend, MonthTable, Tally, UnderChart, View } from "./view";

/** Under this many points a view says its finding in words. */
const FEW = 5;

const NEVER_DATES = "Code counts these from your messages' own timestamps; the model only reads your words, never your dates.";

const ASKED_BEFORE = { name: "Asked before", mark: "fill-ask" };
const OTHER = { name: "Other messages", mark: "fill-edge" };

export function MonthsView({ analysis }: { analysis: Analysis }) {
  const [active, setActive] = useState<number | null>(null);
  const { months } = analysis;
  const few = analysis.messages < FEW;
  const reasks = months.map((month) => month.reasks);
  const others = months.map((month) => month.messages - month.reasks);
  const hovered = active === null ? null : months[active];
  return (
    <View
      title="Every month's messages"
      finding={few ? fewMonths(analysis) : monthsFinding(analysis)}
      legend={!few && <Legend items={[ASKED_BEFORE, OTHER]} />}
      note={
        <>
          <p>
            Each square is one of your messages, in the month you sent it, in {zoneText(analysis.timeZone)}. A pink one asked something you'd asked before: it's on a card that already had an
            earlier message. Grey ones are the rest: each card's first message, and the {plural(analysis.notOnACard, "message")} not on a card.
          </p>
          <p>{NEVER_DATES}</p>
        </>
      }
    >
      {!few && (
        <>
          <Columns
            months={months.map((month) => month.month)}
            above={[
              { ...ASKED_BEFORE, values: reasks },
              { ...OTHER, values: others },
            ]}
            label={`Your messages by month, ${monthSpan(months[0]!.month, months.at(-1)!.month)}: ${plural(analysis.messages, "message")}, ${count(analysis.reasks)} of them asked before. ${monthsFinding(analysis)}`}
            active={active}
            onActive={setActive}
          />
          <UnderChart
            table={<MonthTable caption="Every month in numbers" columns={["Messages", "Asked before"]} rows={months.map((month) => ({ month: month.month, values: [month.messages, month.reasks] }))} />}
            readout={hovered && `${monthName(hovered.month)}: ${plural(hovered.messages, "message")}, ${count(hovered.reasks)} asked before`}
          />
        </>
      )}
    </View>
  );
}

const BUCKETS: { key: keyof GapBuckets; label: string }[] = [
  { key: "underADay", label: "Within a day" },
  { key: "underAWeek", label: "Under a week" },
  { key: "oneToFourWeeks", label: "1 to 4 weeks" },
  { key: "oneToThreeMonths", label: "1 to 3 months" },
  { key: "threeMonthsOrMore", label: "3 months or more" },
];

export function GapsView({ gaps }: { gaps: Analysis["gaps"] }) {
  const most = Math.max(1, ...BUCKETS.map(({ key }) => gaps.buckets[key]));
  const filled = BUCKETS.filter(({ key }) => gaps.buckets[key] > 0);
  return (
    <View
      title="How long until you asked again"
      finding={gapsFinding(gaps)}
      note={
        <>
          <p>
            A gap runs from one message on a card to the card's next one, so every message asked before has one gap before it. It's counted in whole days: under 24 hours is within a day, and
            1 to 3 months is 28 to 89 days.
          </p>
          <p>The middle half runs from the gap a quarter of the way up the list, shortest first, to the gap three quarters of the way.</p>
        </>
      }
    >
      {gaps.count > 0 && gaps.medianDays !== null && gaps.middleHalf && (
        <dl className="flex flex-wrap gap-x-12 gap-y-4">
          <div className="flex flex-col-reverse gap-1">
            <dt className="text-xs text-muted-foreground">The median gap</dt>
            <dd className="text-2xl">{daysText(gaps.medianDays)}</dd>
          </div>
          {gaps.count >= 4 && (
            <div className="flex flex-col-reverse gap-1">
              <dt className="text-xs text-muted-foreground">The middle half of {plural(gaps.count, "gap")}</dt>
              <dd className="text-2xl">
                {Math.round(gaps.middleHalf.fromDays)} to {daysText(gaps.middleHalf.toDays)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {gaps.count >= FEW ? (
        <ul aria-label="Gaps by how long they ran" className="flex max-w-xl flex-col">
          {BUCKETS.map(({ key, label }) => {
            const n = gaps.buckets[key];
            return (
              <li key={key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-x-4 border-b border-rule py-2 last:border-0">
                <span className="text-sm">{label}</span>
                <svg aria-hidden="true" className="h-2.5 w-full">
                  {n > 0 && <rect width={`${(n / most) * 100}%`} height="100%" className="fill-active-foreground" />}
                </svg>
                <span className="text-right text-sm">
                  <Figure n={n} />
                  <span className="sr-only"> {n === 1 ? "gap" : "gaps"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        gaps.count > 0 && <p className="text-sm text-muted-foreground">{filled.map(({ key, label }) => `${label}: ${count(gaps.buckets[key])}`).join(". ")}.</p>
      )}
    </View>
  );
}

const PASSED = { name: "Passed", mark: "fill-primary" };
const NOT_YET = { name: "Not yet", mark: "fill-negative-foreground" };

export function RepsView({ reps, next }: { reps: Analysis["reps"]; next: AnalysisSkill | undefined }) {
  const [active, setActive] = useState<number | null>(null);
  const checked = reps.passed + reps.failed;
  const chart = checked >= FEW && reps.months.length > 1;
  const hovered = active === null ? null : reps.months[active];
  return (
    <View
      title="Cold reps, passed and not yet"
      finding={repsFinding(reps)}
      legend={chart && <Legend items={[PASSED, NOT_YET]} />}
      note={
        <>
          <p>A cold rep counts in the month it was checked. One you started but didn't answer isn't counted.</p>
          <p>From first message to first pass is, for each card with a pass, the days from the first time you asked it to the first cold rep on it that passed.</p>
        </>
      }
    >
      {chart && (
        <>
          <Columns
            months={reps.months.map((month) => month.month)}
            above={[{ ...PASSED, values: reps.months.map((month) => month.passed) }]}
            below={{ ...NOT_YET, values: reps.months.map((month) => month.failed) }}
            label={`Cold reps by month, passes above the line and not yet below it: ${repsFinding(reps)}`}
            active={active}
            onActive={setActive}
          />
          <UnderChart
            table={<MonthTable caption="Every month in numbers" columns={["Passed", "Not yet"]} rows={reps.months.map((month) => ({ month: month.month, values: [month.passed, month.failed] }))} />}
            readout={hovered && `${monthName(hovered.month)}: ${count(hovered.passed)} passed, ${count(hovered.failed)} not yet`}
          />
        </>
      )}
      {!chart && checked > 0 && (
        <Tally
          label="Cold reps checked"
          items={[
            { name: "Passed", n: reps.passed, pill: "positive" },
            { name: "Not yet", n: reps.failed, pill: "negative" },
          ]}
        />
      )}
      {checked === 0 && next && (
        <p className="text-sm">
          <TextLink href={`/app/cards/${encodeURIComponent(next.id)}?rep=start`} aria-label={startRepName(next.skill)}>
            Start a cold rep on {next.skill}
          </TextLink>
        </p>
      )}
    </View>
  );
}

export function ProvenView({ after }: { after: Analysis["afterProof"] }) {
  const notSince = after.proven - after.askedSince;
  return (
    <View
      title="Proven, then asked again"
      finding={provenFinding(after)}
      note={
        <>
          <p>A card is proven once a cold rep on it passes. It's Asked since proven when you sent a message on it after its latest pass, and it needs a fresh cold rep.</p>
          <p>The days run from that pass to the first message after it.</p>
        </>
      }
    >
      {after.proven >= 3 ? (
        <Split notSince={notSince} askedSince={after.askedSince} />
      ) : (
        after.proven > 0 && <ProvenTally notSince={notSince} askedSince={after.askedSince} />
      )}
    </View>
  );
}

/** The proven cards as one bar, split by status: Not asked since, then Asked since proven, 2px of white between. */
function Split({ notSince, askedSince }: { notSince: number; askedSince: number }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const total = notSince + askedSince;
  const first = notSince && askedSince ? Math.round((width - 2) * (notSince / total)) : notSince ? width : 0;
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div ref={box}>
        {width > 0 && (
          <svg role="img" aria-label={`${plural(total, "proven card")}: ${count(notSince)} not asked since, ${count(askedSince)} asked since proven`} width={width} height={24} className="block">
            {notSince > 0 && <rect x={0.5} y={0.5} width={first - 1} height={23} rx={6} className="fill-positive stroke-positive-foreground/25" />}
            {askedSince > 0 && <rect x={(notSince ? first + 2 : 0) + 0.5} y={0.5} width={width - (notSince ? first + 2 : 0) - 1} height={23} rx={6} className="fill-notice stroke-notice-border" />}
          </svg>
        )}
      </div>
      <ProvenTally notSince={notSince} askedSince={askedSince} />
    </div>
  );
}

function ProvenTally({ notSince, askedSince }: { notSince: number; askedSince: number }) {
  return (
    <Tally
      label="Proven cards by status"
      items={[
        { name: "Not asked since", n: notSince, pill: "positive" },
        { name: "Asked since proven", n: askedSince, pill: "notice" },
      ]}
    />
  );
}
