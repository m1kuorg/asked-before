// How it works, as call and response: what you give, then what comes back,
// in one narrow column. Each call and response is a real fragment of the app
// built from its own components (data-ui), labelled Example or Demo data,
// inert (nothing in it can be focused or pressed, and none holds a real file
// input), with its text alternative beside it. The last response, the pass,
// breaks out wider. The last sentence carries a photograph of a pupil working
// a sum at the blackboard; then the photograph of a closed-book examination.
import { useEffect, useRef, useState } from "react";
import { FileArchiveIcon } from "lucide-react";
import { AskStrip } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Phrasing } from "@/components/phrasing";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_LABEL, DEMO_DATA, PRIVACY_LINE, READ_LOCALLY } from "@/lib/copy";
import { askedTimes, count, longDate, plural, shortDate } from "@/lib/format";
import { AXIS, CARD_A, CARDS, DEMO_MESSAGES } from "./demo";
import { Photo } from "./photo";

const FILE = "chatgpt-export.zip";
/** Every ask on the demo shelf's cards: the shelf's subline counts these (brief section 7). */
const ASKS = CARDS.reduce((sum, card) => sum + card.borrows.length, 0);
const ANSWER = "git reset --soft HEAD~1 undoes the commit and keeps the changes staged";
const REASON = "Right: git reset --soft HEAD~1 moves the branch back one commit and leaves your changes staged.";
/** The example's pass, on the day the example was written. */
const PROVEN_AT = "2026-10-23T12:00:00.000Z";

/** An app fragment's frame: the app's radius and type, and out of reach of focus and pointer. */
const FRAGMENT = "rounded-2xl bg-white text-sm text-foreground [--radius:10px]";

