// Home (/app, /app/desk; desk.get() and shelves.list()). Its question: what
// should I prove next? The greeting is the h1, built from the data ("4 cards
// need a cold rep, 1 is proven."), over a grey line naming the shelves and
// the last ask (brief sections 4 and 7; taste-sheet-app.md, "home").
//
// The grid: a centred 1100px column of 12 columns, 77px wide with 16px
// gutters (12 x 77 + 11 x 16 = 1100). The four tiles take 3 columns each,
// then Prove next and Your shelves take 9 + 3 (821 + 16 + 263 = 1100), then
// Latest asks and Latest proven 6 + 6 (542 + 16 + 542 = 1100), so every
// internal edge meets one above it. Below a 1100px canvas the 9 + 3 and the
// 6 + 6 stack; on a phone the tiles are 2 x 2.
//
// Each panel keeps its own height (app-screens section 4.2, align-items:
// start): Prove next runs 1 to 10 rows beside a learner's few shelves, and
// the ten latest asks sit beside only the passes there are. Stretching the
// short one would leave a tinted band as tall as six rows.
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

const nine = "@min-[68.75rem]/home:col-span-9";
const three = "@min-[68.75rem]/home:col-span-3 @min-[68.75rem]/home:self-start";
const six = "@min-[68.75rem]/home:col-span-6 @min-[68.75rem]/home:self-start";

export function Home({ client, navigate }: ScreenProps) {
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
        {data ? <ProveNext desk={data} empty={empty} className={nine} /> : <ProveNextLoading className={nine} />}
        <YourShelves shelves={shelves} className={three} />
        {data ? <LatestAsks asks={data.latestBorrows} className={six} /> : <LatestLoading title="Latest asks" rows={3} className={six} />}
        {data ? <LatestProven cards={data.latestReturns} className={six} /> : <LatestLoading title="Latest proven" rows={1} className={six} />}
      </div>
    </div>
  );
}
