// The path, a roadmap.sh-like map rebuilt in the house style. In the DOM it
// is an ordered list of the areas in path order, each with its name, its
// count, what it covers, a list of its cards, and the sentence where it
// ends, so it reads in order with no drawing at all. The drawing is CSS
// around that list, aria-hidden by nature (borders and pseudo-elements):
//
// From a 56rem map (a desktop canvas), each area is one row of three
// columns, what it covers (1fr) beside its node (13rem) beside its cards
// (1.5fr). A 2px plum-black spine runs down the nodes' column; each node is
// a white 12px card with a 1px edge, an empty one a dashed frame saying no
// card is on it. Cards hang off the node's right edge as stations: a 1px
// dashed connector in the quiet edge grey, solid plum-black to a Proven
// card, ending at a 10px dot, then the skill, "asked 9 times", why it's
// here, and its status pill, the one status mark on the row. The node is
// 58px tall (1 + 10 + 20 + 16 + 10 + 1), so the cards' list starts 11px
// down and each card's first line, 18px into its row, meets the node's
// middle at 29px. A sticky tick index of the areas runs down the right
// edge, the area in view marked.
//
// Narrower (a phone, or a canvas beside the sidebar under 56rem), the same
// list is an indented tree: the spine down the left edge with a ring on it
// at each area's 16/500 heading, and the cards as rule rows with their pill
// at the right. Either way an area shows its 5 most asked cards, and a
// button shows the rest in place.
import type { RoadmapArea, RoadmapCard } from "@asked-before/sdk";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { askedTimes, count } from "@/lib/format";
import { areaCount, areaEnd, because } from "./sentences";

const cardPath = (id: string) => `/app/cards/${encodeURIComponent(id)}`;

// Literal class names throughout, so Tailwind finds them in this file.

/** An area: a tree row on a phone, three columns on the wide map; the phone's spine is its ::before, the last one's stopping at its ring. */
const areaRow = cn(
  "relative grid scroll-mt-16 grid-cols-1 pb-6 pl-8 [grid-template-areas:'node'_'about'_'cards'_'end']",
  "before:absolute before:top-0 before:bottom-0 before:left-1.75 before:w-0.5 before:bg-primary last:before:bottom-auto last:before:h-3",
  "@min-[56rem]/map:grid-cols-[minmax(0,1fr)_13rem_minmax(0,1.5fr)] @min-[56rem]/map:pb-8 @min-[56rem]/map:pl-0 @min-[56rem]/map:[grid-template-areas:'about_node_cards'_'about_node_end'] @min-[56rem]/map:before:hidden",
);

/** The node's cell: on the wide map it spans the row, and its ::before is the spine, down through the row's foot to the next node, painted under the node. */
const nodeCell = cn(
  "relative [grid-area:node]",
  "@min-[56rem]/map:before:absolute @min-[56rem]/map:before:top-0 @min-[56rem]/map:before:-bottom-8 @min-[56rem]/map:before:left-1/2 @min-[56rem]/map:before:w-0.5 @min-[56rem]/map:before:-translate-x-1/2 @min-[56rem]/map:before:bg-primary",
  "@min-[56rem]/map:group-last/area:before:hidden",
);

/** The node: a heading with a ring on the phone's spine; a white card on the wide map, painted over the spine. */
const node = cn(
  "relative flex flex-col gap-0.5",
  "before:absolute before:top-1.5 before:-left-7.5 before:size-3 before:rounded-full before:border-2 before:bg-background",
  "@min-[56rem]/map:items-center @min-[56rem]/map:rounded-xl @min-[56rem]/map:border @min-[56rem]/map:bg-background @min-[56rem]/map:px-4 @min-[56rem]/map:py-2.5 @min-[56rem]/map:text-center @min-[56rem]/map:before:hidden",
);

