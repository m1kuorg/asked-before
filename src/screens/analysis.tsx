// Analysis (/app/analysis, ?shelf= to count one shelf; analysis.get()). Its
// question: how do I ask, and what do I keep re-asking? Every figure on it is
// counted by code from the answer, never by the model (plan.md, section 1).
//
// The h1 is the answer as a sentence ("15 of your 27 messages asked
// something you'd asked before."), over a grey line naming the months, the
// shelves counted (with Demo data on a demo shelf), and the time zone. Under
// it, the shelf filter, when there's more than one shelf. Then four figures
// as tabs over one view (views.tsx): every month's messages, the gaps until
// you asked again, cold reps, and proven cards asked again. Last, the skills
// you re-ask most, with the screen's one filled button.
//
// The canvas is Home's: a centred 1100px column, each view 8 + 4 of 12
// columns (729 + 16 + 355 = 1100), the chart beside its note, stacking under
// 68.75rem. Changing the shelf redraws in place: the last answer stays at
// 60% until the new one arrives, so nothing jumps.

import type { Analysis as Answer, AnalysisShelf } from "@asked-before/sdk";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { ErrorNotice } from "@/components/error-notice";
import { WaitLine } from "@/components/wait-line";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isNotFound } from "@/lib/client";
import { FirstVisit } from "@/screens/home/empty";
import { FigureTabs, FigureTabsLoading, viewOf, type ViewId } from "./analysis/figures";
import { countedShelves, headline, monthSpan, shelvesPhrase, zoneText } from "./analysis/sentences";
import { Skills } from "./analysis/skills";
import { GapsView, MonthsView, ProvenView, RepsView } from "./analysis/views";

const ALL = "all";

