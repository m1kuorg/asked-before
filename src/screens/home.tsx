// Home (/app, /app/desk; desk.get() and shelves.list()). Its question: what
// should I prove next? The greeting is the h1, built from the data ("4 cards
// need a cold rep, 1 is proven."), over a grey line naming the shelves and
// the last ask (brief sections 4 and 7; taste-sheet-app.md, "home").
//
// The grid: a centred 1100px column of 12 columns, 77px wide with 16px
// gutters (12 x 77 + 11 x 16 = 1100). The four tiles take 3 columns each.
// Then 8 + 4 (729 + 16 + 355 = 1100): on the left, Prove next over Your
// shelves over Latest proven, the queue, where it comes from, and where it
// goes; on the right, Latest asks, the stream of your own words beside them
// (app-screens section 3.4: a right rail for recent items). The left column
// stacks the blocks whose sizes pull against each other (every card is
// either still to prove or proven), so it keeps nearly one height whatever
// the split, and the row stretches so both sides end level (section 4.2).
// Below a 1100px canvas everything stacks; on a phone the tiles are 2 x 2.
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { ErrorNotice } from "@/components/error-notice";
import { WaitLine } from "@/components/wait-line";
import { STATUS_NOTE } from "@/lib/copy";
import { AllProven, FirstVisit, NoCards } from "./home/empty";
import { LatestAsks, LatestLoading, LatestProven } from "./home/latest";
import { ProveNext, ProveNextLoading } from "./home/prove-next";
import { greeting, queueOf, subline } from "./home/sentences";
import { Tiles, TilesLoading } from "./home/tiles";
import { YourShelves } from "./home/your-shelves";

const eight = "flex min-w-0 flex-col gap-4 @min-[68.75rem]/home:col-span-8";
const four = "@min-[68.75rem]/home:col-span-4";

export function Home({ client, navigate, signal }: ScreenProps) {
  const desk = useResource(() => client.desk.get(), []);
  const shelves = useResource(() => client.shelves.list(), []);

  if (desk.error !== null && !desk.data) {
    return (
      <div className="flex flex-col gap-6 lg:pt-9">
        <h1 className="text-2xl">Home</h1>
        <ErrorNotice error={desk.error} title="Your cards didn't load." onRetry={desk.retry} />
      </div>
    );
  }

  const data = desk.data;
  const empty = data && (data.totals.cards === 0 ? data.shelves === 0 ? <FirstVisit client={client} navigate={navigate} /> : <NoCards /> : queueOf(data.totals) === 0 ? <AllProven /> : null);

  return (
    <div className="@container/home flex flex-col lg:pt-9">
      <h1 className="line-clamp-2 text-2xl">
        {data ? (
          greeting(data)
        ) : (
          <>
            <span className="sr-only">Home</span>
            <span aria-hidden="true" className="my-1 block h-6 w-full max-w-96 rounded-md bg-border" />
          </>
        )}
      </h1>
      {data ? <p className="mt-1 text-sm text-muted-foreground">{subline(data)}</p> : <WaitLine className="mt-1">Finding your cards…</WaitLine>}

      <div className="mt-12">{data ? <Tiles totals={data.totals} /> : <TilesLoading />}</div>
      <p className="mt-3 text-sm text-muted-foreground">{STATUS_NOTE}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 @min-[68.75rem]/home:grid-cols-12">
        <div className={eight}>
          {data ? <ProveNext desk={data} empty={empty} signal={signal} /> : <ProveNextLoading />}
          <YourShelves shelves={shelves} />
          {data ? <LatestProven cards={data.latestReturns} next={data.mostBorrowed[0]} className="flex-1" /> : <LatestLoading title="Latest proven" rows={1} className="flex-1" />}
        </div>
        {data ? <LatestAsks asks={data.latestBorrows} className={four} /> : <LatestLoading title="Latest asks" rows={3} className={four} />}
      </div>
    </div>
  );
}
