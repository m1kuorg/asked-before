// The shelf's cards, most asked first (cards.list's order): a segmented
// filter by status, kept in the address as ?status= (replaced, so Back
// leaves the shelf, and a reload or a shared link keeps it), then one row per card with its skill, status pill, times
// asked, months, and its ask span on an axis every row shares. The whole row
// opens the card; the link itself is the skill, so a screen reader hears the
// card's name, then the rest as the row's text. A list, not a table, so the
// row can be one link; the column labels above it are for the eye, and each
// cell says what it is to assistive technology. Below 640px a row is two lines
// and the strip.
//
// With no cards, the empty state says why, from the first page of uploads:
// nothing uploaded, a sort under way (with a link to watch it), or nothing
// asked twice yet. A filter with no cards says so in one sentence.

import type { Card, CardStatus, Shelf, Upload } from "@asked-before/sdk";
import { cn } from "cn";
import { AskStrip, askAxis } from "@/components/ask-strip";
import { Figure } from "@/components/figure";
import { StatusPill } from "@/components/status-pill";
import { Time } from "@/components/time";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { STATUS_WORDS } from "@/lib/copy";
import { count, shortMonths } from "@/lib/format";
import { cardPath, sorting, uploadPath, viewPath, watchPath } from "@/screens/shelf/data";
import { SortingLine } from "@/screens/shelf/sorting-line";

export type Filter = "all" | CardStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "borrowed", label: STATUS_WORDS.borrowed },
  { value: "returned", label: STATUS_WORDS.returned },
  { value: "borrowed_again", label: STATUS_WORDS.borrowed_again },
];

/** The filter a ?status= names: a card status, or else all of them. */
export const filterOf = (status: string | null): Filter => FILTERS.find(({ value }) => value === status)?.value ?? "all";

// Skill, status, times asked, months, the strip. 640px and up: one line.
const ROW = "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_4.5rem_9.5rem_minmax(7rem,2fr)] sm:gap-x-6";

type CardsViewProps = { shelf: Shelf; cards: Card[]; uploads: Upload[]; filter: Filter; setFilter: (filter: Filter) => void };

export function CardsView({ shelf, cards, uploads, filter, setFilter }: CardsViewProps) {
  if (!cards.length) return <NoCards shelf={shelf} uploads={uploads} />;

  // One axis for every row, filtered or not, so a filter never moves the strips.
  const axis = askAxis(cards.map((card) => card.firstBorrowAt));
  const axisStart = new Date(axis.from).toISOString();
  const shown = filter === "all" ? cards : cards.filter((card) => card.status === filter);
  const under = sorting(uploads);

  return (
    <div className="flex flex-col gap-4">
      {under && <SortingLine shelf={shelf} upload={under} more="cards" />}
      <div className="-mx-4 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0">
        <ToggleGroup aria-label="Show cards by status" value={[filter]} onValueChange={(value) => value[0] && setFilter(value[0] as Filter)}>
          {FILTERS.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className="gap-2 max-sm:gap-1 max-sm:px-2 max-sm:text-xs">
              {label}{" "}
              <span className="text-muted-foreground tabular-nums">{count(value === "all" ? cards.length : cards.filter((card) => card.status === value).length)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div>
        <div aria-hidden="true" className={`hidden h-9 items-center border-b border-border text-xs text-muted-foreground sm:grid ${ROW}`}>
          <span>Card</span>
          <span>Status</span>
          <span className="text-right">Times asked</span>
          <span>First and last ask</span>
          <span className="flex justify-between gap-2">
            <span>{shortMonths(axisStart, axisStart)}</span>
            <span>Today</span>
          </span>
        </div>
        {shown.length ? (
          <ul aria-label={`Cards on ${shelf.name}, most asked first`}>
            {shown.map((card) => (
              <CardRow key={card.id} card={card} axis={axis} />
            ))}
          </ul>
        ) : (
          <p className="border-b border-rule py-4 text-sm text-muted-foreground">{filterEmpty(filter, shelf.name, cards)}</p>
        )}
      </div>
    </div>
  );
}

function CardRow({ card, axis }: { card: Card; axis: ReturnType<typeof askAxis> }) {
  return (
    <li
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-rule py-3 last:border-0 has-[a:focus-visible]:rounded-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring sm:min-h-12 sm:py-2 ${ROW}`}
    >
      <a
        href={cardPath(card.id)}
        className="min-w-0 font-medium break-words group-hover:underline group-hover:underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
      >
        {card.skill}
      </a>
      <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-auto sm:row-auto">
        <StatusPill status={card.status} />
        {card.status === "borrowed_again" && (
          <span className="text-xs text-muted-foreground">
            {"asked again "}
            <Time iso={card.lastBorrowAt} />
          </span>
        )}
      </span>
      <span className="col-start-2 row-start-1 text-right sm:col-auto sm:row-auto">
        <Figure n={card.count} />
        <span className="sr-only"> times asked</span>
      </span>
      <span className="col-start-2 row-start-2 text-right text-xs text-muted-foreground sm:col-auto sm:row-auto sm:text-left sm:text-sm">
        {shortMonths(card.firstBorrowAt, card.lastBorrowAt)}
      </span>
      <AskStrip axis={axis} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} showCount={false} className="col-span-2 sm:col-auto" />
    </li>
  );
}

/** One sentence for a filter that holds no card, true to the shelf's other cards. */
function filterEmpty(filter: Filter, name: string, cards: Card[]): string {
  if (filter === "borrowed") return `Every card on ${name} has been proven at least once.`;
  if (filter === "borrowed_again") return `No card on ${name} has been asked again since it was proven.`;
  return cards.some((card) => card.status === "borrowed_again")
    ? `No card on ${name} stays Proven right now: each one you proved was asked again since.`
    : `No card on ${name} is proven yet. A card is marked Proven the day you pass a cold rep on it.`;
}

/** A shelf with no cards: nothing uploaded, a sort under way, or nothing asked twice yet. Its links are the only ones in the frame. */
function NoCards({ shelf, uploads }: { shelf: Shelf; uploads: Upload[] }) {
  const under = sorting(uploads);
  const upload = (
    <a href={uploadPath(shelf.id)} className={cn(buttonVariants({ variant: "secondary" }))}>
      Upload a chat export
    </a>
  );
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No cards yet</EmptyTitle>
        <EmptyDescription>
          {!uploads.length
            ? "Upload a chat export onto this shelf, and every question you asked more than once becomes a card."
            : under
              ? `Your upload into ${shelf.name} is still being sorted. Its cards show here once the sort is done.`
              : `Nothing in ${shelf.name} has been asked more than once yet. A message waits as not on a card until a later one asks the same thing.`}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {!uploads.length ? (
          upload
        ) : under ? (
          <a href={watchPath(shelf.id, under.id)} className={cn(buttonVariants({ variant: "secondary" }))}>
            See its sort
          </a>
        ) : (
          <>
            <a href={viewPath(shelf.id, "once")} className={cn(buttonVariants({ variant: "secondary" }))}>
              See the messages not on a card
            </a>
            {upload}
          </>
        )}
      </EmptyContent>
    </Empty>
  );
}
