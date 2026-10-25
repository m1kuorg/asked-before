// What Search offers before a search, and beside a "No" (plan section 3):
// a few searches made from the learner's own cards, from desk.get(), most
// asked first, each a link to ?q=<two words of its skill>, which always
// finds that card by its name. It never searches with an empty q. With no
// card yet, it says what's true and where to go next.
import type { Desk, DeskCard } from "@asked-before/sdk";
import { cn } from "cn";
import type { Resource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { askedTimes } from "@/lib/format";
import { Panel, nameLink, ruleRow } from "@/screens/home/panel";
import { exampleOf } from "./sentences";

/** How many examples it offers at most. */
const EXAMPLES = 5;

/** Searches from the desk's cards, still to prove first, then the proven, one per distinct pair of words. */
function examplesOf(desk: Desk): { q: string; card: DeskCard }[] {
  const seen = new Set<string>();
  const out: { q: string; card: DeskCard }[] = [];
  for (const card of [...desk.mostBorrowed, ...desk.latestReturns]) {
    const q = exampleOf(card.skill);
    if (!q || seen.has(q)) continue;
    seen.add(q);
    out.push({ q, card });
    if (out.length === EXAMPLES) break;
  }
  return out;
}

export const searchPath = (q: string) => `/app/search?${new URLSearchParams({ q })}`;

export function Examples({ desk, title, onPick }: { desk: Resource<Desk>; title: string; onPick: () => void }) {
  if (desk.error !== null && !desk.data) {
    return (
      <Panel title={title}>
        <ErrorNotice error={desk.error} title="Your cards didn't load." onRetry={desk.retry} focus={false} />
      </Panel>
    );
  }
  if (!desk.data) {
    return (
      <Panel title={title} description="Two words from each of your cards' names, most asked first.">
        <div aria-hidden="true" className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(ruleRow, "flex flex-col gap-2")}>
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </Panel>
    );
  }
  const examples = examplesOf(desk.data);
  if (!examples.length) {
    return (
      <Panel title={title}>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {desk.data.shelves === 0
                ? "There's nothing of yours to search yet. Upload a chat export to a shelf, or try the demo shelf, and your messages are searchable here."
                : "None of your shelves has a card yet, so there's no example to give. Any words you type are still looked for in every message you've uploaded."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <a href="/app/shelves" className={cn(buttonVariants({ variant: "secondary" }))}>
              Go to your shelves
            </a>
          </EmptyContent>
        </Empty>
      </Panel>
    );
  }
  return (
    <Panel title={title} description="Two words from each of your cards' names, most asked first.">
      <ul aria-label="Searches to try" className="flex flex-col">
        {examples.map(({ q, card }) => (
          <li key={q} className={cn(ruleRow, "flex min-w-0 flex-col gap-0.5")}>
            <a href={searchPath(q)} onClick={onPick} className={cn(nameLink, "w-fit underline decoration-input hover:decoration-foreground")}>
              {q}
            </a>
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="min-w-0 break-words">
                from {card.skill}, {askedTimes(card.count)}
              </span>
              {card.shelf.demo && <DemoChip />}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