export function HowItWorksChapter() {
  return (
    <section aria-labelledby="how-title" data-chapter-ink="dark" className="overflow-x-clip bg-white px-(--margin) pt-28 pb-24 text-navy-ink md:pt-40 md:pb-32">
      <div className="grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-8 md:col-start-3 lg:col-span-12 lg:col-start-1">
          <h2 id="how-title" data-reveal="" className="t-head">
            How it works
          </h2>
          <ol className="mt-14 flex flex-col gap-[88px] lg:mt-20">
            <Exchange sentence="First, upload your chat export.">
              <Call alternative={`Example: the drop target, holding ${FILE}.`}>
                <div data-ui inert className={`${FRAGMENT} relative flex min-h-52 flex-col items-center justify-center gap-2 border border-dashed border-input p-6 text-center`}>
                  <Badge variant="outline" className="absolute top-4 right-4">
                    Example
                  </Badge>
                  <FileArchiveIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium">{FILE}</p>
                  <p className="text-muted-foreground">{READ_LOCALLY}</p>
                </div>
              </Call>
              <Response
                alternative={`Example: the preview before anything is sent. ${DEMO_MESSAGES} of your own messages. ${FILE}, read as a ChatGPT export. ${PRIVACY_LINE} Then the buttons Upload ${DEMO_MESSAGES} messages and Choose another file.`}
              >
                <div data-ui inert className={`${FRAGMENT} flex flex-col gap-4 border border-border p-5 md:p-6`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-2xl font-semibold tabular-nums">{DEMO_MESSAGES} of your own messages</p>
                      <p className="text-muted-foreground">{FILE}, read as a ChatGPT export.</p>
                    </div>
                    <Badge variant="outline">Example</Badge>
                  </div>
                  <p className="leading-relaxed">{PRIVACY_LINE}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button>Upload {DEMO_MESSAGES} messages</Button>
                    <Button variant="secondary">Choose another file</Button>
                  </div>
                </div>
              </Response>
            </Exchange>

            <Exchange sentence="Then see what you keep asking.">
              <Response
                alternative={`${DEMO_DATA}: the demo shelf's ${CARDS.length} cards, each To prove. ${CARDS.map((card) => `${card.skill}, ${askedTimes(card.borrows.length)}`).join("; ")}.`}
              >
                <div data-ui inert className={`${FRAGMENT} border border-border`}>
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-base font-semibold">Demo</p>
                      <p className="text-muted-foreground">
                        {plural(CARDS.length, "card")} from {count(ASKS)} of your messages
                      </p>
                    </div>
                    <DemoChip />
                  </div>
                  <ul>
                    {CARDS.map((card) => (
                      <li key={card.skill} /* taste-skill-ignore: the app's row rule, inside a data-ui card */ className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-rule px-5 py-3">
                        <span className="truncate font-medium">{card.skill}</span>
                        <StatusPill status="borrowed" />
                        <span className="col-span-2 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
                          <span className="text-muted-foreground">{askedTimes(card.borrows.length)}</span>
                          <AskStrip axis={AXIS} first={card.borrows[0]!.at} last={card.borrows.at(-1)!.at} count={card.borrows.length} showCount={false} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Response>
            </Exchange>

            <Exchange
              sentence="Finally, prove it without AI."
              aside={
                <Photo
                  src="/images/pupil-blackboard-1956.jpg"
                  width={1080}
                  height={1080}
                  alt="A schoolboy in a sweater stands at a blackboard, chin in hand, his chalk on the last line of a long multiplication he is working out."
                  caption="A pupil during a mathematics lesson"
                  date="September 1956"
                />
              }
            >
              <Call alternative={`Example: a cold rep answer being typed in the box labelled ${ANSWER_LABEL}: ${ANSWER}.`}>
                <TypedAnswer />
              </Call>
              <Response
                wide
                alternative={`Example: ${CARD_A.skill}, marked Proven ${shortDate(PROVEN_AT)}. ${REASON} Its strip now ends in the proven tick on ${longDate(PROVEN_AT)}.`}
              >
                <div data-ui inert className={`${FRAGMENT} flex flex-col gap-4 border border-border p-5 md:p-6`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold">{CARD_A.skill}</p>
                      <Badge variant="positive" className="h-8 px-3 text-sm">
                        Proven {shortDate(PROVEN_AT)}
                      </Badge>
                    </div>
                    <Badge variant="outline">Example</Badge>
                  </div>
                  <p className="text-base leading-relaxed">
                    <Phrasing text={REASON} />
                  </p>
                  <AskStrip axis={AXIS} asks={CARD_A.borrows.map((ask) => ask.at)} provenAt={PROVEN_AT} />
                </div>
              </Response>
            </Exchange>
          </ol>
        </div>
      </div>

      {/* The padding above and below holds the photograph's drift (landing.css), so the whole picture stays inside its figure. */}
      <Photo
        src="/images/exam-hall-1958.jpg"
        width={1200}
        height={769}
        alt="A school hall in 1958: students at single wooden desks, set well apart, write their examination by hand while a teacher stands at the back."
        caption="The matriculation examination at Nurmes coeducational lyceum, Finland"
        date="March 30, 1958"
        drift
        frame="h-[min(64svh,100vw)] md:h-[min(84svh,64vw)]"
        position="object-[50%_40%]"
        className="mt-16 pt-12 pb-4 md:mt-28"
      />
    </section>
  );
}

/** One exchange: its sentence opens it (on a wide screen it holds in the left margin, with its picture under it, while its call and response pass), then the call, then the response. Without that margin, the picture comes first at three-fifths of the width, so the sentence still leads straight into its call. */
function Exchange({ sentence, aside, children }: { sentence: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-x-6">
      <div className="flex flex-col gap-8 lg:sticky lg:top-28 lg:col-span-3 lg:self-start">
        <p data-reveal="" className="t-lead font-medium text-balance">
          {sentence}
        </p>
        {aside && <div className="w-3/5 max-lg:-order-1 lg:w-auto">{aside}</div>}
      </div>
      <div className="flex flex-col gap-4 lg:col-span-8 lg:col-start-4">{children}</div>
    </li>
  );
}

/** What you give: the app's own control, on a panel one tone off the ground. */
function Call({ alternative, children }: { alternative: string; children: React.ReactNode }) {
  return (
    <div data-reveal="" data-delay="1" className="bg-panel p-4 md:max-w-[560px] md:p-5">
      <p className="sr-only">{alternative}</p>
      {children}
    </div>
  );
}

/** What comes back, indented under the call; the last one breaks out wider. */
function Response({ alternative, wide = false, children }: { alternative: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div data-reveal="" data-delay="2" className={wide ? "mt-2 md:ml-14 md:w-[min(760px,_100%_-_3.5rem)]" : "mt-2 md:ml-14 md:max-w-[560px]"}>
      <p className="sr-only">{alternative}</p>
      {children}
    </div>
  );
}

/** The cold rep's answer box, typed out once as it comes into view (all at once when motion is reduced). */
function TypedAnswer() {
  const box = useRef<HTMLDivElement>(null);
  const [still] = useState(() => typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [typed, setTyped] = useState(still ? ANSWER.length : 0);

  useEffect(() => {
    if (still || !box.current) return;
    let timer = 0;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        let n = 0;
        timer = window.setInterval(() => {
          n += 1;
          setTyped(n);
          if (n >= ANSWER.length) clearInterval(timer);
        }, 32);
      },
      { threshold: 0.6 },
    );
    seen.observe(box.current);
    return () => {
      seen.disconnect();
      clearInterval(timer);
    };
  }, [still]);

  return (
    <div ref={box} data-ui inert className={`${FRAGMENT} flex flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="example-answer" className="font-medium">
          {ANSWER_LABEL}
        </label>
        <Badge variant="outline">Example</Badge>
      </div>
      <Textarea id="example-answer" value={ANSWER.slice(0, typed)} onChange={() => {}} rows={3} className="min-h-24 text-base md:text-base" />
      <div>
        <Button>Check my answer</Button>
      </div>
    </div>
  );
}
