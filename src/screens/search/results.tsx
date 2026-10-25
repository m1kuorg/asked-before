// Search's two answers under its sentence (plan section 3): the cards the
// matches are on, then the matching messages. Cards are white row cards on
// the panel, since each holds its ask strip (a span on one axis shared by
// every row), with its shelf, how many of its messages match, and its
// status pill; a card only its name matched says so. Messages are rule
// rows, newest first, word for word with the words marked, each with its
// date and a link to its card, or to its shelf's messages not on a card.
import type { SearchAnswer, SearchCard, SearchPhrasing } from "@asked-before/sdk";
import { cn } from "cn";
import { AskStrip, askAxis, type Axis } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { StatusPill } from "@/components/status-pill";
import { Time } from "@/components/time";
import { Skeleton } from "@/components/ui/skeleton";
import { NOT_ON_A_CARD } from "@/lib/copy";
import { count, plural } from "@/lib/format";
import { Panel, nameLink, rowCard, ruleRow } from "@/screens/home/panel";
import { Marked } from "./marked";

const cardPath = (id: string) => `/app/cards/${encodeURIComponent(id)}`;
const unsortedPath = (shelfId: string) => `/app/shelves/${encodeURIComponent(shelfId)}?view=once`;

// From 40rem of panel: four columns shared by every row through a subgrid, so every strip starts and ends on one x.
const columns = "@min-[40rem]/rows:grid @min-[40rem]/rows:grid-cols-[minmax(0,1.7fr)_minmax(6rem,1fr)_auto_auto] @min-[40rem]/rows:gap-x-4";
const row = "@min-[40rem]/rows:col-span-full @min-[40rem]/rows:grid-cols-subgrid";

export function CardsFound({ answer }: { answer: SearchAnswer }) {
  const { cards } = answer;
  const named = cards.filter((found) => found.matches === 0).length;
  const ranked = "Most matching messages first, with how many of each card's messages have the words.";
  const description = !cards.length
    ? "No card holds these messages yet. A card appears once you've asked the same thing twice."
    : named === cards.length
      ? named === 1
        ? "Its name has every word, though none of its messages does."
        : "Their names have every word, though none of their messages does."
      : named
        ? `${ranked} ${plural(named, "card")} matched by ${named === 1 ? "its name" : "their names"} alone.`
        : ranked;
  return (
    <Panel title="Cards" description={description}>
      {cards.length > 0 && <CardRows cards={cards} words={answer.words} />}
    </Panel>
  );
}

function CardRows({ cards, words }: { cards: SearchCard[]; words: string[] }) {
  const axis = askAxis(cards.map(({ card }) => card.firstBorrowAt));
  return (
    <div className="@container/rows">
      <ol aria-label="Cards with the words, most matches first" className={cn("flex flex-col gap-2", columns)}>
        {cards.map((found) => (
          <CardRow key={found.card.id} found={found} axis={axis} words={words} />
        ))}
      </ol>
    </div>
  );
}

function CardRow({ found: { card, matches }, axis, words }: { found: SearchCard; axis: Axis; words: string[] }) {
  return (
    <li className={cn(rowCard, row, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2")}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <a href={cardPath(card.id)} className={cn(nameLink, "line-clamp-2")}>
          <Marked text={card.skill} words={words} />
        </a>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{card.shelf.name}</span>
          {card.shelf.demo && <DemoChip />}
        </span>
      </div>
      <StatusPill status={card.status} className="justify-self-end @min-[40rem]/rows:order-last" />
      <AskStrip axis={axis} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} />
      <span className="text-right text-sm whitespace-nowrap text-muted-foreground tabular-nums">
        {matches === 0 ? "its name matches" : matches === card.count ? `all ${count(matches)} match` : `${count(matches)} of ${count(card.count)} match`}
      </span>
    </li>
  );
}

export function MessagesFound({ answer }: { answer: SearchAnswer }) {
  const { phrasings, total, words } = answer;
  return (
    <Panel
      title="Your messages"
      description={total ? "Newest first, word for word, with the words marked." : "None of your messages has every word."}
      footer={
        phrasings.length < total && (
          <p className="text-sm text-muted-foreground">
            Showing the newest {count(phrasings.length)} of {count(total)}.
          </p>
        )
      }
    >
      {phrasings.length > 0 && (
        <ol aria-label="Messages with the words, newest first" className="flex flex-col">
          {phrasings.map((phrasing) => (
            <MessageRow key={phrasing.id} phrasing={phrasing} words={words} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

function MessageRow({ phrasing, words }: { phrasing: SearchPhrasing; words: string[] }) {
  const { card, shelf } = phrasing;
  return (
    <li className={cn(ruleRow, "flex min-w-0 flex-col gap-0.5 py-2.75")}>
      <p className="text-sm break-words">
        <Marked text={phrasing.text} words={words} />
      </p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <Time iso={phrasing.time} className="shrink-0" />
        <span aria-hidden="true">·</span>
        <a href={card ? cardPath(card.id) : unsortedPath(shelf.id)} className="max-w-full truncate underline-offset-4 hover:text-foreground hover:underline">
          {card ? card.skill : NOT_ON_A_CARD}
        </a>
        <span aria-hidden="true">·</span>
        <span className="max-w-full truncate">{shelf.name}</span>
        {shelf.demo && <DemoChip />}
      </p>
    </li>
  );
}

/** The two panels at their real size while the first answer comes. */
export function ResultsLoading() {
  return (
    <>
      <Panel title="Cards">
        <div aria-hidden="true" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className={cn(rowCard, "flex items-center gap-4")}>
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="hidden h-1 w-40 sm:block" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Your messages">
        <div aria-hidden="true" className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(ruleRow, "flex flex-col gap-2")}>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