export function Analysis({ client, query, navigate, signal }: ScreenProps) {
  const shelfId = query.get("shelf") || undefined;
  const analysis = useResource(() => client.analysis.get({ shelfId }), [shelfId]);
  // The open view lives in the hash (#gaps), so it can be linked to: the router routes on the path and the query alone.
  const [view, setView] = useState<ViewId>(() => viewOf(location.hash));
  const openView = (next: ViewId) => {
    setView(next);
    history.replaceState(history.state, "", `${location.pathname}${location.search}${next === "months" ? "" : `#${next}`}`);
  };
  useEffect(() => {
    // A link to another view from this same page changes only the hash.
    const follow = () => setView(viewOf(location.hash));
    addEventListener("hashchange", follow);
    return () => removeEventListener("hashchange", follow);
  }, []);
  // After the learner changes the shelf, the new sentence is announced once it's counted.
  const [changed, setChanged] = useState(false);
  // The last answer drawn, kept on screen (dimmed) while another shelf's loads.
  const last = useRef<Answer | undefined>(undefined);
  if (analysis.data) last.current = analysis.data;
  const data = analysis.data ?? (analysis.error === null ? last.current : undefined);
  const stale = data !== undefined && data !== analysis.data;
  const setShelf = (id: string | null) => {
    setChanged(true);
    navigate(`/app/analysis${id ? `?shelf=${encodeURIComponent(id)}` : ""}${location.hash}`, { replace: true });
  };

  if (analysis.error !== null) {
    return (
      <div className="flex flex-col gap-6 lg:pt-9">
        <h1 className="text-2xl">Analysis</h1>
        {isNotFound(analysis.error) ? (
          <ErrorNotice error={analysis.error} className="max-w-xl" />
        ) : (
          <ErrorNotice error={analysis.error} title="Your analysis didn't load." onRetry={analysis.retry} className="max-w-xl" />
        )}
        {shelfId && (
          <a href="/app/analysis" className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}>
            Count every shelf
          </a>
        )}
      </div>
    );
  }

  const shelf = data?.shelves.find((one) => one.id === shelfId);
  return (
    <div className="@container/analysis flex flex-col lg:pt-9">
      {/* Not clamped: the sentence is the answer, and a cut one would hide its end. */}
      <h1 className="text-2xl text-pretty">
        {data ? (
          headline(data, shelf?.name)
        ) : (
          <>
            <span className="sr-only">Analysis</span>
            <span aria-hidden="true" className="my-1 block h-6 w-full max-w-120 rounded-md bg-border" />
          </>
        )}
      </h1>
      {data ? <Subline analysis={data} /> : <WaitLine className="mt-1">Counting your messages…</WaitLine>}
      <p role="status" className="sr-only">
        {changed && (stale ? "Counting your messages…" : analysis.data && headline(analysis.data, shelf?.name))}
      </p>

      {data && (data.shelves.length > 1 || shelfId) && <ShelfFilter shelves={data.shelves} value={shelfId} onChange={setShelf} />}

      <div aria-busy={stale || undefined} className={cn("flex flex-col", stale && "opacity-60")}>
        {!data ? (
          <div className="mt-10 flex flex-col gap-8">
            <FigureTabsLoading />
            <Skeleton className="h-48 w-full max-w-180" />
          </div>
        ) : data.messages === 0 ? (
          <NoMessages analysis={data} shelf={shelf} client={client} navigate={navigate} />
        ) : (
          <>
            <Tabs value={view} onValueChange={(value) => openView(value as ViewId)} className="mt-10 gap-8">
              <FigureTabs analysis={data} />
              <TabsContent value="months">
                <MonthsView analysis={data} />
              </TabsContent>
              <TabsContent value="gaps">
                <GapsView gaps={data.gaps} />
              </TabsContent>
              <TabsContent value="reps">
                <RepsView reps={data.reps} next={data.skills.find((skill) => skill.status !== "returned")} />
              </TabsContent>
              <TabsContent value="proven">
                <ProvenView after={data.afterProof} />
              </TabsContent>
            </Tabs>
            <div className="mt-12 border-t border-border pt-8">
              <Skills skills={data.skills} signal={signal} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The grey line: the months counted, the shelves (Demo data beside a demo one), and the time zone. */
function Subline({ analysis }: { analysis: Answer }) {
  if (analysis.messages === 0) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        {analysis.shelves.length
          ? "Once a shelf holds your messages, this page counts how often you ask something you'd asked before."
          : "Upload a chat export, and this page counts how often you ask something you'd asked before, and what."}
      </p>
    );
  }
  const span = monthSpan(analysis.months[0]!.month, analysis.months.at(-1)!.month);
  const where = shelvesPhrase(countedShelves(analysis));
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {span.charAt(0).toUpperCase() + span.slice(1)},{" "}
      {"named" in where ? (
        <>
          on{" "}
          {where.named.map((shelf, i) => (
            <span key={shelf.id}>
              {i > 0 && (i === where.named.length - 1 ? (where.named.length > 2 ? ", and " : " and ") : ", ")}
              {shelf.name}
              {/* The chip keeps the punctuation after it on its own line. */}
              {shelf.demo ? (
                <span className="whitespace-nowrap">
                  <DemoChip className="ml-1.5 align-text-bottom" />
                  {i === where.named.length - 1 && "."}
                </span>
              ) : (
                i === where.named.length - 1 && "."
              )}
            </span>
          ))}
        </>
      ) : (
        <>
          across {where.many} shelves
          {where.demo > 0 ? (
            <>
              , {where.demo} of them{" "}
              <span className="whitespace-nowrap">
                <DemoChip className="align-text-bottom" />.
              </span>
            </>
          ) : (
            "."
          )}
        </>
      )}{" "}
      Months are in {zoneText(analysis.timeZone)}.
    </p>
  );
}

/** Which shelves to count, as a segmented control: all of them, or one, each with its messages. On a phone the row scrolls inside itself. */
function ShelfFilter({ shelves, value, onChange }: { shelves: AnalysisShelf[]; value: string | undefined; onChange: (id: string | null) => void }) {
  const all = shelves.reduce((n, shelf) => n + shelf.messages, 0);
  return (
    <div className="-mx-4 mt-6 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0">
      <ToggleGroup aria-label="Shelves counted" value={[value ?? ALL]} onValueChange={(next) => next[0] && onChange(next[0] === ALL ? null : next[0])}>
        <ToggleGroupItem value={ALL} className="gap-2 max-sm:px-2">
          All shelves <Figure n={all} className="text-muted-foreground" />
        </ToggleGroupItem>
        {shelves.map((shelf) => (
          <ToggleGroupItem key={shelf.id} value={shelf.id} className="max-w-64 gap-2 max-sm:px-2">
            <span className="truncate">{shelf.name}</span>
            {shelf.demo && <DemoChip />}
            <Figure n={shelf.messages} className="text-muted-foreground" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Nothing to count: a first visit gets Home's demo shelf and first-shelf form; a shelf, or shelves, with no message, the way to upload. */
function NoMessages({ analysis, shelf, client, navigate }: { analysis: Answer; shelf: AnalysisShelf | undefined; client: ScreenProps["client"]; navigate: ScreenProps["navigate"] }) {
  if (!analysis.shelves.length) {
    return (
      <div className="mt-10">
        <FirstVisit client={client} navigate={navigate} />
      </div>
    );
  }
  return (
    <Empty className="mt-10">
      <EmptyHeader>
        <EmptyDescription>
          {shelf
            ? `Upload a chat export onto ${shelf.name}, and its messages are counted here, month by month.`
            : "Upload a chat export onto one of your shelves, and its messages are counted here, month by month."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {shelf ? (
          <>
            <a href={`/app/shelves/${encodeURIComponent(shelf.id)}/upload`} className={buttonVariants()}>
              Upload a chat export
            </a>
            <a href="/app/analysis" className={buttonVariants({ variant: "secondary" })}>
              Count every shelf
            </a>
          </>
        ) : (
          <a href="/app/shelves" className={buttonVariants()}>
            Go to your shelves
          </a>
        )}
      </EmptyContent>
    </Empty>
  );
}