/** A card on the path: a rule row on the phone; on the wide map a station, its connector the ::before (the bus down the cards) and ::after (the stub to its dot). */
const station = cn(
  "relative flex items-start gap-3 border-b border-rule py-2.5 last:border-b-0",
  "@min-[56rem]/map:border-b-0 @min-[56rem]/map:py-2 @min-[56rem]/map:pl-12",
  "@min-[56rem]/map:before:absolute @min-[56rem]/map:before:top-0 @min-[56rem]/map:before:bottom-0 @min-[56rem]/map:before:left-4 @min-[56rem]/map:before:border-l @min-[56rem]/map:before:border-dashed @min-[56rem]/map:before:border-edge",
  "@min-[56rem]/map:first:before:top-4.5 @min-[56rem]/map:last:before:bottom-auto @min-[56rem]/map:last:before:h-4.5 @min-[56rem]/map:only:before:hidden",
  "@min-[56rem]/map:after:absolute @min-[56rem]/map:after:top-4.5 @min-[56rem]/map:after:left-4 @min-[56rem]/map:after:w-3 @min-[56rem]/map:after:border-t @min-[56rem]/map:after:border-dashed @min-[56rem]/map:after:border-edge",
  "@min-[56rem]/map:first:after:left-0 @min-[56rem]/map:first:after:w-7",
);

/** The connector to a Proven card: solid plum-black. */
const provenLine = "@min-[56rem]/map:after:border-solid @min-[56rem]/map:after:border-primary";

export function PathMap({ areas }: { areas: RoadmapArea[] }) {
  const shelves = new Set(areas.flatMap((area) => area.cards.map((card) => card.shelf.id))).size;
  return (
    <div className="grid grid-cols-1 gap-4 @min-[56rem]/map:grid-cols-[minmax(0,1fr)_2rem]">
      <ol aria-label="Areas, in path order" className="flex flex-col">
        {areas.map((area) => (
          <Area key={area.id} area={area} shelves={shelves > 1} />
        ))}
      </ol>
      <AreaIndex areas={areas} />
    </div>
  );
}

/** How many cards an area shows before the rest wait behind "Show all". */
const SHOWN = 5;

/** `shelves`: the map holds cards from more than one shelf, so each says which. */
function Area({ area, shelves }: { area: RoadmapArea; shelves: boolean }) {
  const empty = area.cards.length === 0;
  const [all, setAll] = useState(false);
  const listId = `area-${area.id}-cards`;
  const cards = all ? area.cards : area.cards.slice(0, SHOWN);
  return (
    <li id={`area-${area.id}`} className={cn(areaRow, "group/area")}>
      <div className={nodeCell}>
        <div className={cn(node, empty ? "before:border-input @min-[56rem]/map:border-dashed @min-[56rem]/map:border-edge" : "before:border-primary @min-[56rem]/map:border-border")}>
          <h3 className={cn("text-base font-medium @min-[56rem]/map:text-sm @min-[56rem]/map:font-semibold", empty && "text-muted-foreground")}>
            {area.name}
          </h3>
          <p className="text-xs text-muted-foreground">{areaCount(area)}</p>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground [grid-area:about] @min-[56rem]/map:mt-0 @min-[56rem]/map:pt-2.75 @min-[56rem]/map:pr-6 @min-[56rem]/map:text-right">{area.about}</p>
      {!empty && (
        <>
          <ul id={listId} aria-label={`Cards on ${area.name}, most asked first`} className="mt-2 flex flex-col [grid-area:cards] @min-[56rem]/map:mt-0 @min-[56rem]/map:pt-2.75">
            {cards.map((card) => (
              <Station key={card.id} card={card} shelf={shelves} />
            ))}
          </ul>
          <div className="mt-1 flex flex-col items-start gap-1 [grid-area:end] @min-[56rem]/map:pl-12">
            {area.cards.length > SHOWN && (
              <Button variant="ghost" size="sm" aria-expanded={all} aria-controls={listId} onClick={() => setAll(!all)} className="-ml-3">
                {all ? "Show fewer" : `Show all ${count(area.cards.length)} cards on ${area.name}`}
              </Button>
            )}
            <p className="text-sm text-muted-foreground">{areaEnd(area)}</p>
          </div>
        </>
      )}
    </li>
  );
}

