// The live thing: a headline you can type. The input is the section's
// headline, and as you type, the browser matches it against the demo
// history's five cards (match.ts); the matched card shows below at the app's
// own size, as a white app card labelled Demo data. Three examples refill
// the line. A screen reader hears the answer once typing pauses for half a
// second, not at every key. Nothing is sent anywhere.
import { useEffect, useId, useMemo, useState } from "react";
import { AskStrip } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Phrasing } from "@/components/phrasing";
import { Time } from "@/components/time";
import { DEMO_DATA } from "@/lib/copy";
import { months, plural } from "@/lib/format";
import type { DemoCard } from "../demo-card";
import { AsciiField } from "./ascii-field";
import { AXIS, CARDS } from "./demo";
import { closest, matcher } from "./match";

const PREFILL = "undo my last commit";
const EXAMPLES = ["center a div", "port 3000 already in use", "sort a list of dicts by key"];
const NO_MATCH = "No card in the demo history has those words. Upload your own export to see yours.";
const EMPTY = "Type a how-to you've asked, and see whether the demo history asks it too.";

const match = matcher(CARDS);

const askedLine = (card: DemoCard) => `Asked ${plural(card.borrows.length, "time")}, ${months(card.borrows[0]!.at, card.borrows.at(-1)!.at)}`;

export function ShowcaseChapter() {
  const [question, setQuestion] = useState(PREFILL);
  const card = useMemo(() => match(question), [question]);
  const shown = useMemo(() => (card ? closest(card, question, 3) : []), [card, question]);
  const titleId = useId();

  // What a screen reader hears when the answer changes: the card in words (the drawn card is a picture of it).
  const said = !question.trim() ? EMPTY : card ? `${card.skill}. ${askedLine(card)}. ${DEMO_DATA}.` : NO_MATCH;
  const [announced, setAnnounced] = useState(said);
  useEffect(() => {
    const pause = setTimeout(() => setAnnounced(said), 500);
    return () => clearTimeout(pause);
  }, [said]);

  return (
    <section aria-labelledby={titleId} data-chapter-ink="light" className="relative isolate flex min-h-svh flex-col bg-plum-black px-(--margin) py-28 [--ring:var(--pink)] md:py-36">
      <AsciiField src="/images/card-catalog-1932.jpg" focus={[0.5, 0.62]} className="-z-10" />
      <h2 id={titleId} data-reveal="" className="t-lead font-semibold">
        Type something you've asked a chatbot
      </h2>
      <input
        data-ui
        data-reveal=""
        data-delay="1"
        aria-labelledby={titleId}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        maxLength={120}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="how do i…"
        className="ask-input t-display mt-6 w-full min-w-0 border-b-2 border-muted-on-dark bg-transparent pb-[0.06em] text-[9.5vw] text-white outline-offset-8 transition-colors hover:border-white focus:border-pink md:mt-8 md:text-[clamp(48px,8vw,132px)]"
      />
      <div className="mt-8 grid grid-cols-12 gap-x-6 gap-y-12 md:mt-12">
        <div data-reveal="" data-delay="2" className="col-span-12 md:col-span-7 lg:col-span-6">
          {card ? (
            <AnswerCard key={card.skill} card={card} shown={shown} />
          ) : (
            <p key={question.trim() ? "none" : "empty"} className="answer-in t-lead max-w-[36ch] text-pretty">
              {question.trim() ? NO_MATCH : EMPTY}
            </p>
          )}
          <p role="status" className="sr-only">
            {announced}
          </p>
        </div>
        <div data-reveal="" data-delay="3" className="col-span-12 flex flex-col gap-3 md:col-span-4 md:col-start-9 md:self-end">
          <p className="t-body text-muted-on-dark">Or try one of these</p>
          <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => setQuestion(example)}
                  className="press ink-link t-lead flex h-11 cursor-pointer items-center bg-plum-surface px-4 text-left font-semibold hover:bg-plum-field md:h-auto md:bg-transparent md:px-0 md:hover:bg-transparent"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The matched card at the app's size: its skill, how often and when, every ask on its strip, and three of its messages. */
function AnswerCard({ card, shown }: { card: DemoCard; shown: DemoCard["borrows"] }) {
  return (
    <div data-ui inert className="answer-in flex max-w-[560px] flex-col gap-4 rounded-2xl bg-white p-5 text-sm text-foreground [--radius:10px] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">{card.skill}</p>
          <p className="text-muted-foreground">{askedLine(card)}</p>
        </div>
        <DemoChip />
      </div>
      <AskStrip axis={AXIS} asks={card.borrows.map((ask) => ask.at)} />
      <ul className="flex flex-col">
        {shown.map((ask) => (
          <li key={ask.at} /* taste-skill-ignore: the app's row rule, inside a data-ui card */ className="flex items-baseline justify-between gap-4 border-t border-rule py-2.5 last:pb-0">
            <span className="min-w-0">
              <Phrasing text={ask.text} />
            </span>
            <Time iso={ask.at} className="shrink-0 text-xs text-muted-foreground" />
          </li>
        ))}
      </ul>
    </div>
  );
}
