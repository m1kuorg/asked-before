// Roadmap (/app/roadmap; roadmap.get()). Its question: where on a
// developer's path are the things I can't yet do alone? The h1 is a
// sentence from the data ("5 cards need a cold rep, across 5 areas of the
// path."), over a grey line naming how many cards and from which shelves,
// with Demo data on a demo shelf (m1kuorg/basics#79).
//
// The grid: a centred 1100px column of 12 (77px columns, 16px gutters), as
// Home's. First 8 + 4 (729 + 16 + 355): "Next on your path", the first area
// holding a card that needs a cold rep and its most asked one with the
// screen's one "Start a cold rep", beside how code places a card. Then the
// path at full width (path-map.tsx): its key in the house pills, with the
// cards on the path counted by status, then the map, the spine in path
// order with every area on it, empty ones too, beside a tick index. Then
// the cards that aren't on the path. Below a 1100px canvas the two blocks
// stack, and below a 56rem map the map is an indented tree.
import type { Roadmap as RoadmapData, Shelf } from "@asked-before/sdk";
import { cn } from "cn";
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { Figure } from "@/components/figure";
import { StatusPill } from "@/components/status-pill";
import { WaitLine } from "@/components/wait-line";
import { count, plural } from "@/lib/format";
import { NextLoading, NextOnPath, PlacingRule } from "./roadmap/next";
import { OffPath } from "./roadmap/off-path";
import { PathMap, PathMapLoading } from "./roadmap/path-map";
import { headline, onPath } from "./roadmap/sentences";

const eight = "@min-[68.75rem]/roadmap:col-span-8";
const four = "@min-[68.75rem]/roadmap:col-span-4";

export function Roadmap({ client, navigate }: ScreenProps) {
  const map = useResource(() => client.roadmap.get(), []);

  if (map.error !== null && !map.data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl">Roadmap</h1>
        <ErrorNotice error={map.error} title="Your roadmap didn't load." onRetry={map.retry} />
      </div>
    );
  }

  const data = map.data;
  const cards = data ? onPath(data).cards + data.elsewhere.counts.cards : 0;
  return (
    <div className="@container/roadmap flex flex-col">
      <h1 className="line-clamp-2 text-2xl text-pretty">
        {data ? (
          headline(data)
        ) : (
          <>
            <span className="sr-only">Roadmap</span>
            <span aria-hidden="true" className="my-1 block h-6 w-full max-w-96 rounded-md bg-border" />
          </>
        )}
      </h1>
      {data ? <Subline map={data} /> : <WaitLine className="mt-1">Placing your cards on the path…</WaitLine>}

      <div className="mt-8 grid grid-cols-1 gap-4 @min-[68.75rem]/roadmap:grid-cols-12">
        {data ? <NextOnPath map={data} client={client} navigate={navigate} className={eight} /> : <NextLoading className={eight} />}
        <PlacingRule className={four} />
      </div>

      <section aria-labelledby="the-path" className="@container/map mt-12 flex flex-col gap-6">
        <div className="flex flex-col gap-3 @min-[56rem]/map:flex-row @min-[56rem]/map:items-end @min-[56rem]/map:justify-between">
          <div className="flex max-w-xl flex-col gap-1">
            <h2 id="the-path" className="text-base font-medium">
              The path
            </h2>
            <p className="text-sm text-muted-foreground">
              {data ? `${count(data.areas.length)} areas` : "Its areas"} in a fixed order, from the terminal to deploying. An area with no card stays on it, and nothing on it is locked.
            </p>
          </div>
          {data && <Key counts={onPath(data)} />}
        </div>
        {data ? <PathMap areas={data.areas} shelves={data.shelves.length > 1} /> : <PathMapLoading />}
      </section>

      {data && cards > 0 && (
        <div className="mt-12">
          <OffPath elsewhere={data.elsewhere} />
        </div>
      )}
    </div>
  );
}

/** "5 cards on the path, from Demo [Demo data]." */
function Subline({ map }: { map: RoadmapData }) {
  const placed = onPath(map).cards;
  const elsewhere = map.elsewhere.counts.cards;
  if (!placed && !elsewhere) {
    return <p className="mt-1 text-sm text-muted-foreground">Every question you've asked a chatbot more than once becomes a card, and the words in its name place it on the path.</p>;
  }
  const { shelves } = map;
  const off = elsewhere ? `, ${count(elsewhere)} off it` : "";
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {plural(placed, "card")} on the path{off}, from{" "}
      {shelves.length > 3
        ? `${count(shelves.length)} shelves`
        : shelves.map((shelf, i) => (
            <span key={shelf.id}>
              {i > 0 && (i === shelves.length - 1 ? " and " : ", ")}
              {shelf.name}
              {shelf.demo && <DemoChip className="ml-1.5 align-text-bottom" />}
            </span>
          ))}
      .
    </p>
  );
}

/** The map's key: the house pills, each with how many cards on the path it marks, and what the connectors mean. */
function Key({ counts }: { counts: Shelf["counts"] }) {
  const counted = { borrowed: counts.borrowed, returned: counts.returned, borrowed_again: counts.borrowedAgain };
  return (
    <div className="flex flex-col gap-2 @min-[56rem]/map:items-end">
      <dl aria-label="Cards on the path, by status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(["borrowed", "returned", "borrowed_again"] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <dt>
              <StatusPill status={status} />
            </dt>
            <dd className="text-sm">
              <Figure n={counted[status]} />
            </dd>
          </div>
        ))}
      </dl>
      <p className={cn("hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", counts.cards > 0 && "@min-[56rem]/map:flex")}>
        <span className="flex items-center gap-1.5">
          <Connector proven />
          to a proven card
        </span>
        <span className="flex items-center gap-1.5">
          <Connector />
          to one that needs a cold rep
        </span>
      </p>
    </div>
  );
}

/** A connector as the map draws it, scaled down: the line and the station's dot. */
function Connector({ proven = false }: { proven?: boolean }) {
  return (
    <svg aria-hidden="true" width="26" height="10" viewBox="0 0 26 10" className="shrink-0">
      <line x1="0" x2="16" y1="5" y2="5" strokeWidth={1} strokeDasharray={proven ? undefined : "3 2"} className={proven ? "stroke-primary" : "stroke-edge"} />
      <circle cx="21" cy="5" r="4.25" strokeWidth={1.5} className={proven ? "fill-primary stroke-primary" : "fill-background stroke-input"} />
    </svg>
  );
}
