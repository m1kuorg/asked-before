// "Next on your path", the panel above the map, and "Placed by the words in
// its name" beside it. The panel names the first area on the path holding a
// card that needs a cold rep, and its most asked such card as a white row
// card with its ask strip (which needs white), "asked 3 times", its pill,
// and Home's one-click "Start a cold rep" (?rep=start), the screen's one
// filled primary. With every card on the path proven, it says so; with no
// card at all, what's true and the ways to a first card. The rule block says
// how code places a card, so the map's "its name says" lines read as the
// rule they are.
import type { Client, Roadmap } from "@asked-before/sdk";
import { cn } from "cn";
import { AskStrip, askAxis } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { StatusPill } from "@/components/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { COLD_REP_GLOSS, START_REP, startRepName } from "@/lib/copy";
import { Panel, nameLink, rowCard } from "@/screens/home/panel";
import { DemoShelfButton } from "@/screens/shelves/demo-shelf-button";
import { nextOnPath, onPath } from "./sentences";

const GLOSS = `${COLD_REP_GLOSS.charAt(0).toUpperCase()}${COLD_REP_GLOSS.slice(1)}.`;

type NextProps = { map: Roadmap; client: Client; navigate: (path: string) => void; className?: string };

export function NextOnPath({ map, client, navigate, className }: NextProps) {
  const next = nextOnPath(map);
  if (!next) {
    const cards = onPath(map).length + map.elsewhere.length;
    return (
      <Panel title="Next on your path" className={className}>
        {cards === 0 ? (
          <Empty className="items-start text-left">
            <EmptyHeader className="items-start">
              <EmptyTitle>No card is on the path yet.</EmptyTitle>
              <EmptyDescription>A card appears once a shelf's uploads hold the same question twice, and the words in its name place it on an area below.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap items-start">
              <DemoShelfButton client={client} navigate={navigate} />
              <ButtonLink href="/app/shelves" variant="secondary">
                Go to your shelves
              </ButtonLink>
            </EmptyContent>
          </Empty>
        ) : (
          <p className="text-sm text-muted-foreground">
            {onPath(map).length
              ? "Nothing on the path needs a cold rep: every card on it is proven. A card comes back here when you ask it again."
              : "None of your cards is on the path, so nothing here needs a cold rep. They're listed under the map."}
          </p>
        )}
      </Panel>
    );
  }

  const { area, card } = next;
  const cardPath = `/app/cards/${encodeURIComponent(card.id)}`;
  return (
    <Panel title="Next on your path" description={`${area.name} is the first area on the path with a card that needs a cold rep. ${GLOSS}`} className={className}>
      <div className="@container/next">
        <div className={cn(rowCard, "flex flex-col gap-3 @min-[36rem]/next:flex-row @min-[36rem]/next:items-center @min-[36rem]/next:gap-4")}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <a href={cardPath} className={cn(nameLink, "line-clamp-2 break-words")}>
              {card.skill}
            </a>
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{card.shelf.name}</span>
              {card.shelf.demo && <DemoChip />}
              <StatusPill status={card.status} />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AskStrip axis={askAxis([card.firstBorrowAt])} first={card.firstBorrowAt} last={card.lastBorrowAt} count={card.count} provenAt={card.returnedAt} showCount={false} className="w-24 flex-1 @min-[36rem]/next:flex-none" />
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              asked <Figure n={card.count} className="font-medium text-foreground" /> {card.count === 1 ? "time" : "times"}
            </span>
          </div>
          <ButtonLink href={`${cardPath}?rep=start`} aria-label={startRepName(card.skill)} className="@min-[36rem]/next:self-center">
            {START_REP}
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

/** The panel at its real size while the roadmap loads. */
export function NextLoading({ className }: { className?: string }) {
  return (
    <Panel title="Next on your path" description={GLOSS} className={className}>
      <div aria-hidden="true" className={cn(rowCard, "flex items-center gap-4")}>
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="hidden h-1 w-28 sm:block" />
        <Skeleton className="h-10 w-36" />
      </div>
    </Panel>
  );
}

/** How a card is placed, beside the panel: a rail block on the white ground, with no frame. */
export function PlacingRule({ className }: { className?: string }) {
  return (
    <section aria-labelledby="placing-rule" className={cn("flex flex-col gap-1 py-1", className)}>
      <h2 id="placing-rule" className="text-sm font-semibold">
        Placed by the words in its name
      </h2>
      <p className="text-sm text-muted-foreground">
        Code splits each card's skill name into words and puts the card on the area whose list holds the most of them, the earlier area on a tie. The model only named the skill; it never picks the area. A name with
        none of the words stays off the path.
      </p>
    </section>
  );
}