function Station({ card, shelf }: { card: RoadmapCard; shelf: boolean }) {
  const proven = card.status === "returned";
  return (
    <li className={cn(station, proven && provenLine)}>
      <span
        aria-hidden="true"
        className={cn("absolute top-3.25 left-7 hidden size-2.5 rounded-full border-[1.5px] @min-[56rem]/map:block", proven ? "border-primary bg-primary" : "border-input bg-background")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <a href={cardPath(card.id)} className="line-clamp-2 font-medium break-words text-foreground underline-offset-4 hover:underline">
          {card.skill}
        </a>
        <CardFacts card={card} shelf={shelf} />
      </div>
      <StatusPill status={card.status} />
    </li>
  );
}

/**
 * A card's facts under its skill: "asked 9 times · its name says “git” and
 * “commit”", each fact keeping its separator so no line ends on a dot; then,
 * on a line of its own, its shelf, when `shelf` asks for it or the shelf is
 * demo data, which is labeled wherever it shows.
 */
export function CardFacts({ card, why = true, shelf = true }: { card: RoadmapCard; why?: boolean; shelf?: boolean }) {
  return (
    <>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">{askedTimes(card.count)}</span>
        {why && card.matched.length > 0 && (
          <span>
            <span aria-hidden="true">· </span>
            {because(card)}
          </span>
        )}
      </p>
      {(shelf || card.shelf.demo) && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{card.shelf.name}</span>
          {card.shelf.demo && <DemoChip />}
        </p>
      )}
    </>
  );
}

/**
 * The right edge's index (The Thread's tick ruler): one tick per area, a
 * longer one where the area holds cards, and the area in view as a 2px
 * plum-black tick; each is a link to its area, named on hover and focus.
 * The area in view is the one the address names while it's on screen (a
 * link to an area near the foot can't bring it to the top), or else the
 * last whose top has passed 128px down the window, just under where a link
 * to one brings it.
 */
function AreaIndex({ areas }: { areas: RoadmapArea[] }) {
  const [current, setCurrent] = useState(areas[0]?.id);
  const ids = areas.map((area) => area.id).join();
  useEffect(() => {
    let frame = 0;
    const top = (id: string) => document.getElementById(`area-${id}`)?.getBoundingClientRect().top ?? Infinity;
    const update = () => {
      frame = 0;
      const named = areas.find((area) => location.hash === `#area-${area.id}`);
      if (named && top(named.id) >= 0 && top(named.id) < window.innerHeight) return setCurrent(named.id);
      let at = areas[0]?.id;
      for (const area of areas) if (top(area.id) <= 128) at = area.id;
      setCurrent(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("hashchange", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", onScroll);
      cancelAnimationFrame(frame);
    };
    // The areas only change with the answer, which the ids follow.
  }, [ids]);

  return (
    <nav aria-label="Areas on the path" className="hidden @min-[56rem]/map:block">
      <ol className="sticky top-9 flex flex-col">
        {areas.map((area) => {
          const here = area.id === current;
          return (
            <li key={area.id}>
              <a
                href={`#area-${area.id}`}
                aria-current={here ? "location" : undefined}
                className="group/tick relative flex h-6 w-8 items-center justify-end rounded-sm"
              >
                <span aria-hidden="true" className={cn("block", here ? "h-0.5 w-6 bg-primary" : area.cards.length ? "h-px w-4 bg-input" : "h-px w-2.5 bg-input")} />
                <span aria-hidden="true" className="pointer-events-none absolute right-full mr-2 hidden rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md group-hover/tick:block group-focus-visible/tick:block">
                  {area.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · <Figure n={area.counts.cards} /> {area.counts.cards === 1 ? "card" : "cards"}
                  </span>
                </span>
                <span className="sr-only">
                  {area.name}, {areaCount(area)}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The map at its real shape while the roadmap loads: five nodes on the spine. */
export function PathMapLoading() {
  return (
    <ol aria-hidden="true" className="flex flex-col">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={cn(areaRow, "group/area")}>
          <div className={nodeCell}>
            <div className={cn(node, "before:border-input @min-[56rem]/map:border-border")}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          </div>
          <div className="mt-1 [grid-area:about] @min-[56rem]/map:mt-0 @min-[56rem]/map:flex @min-[56rem]/map:justify-end @min-[56rem]/map:pt-2.75 @min-[56rem]/map:pr-6">
            <Skeleton className="h-3.5 w-48 max-w-full" />
          </div>
        </li>
      ))}
    </ol>
  );
}
