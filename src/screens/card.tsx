// A card (/app/cards/:cardId, ?rep=start; cards.get, then shelves.get, then
// reps.start and reps.check; m1kuorg/basics#74): can I do this without AI?
// The skill and its status, the ask strip with every ask, then 7 + 5 columns
// on the 12-column canvas (7 x 77 + 6 x 16 = 635, 16, 5 x 77 + 4 x 16 = 449:
// 1100): the cold rep panel, and every time you asked; then the earlier cold
// reps, under the panel. Below an 896px canvas they stack.
//
// Opening a card spends no model request. ?rep=start (Home's "Start cold
// rep", a pass's "Next") is dropped from the address with a replace at once,
// and carried across it to the card page that mounts next, which starts one
// rep when the card is here, unless one is open already.
import type { CardDetail } from "@asked-before/sdk";
import { useEffect, useLayoutEffect, useRef } from "react";
import { notFound, type ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { StatusPill } from "@/components/status-pill";
import { WaitLine } from "@/components/wait-line";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/client";
import { months, plural } from "@/lib/format";
import { Asks } from "@/screens/card/asks";
import { CardStrip } from "@/screens/card/card-strip";
import { EarlierReps } from "@/screens/card/earlier-reps";
import { RepPanel } from "@/screens/card/rep-panel";

// The rep panel, then every ask beside it spanning both rows, then the
// earlier reps under the panel: the second row takes the slack, so the earlier
// reps sit right under the panel however long the asks run. One column,
// in that order, below an 896px canvas.
const GRID = "grid grid-cols-1 items-start gap-8 @4xl:grid-cols-12 @4xl:grid-rows-[auto_1fr] @4xl:gap-x-4";

/** The card a ?rep=start link asked to start a rep on, read once by the card page that mounts after the replace. */
let startFromLink: string | null = null;
/** Whether the loading h1 had focus as it left (the router focuses it on arrival), so the card's own h1 takes focus on. */
let waitingHadFocus = false;

export function Card(props: ScreenProps<"cardId">) {
  if (props.query.get("rep") === "start") return <DropRepStart {...props} />;
  return <CardPage {...props} />;
}

/** Drops ?rep=start from the address (a replace, so a reload or Back can't start another rep), keeping the wish for the page that mounts next. */
function DropRepStart({ params, query, navigate }: ScreenProps<"cardId">) {
  useEffect(() => {
    startFromLink = params.cardId;
    const rest = new URLSearchParams(query);
    rest.delete("rep");
    navigate(`${location.pathname}${rest.size ? `?${rest}` : ""}${location.hash}`, { replace: true });
  }, [params.cardId, query, navigate]);
  return <Waiting />;
}

function CardPage({ client, params, setTitle, signal }: ScreenProps<"cardId">) {
  const loaded = useResource(async () => {
    const card = await client.cards.get(params.cardId);
    return { card, shelf: await client.shelves.get(card.shelfId) };
  }, [params.cardId]);
  const autoStart = useRef(false);
  useEffect(() => {
    if (startFromLink !== params.cardId) return;
    startFromLink = null;
    autoStart.current = true;
  }, [params.cardId]);
  const skill = loaded.data?.card.skill;
  useEffect(() => {
    if (skill) setTitle(skill);
  }, [skill, setTitle]);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!skill || !waitingHadFocus) return;
    waitingHadFocus = false;
    heading.current?.focus();
  }, [skill]);
  if (isNotFound(loaded.error)) notFound();

  if (!loaded.data) {
    if (loaded.error === null) return <Waiting />;
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Card</h1>
        <ErrorNotice error={loaded.error} title="This card didn't load." onRetry={loaded.retry} />
      </div>
    );
  }

  const { card, shelf } = loaded.data;
  const span = months(card.firstBorrowAt, card.lastBorrowAt);
  const update = (change: (card: CardDetail) => CardDetail) => loaded.setData((now) => now && { ...now, card: change(now.card) });

  return (
    <div className="@container flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 ref={heading} tabIndex={-1} className="line-clamp-2 min-w-0 text-2xl font-semibold break-words">
              {card.skill}
            </h1>
            <StatusPill status={card.status} />
          </div>
          <p className="text-muted-foreground">
            Asked {plural(card.count, "time")}
            {span.startsWith("in ") ? " " : ", "}
            {span}, in{" "}
            <a href={`/app/shelves/${encodeURIComponent(shelf.id)}`} className="text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground">
              {shelf.name}
            </a>
            {shelf.demo && (
              <>
                {" "}
                <DemoChip className="align-text-bottom" />
              </>
            )}
          </p>
        </header>
        <CardStrip card={card} />
      </div>
      <div className={GRID}>
        <RepPanel client={client} card={card} shelf={shelf} update={update} autoStart={autoStart} signal={signal} className="@4xl:col-span-7" />
        <Asks asks={card.borrows} className="@4xl:col-span-5 @4xl:row-span-2 @4xl:pt-5 @4xl:pl-4" />
        <EarlierReps reps={card.reps} skill={card.skill} className="@4xl:col-span-7" />
      </div>
    </div>
  );
}

/** The card page's layout while the card is on its way: its headings, and flat bars where the data goes. */
function Waiting() {
  const heading = useRef<HTMLHeadingElement>(null);
  // Runs as it goes, before its h1 leaves the page.
  useLayoutEffect(() => () => void (waitingHadFocus = heading.current === document.activeElement), []);
  return (
    <div className="@container flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <h1 ref={heading} className="text-2xl font-semibold">
            Card
          </h1>
          <WaitLine className="h-5">Finding the card…</WaitLine>
        </header>
        <div aria-hidden="true" className="flex flex-col gap-1">
          <div className="flex h-5 items-center">
            <Skeleton className="h-0.5 w-full" />
          </div>
          <div className="h-4" />
        </div>
      </div>
      <div className={GRID}>
        <section aria-labelledby="rep-title" className="flex flex-col gap-5 rounded-2xl bg-panel p-5 @4xl:col-span-7">
          <header className="flex flex-col gap-1">
            <h2 id="rep-title" className="text-base font-semibold">
              Prove it without AI
            </h2>
            <p className="text-muted-foreground">Answer without AI. A pass marks the card Proven.</p>
          </header>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </section>
        <section aria-labelledby="asks-title" className="flex flex-col gap-5 @4xl:col-span-5 @4xl:row-span-2 @4xl:pt-5 @4xl:pl-4">
          <h2 id="asks-title" className="text-base font-semibold">
            Every time you asked
          </h2>
          <div aria-hidden="true" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 border-b border-rule py-3.5 last:border-0">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
