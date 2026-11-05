// The cold rep panel, "Prove it without AI": the card page's main block. Its
// state comes from the card's reps (the latest unchecked one is open, and
// is shown again on reload) plus what this visit is doing:
//
//   offer     Start a cold rep, under the last failure's reason and the
//             lesson again when the last check failed; the stamp when Proven
//   starting  "Writing the lesson and pulling a problem…" (one model request)
//   open      the lesson on the first rep, "The problem", and the answer
//   checking  the answer read-only (one model request)
//   fail      "Not yet", the reason, "The lesson, again", and a fresh
//             problem started at once
//   pass      the "Proven <date>" stamp, the reason, Next, and the way back
//
// Each request's failure shows in place: "Try again" for a network failure,
// a 5xx, or a 429; "Start a new cold rep" for a 409. reps.start runs only
// from a click, after a failed check, or once for ?rep=start (`autoStart`).
// The answer being written is kept in this tab's sessionStorage under its
// rep's id, so leaving the card and coming back finds it; it's dropped once
// the rep is checked, and it goes nowhere but there and reps.check.

import { ApiError, type CardDetail, type Client, type Rep, type Shelf } from "@asked-before/sdk";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { useShell } from "@/app/shell";
import { useResource } from "@/app/use-resource";
import { ErrorNotice } from "@/components/error-notice";
import { Time } from "@/components/time";
import { WaitLine } from "@/components/wait-line";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_LABEL, START_REP, startRepName } from "@/lib/copy";
import { count, plural, shortDate } from "@/lib/format";
import { needsRep } from "@/lib/status";
import { ModelText } from "@/screens/card/model-text";
import { Stamp } from "@/screens/card/stamp";

/** The longest answer a check takes (server/api/reps.ts). */
const MAX_ANSWER = 4000;
/** The count shows from here on. */
const NEAR_MAX = 3500;

type Focus = "answer" | "verdict" | "stamp" | "conflict";

/** The draft of an open rep's answer, in this tab only. Storage that refuses (a private window's quota) just keeps nothing. */
const draftKey = (repId: string) => `asked-before:answer:${repId}`;
function readDraft(repId: string): string {
  try {
    return sessionStorage.getItem(draftKey(repId)) ?? "";
  } catch {
    return "";
  }
}
function keepDraft(repId: string, answer: string): void {
  try {
    if (answer) sessionStorage.setItem(draftKey(repId), answer);
    else sessionStorage.removeItem(draftKey(repId));
  } catch {
    // Nothing kept; the answer is still on screen.
  }
}

type RepPanelProps = {
  client: Client;
  card: CardDetail;
  shelf: Shelf;
  /** Shows the card as a start or a check left it. */
  update: (change: (card: CardDetail) => CardDetail) => void;
  /** True once, when the card was opened with ?rep=start. */
  autoStart: RefObject<boolean>;
  signal: AbortSignal;
  className?: string;
};

export function RepPanel({ client, card, shelf, update, autoStart, signal, className }: RepPanelProps) {
  const { refreshShell } = useShell();
  const [busy, setBusy] = useState<"start" | "check" | null>(null);
  const [failure, setFailure] = useState<{ on: "start" | "check"; error: unknown } | null>(null);
  const [passed, setPassed] = useState<Rep | null>(null);
  const latest = card.reps.at(-1);
  const open = latest && latest.verdict === null ? latest : null;
  const [answer, setAnswer] = useState(() => (open ? readDraft(open.id) : ""));
  const [blank, setBlank] = useState(false);
  const [focus, setFocus] = useState<{ on: Focus } | null>(null);
  const starting = useRef(false);
  const targets = {
    answer: useRef<HTMLTextAreaElement>(null),
    verdict: useRef<HTMLHeadingElement>(null),
    stamp: useRef<HTMLHeadingElement>(null),
    conflict: useRef<HTMLButtonElement>(null),
  };

  const lastChecked = card.reps.findLast((rep) => rep.verdict !== null) ?? null;
  const failedLast = lastChecked?.verdict === "fail" ? lastChecked : null;

  // Focus moves on purpose, once its target is on screen.
  useEffect(() => {
    if (!focus) return;
    const node = targets[focus.on].current;
    if (node) {
      node.focus();
      setFocus(null);
    }
  });

  async function start(then: Focus | null) {
    if (starting.current) return;
    starting.current = true;
    setBusy("start");
    setFailure(null);
    try {
      const started = await client.reps.start(card.id);
      if (signal.aborted) return;
      update((now) => ({ ...now, lesson: started.lesson ?? now.lesson, reps: [...now.reps, started.rep] }));
      setAnswer("");
      setBlank(false);
      if (then) setFocus({ on: then });
    } catch (error) {
      if (!signal.aborted) setFailure({ on: "start", error });
    } finally {
      starting.current = false;
      if (!signal.aborted) setBusy(null);
    }
  }

  // ?rep=start: one start, once the card is here, unless a rep is open already.
  useEffect(() => {
    if (!autoStart.current) return;
    autoStart.current = false;
    if (!open) void start("answer");
    else setFocus({ on: "answer" });
    // Once, on the first draw with the card.
  }, []);

  async function check() {
    if (!open || busy) return;
    if (!answer.trim()) {
      setBlank(true);
      setFocus({ on: "answer" });
      return;
    }
    setBusy("check");
    setFailure(null);
    try {
      const checked = await client.reps.check(open.id, { answer });
      keepDraft(open.id, "");
      if (signal.aborted) return;
      update((now) => ({ ...now, ...checked.card, reps: now.reps.map((rep) => (rep.id === checked.rep.id ? checked.rep : rep)) }));
      refreshShell();
      setBusy(null);
      if (checked.rep.verdict === "pass") {
        setPassed(checked.rep);
        setFocus({ on: "stamp" });
      } else {
        setFocus({ on: "verdict" });
        void start(null);
      }
    } catch (error) {
      if (signal.aborted) return;
      setBusy(null);
      setFailure({ on: "check", error });
      if (error instanceof ApiError && error.status === 413) setFocus({ on: "answer" });
      if (error instanceof ApiError && error.status === 409) setFocus({ on: "conflict" });
    }
  }

  /** After a 409: the card as it is now; then the newer rep when one is open (nothing spent), or else a new one. */
  async function startAfresh() {
    setBusy("start");
    setFailure(null);
    try {
      if (open) keepDraft(open.id, "");
      const now = await client.cards.get(card.id);
      if (signal.aborted) return;
      update(() => now);
      refreshShell();
      const newest = now.reps.at(-1);
      if (newest && newest.verdict === null && newest.id !== open?.id) {
        setBusy(null);
        setAnswer(readDraft(newest.id));
        setFocus({ on: "answer" });
        return;
      }
    } catch {
      // The new rep is what matters; the card's history catches up on the next visit.
    }
    void start("answer");
  }

  let body;
  if (passed) {
    body = <Passed client={client} card={card} rep={passed} shelf={shelf} stampRef={targets.stamp} />;
  } else {
    const waiting = card.lesson === null ? "Writing the lesson and pulling a problem…" : "Pulling a fresh problem…";
    body = (
      <>
        {failedLast && <LastFailure rep={failedLast} lesson={card.lesson} headingRef={targets.verdict} />}
        {busy === "start" ? (
          <WaitLine spinner>{waiting}</WaitLine>
        ) : failure?.on === "start" ? (
          <ErrorNotice error={failure.error} title="The cold rep didn't start." onRetry={() => void start("answer")} />
        ) : open ? (
          <Answer
            rep={open}
            lesson={lastChecked === null ? card.lesson : null}
            answer={answer}
            setAnswer={(next) => {
              setAnswer(next);
              keepDraft(open.id, next);
              setBlank(false);
            }}
            blank={blank}
            checking={busy === "check"}
            failure={failure?.on === "check" ? failure.error : null}
            onCheck={() => void check()}
            onStartAfresh={() => void startAfresh()}
            answerRef={targets.answer}
            conflictRef={targets.conflict}
          />
        ) : (
          <Offer card={card} skill={card.skill} lastPass={lastChecked?.verdict === "pass" ? lastChecked : null} afterFailure={failedLast !== null} onStart={() => void start("answer")} />
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="rep-title" className={cn("flex flex-col gap-5 rounded-2xl bg-panel p-5", className)}>
      <header className="flex flex-col gap-1">
        <h2 id="rep-title" className="text-base font-semibold">
          Prove it without AI
        </h2>
        <p className="text-muted-foreground">Answer without AI. A pass marks the card Proven.</p>
      </header>
      {body}
    </section>
  );
}

/** A titled run of the model's words: "The lesson", "The problem". */
function Words({ title, text, headingRef }: { title: string; text: string; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-sm font-semibold">
        {title}
      </h3>
      <ModelText text={text} className="text-base" />
    </div>
  );
}

function Offer({ card, skill, lastPass, afterFailure, onStart }: { card: CardDetail; skill: string; lastPass: Rep | null; afterFailure: boolean; onStart: () => void }) {
  const toProve = needsRep(card.status);
  return (
    <div className="flex flex-col items-start gap-4">
      {card.status === "returned" && card.returnedAt && !afterFailure ? (
        <>
          <p>
            <Stamp at={card.returnedAt} />
          </p>
          {lastPass?.reason && <ModelText text={lastPass.reason} className="text-muted-foreground" />}
        </>
      ) : card.status === "borrowed_again" && card.returnedAt && !afterFailure ? (
        <p className="text-base">
          Proven {shortDate(card.returnedAt)}, then asked again {shortDate(card.lastBorrowAt)}, so it needs a fresh cold rep.
        </p>
      ) : (
        !afterFailure && (
          <div className="flex flex-col gap-2">
            <p className="text-base">You get the lesson on this skill and a fresh problem, written from your own messages. Answer it in your own words, and the model checks it.</p>
            <p className="text-muted-foreground">Pass, and the card is marked Proven with today's date. Not yet, and you get the reason, the lesson again, and a different problem.</p>
          </div>
        )
      )}
      <Button variant={toProve ? "default" : "secondary"} aria-label={startRepName(skill)} onClick={onStart}>
        {START_REP}
      </Button>
    </div>
  );
}

/** The last check failed: "Not yet", its reason, and the lesson again. */
function LastFailure({ rep, lesson, headingRef }: { rep: Rep; lesson: string | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 rounded-xl bg-negative px-4 py-3 text-negative-foreground">
        <div className="flex items-baseline justify-between gap-4">
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold">
            Not yet
          </h3>
          {rep.checkedAt && <Time iso={rep.checkedAt} className="text-xs" />}
        </div>
        {rep.reason && <ModelText text={rep.reason} />}
      </div>
      {lesson && <Words title="The lesson, again" text={lesson} />}
    </div>
  );
}

type AnswerProps = {
  rep: Rep;
  /** The lesson, on the card's first rep. */
  lesson: string | null;
  answer: string;
  setAnswer: (answer: string) => void;
  blank: boolean;
  checking: boolean;
  failure: unknown;
  onCheck: () => void;
  onStartAfresh: () => void;
  answerRef: RefObject<HTMLTextAreaElement | null>;
  conflictRef: RefObject<HTMLButtonElement | null>;
};

function Answer({ rep, lesson, answer, setAnswer, blank, checking, failure, onCheck, onStartAfresh, answerRef, conflictRef }: AnswerProps) {
  const status = failure instanceof ApiError ? failure.status : null;
  const tooLong = status === 413;
  const near = answer.length >= NEAR_MAX;
  const described = [near && "answer-count", blank && "answer-blank", tooLong && "answer-failure"].filter(Boolean).join(" ") || undefined;

  return (
    <>
      {lesson && <Words title="The lesson" text={lesson} />}
      <Words title="The problem" text={rep.problem} />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCheck();
        }}
      >
        <Field data-invalid={blank || tooLong || undefined}>
          <FieldLabel htmlFor="answer">{ANSWER_LABEL}</FieldLabel>
          <Textarea
            ref={answerRef}
            id="answer"
            name="answer"
            rows={6}
            className="min-h-36"
            maxLength={MAX_ANSWER}
            readOnly={checking}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            aria-invalid={blank || tooLong || undefined}
            aria-describedby={described}
          />
          {near && (
            <FieldDescription id="answer-count" className="tabular-nums">
              {count(answer.length)} of {count(MAX_ANSWER)} characters
              {answer.length >= MAX_ANSWER && ", the most a check takes"}
            </FieldDescription>
          )}
          {blank && <FieldError id="answer-blank">Write your answer first.</FieldError>}
        </Field>
        {status === 409 ? (
          // Checked already, or left for a newer rep: checking again can't help, so the way on is a new rep.
          <div className="flex flex-col items-start gap-3">
            <ErrorNotice error={failure} />
            <Button ref={conflictRef} type="button" onClick={onStartAfresh}>
              Start a new cold rep
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={checking}>
                {checking && <Spinner data-icon="inline-start" />}
                Check my answer
              </Button>
              {checking && <WaitLine>Checking your answer…</WaitLine>}
            </div>
            {failure !== null && (
              <div id="answer-failure">
                <ErrorNotice error={failure} title="Your answer wasn't checked." onRetry={onCheck} />
              </div>
            )}
          </>
        )}
      </form>
    </>
  );
}

/** The pass: the stamp comes down, then the reason, the next card that needs a rep, and the way back. The three are links styled as buttons (a Button rendering an <a> would be announced as a button). */
function Passed({ client, card, rep, shelf, stampRef }: { client: Client; card: CardDetail; rep: Rep; shelf: Shelf; stampRef: RefObject<HTMLHeadingElement | null> }) {
  const desk = useResource(() => client.desk.get(), []);
  const next = desk.data?.mostBorrowed.find((other) => other.id !== card.id);
  const at = card.returnedAt ?? rep.checkedAt ?? new Date().toISOString();

  return (
    <div className="flex flex-col items-start gap-5">
      <h3 ref={stampRef} tabIndex={-1}>
        <Stamp at={at} press />
      </h3>
      {rep.reason && <ModelText text={rep.reason} className="text-base" />}
      <div className="flex w-full flex-col items-start gap-3 border-t border-border pt-5">
        {desk.data ? (
          next ? (
            <div className="flex max-w-full flex-col items-start gap-1.5">
              <a href={`/app/cards/${encodeURIComponent(next.id)}?rep=start`} className={cn(buttonVariants(), "max-w-full")}>
                <span className="truncate">Next: {next.skill}</span>
              </a>
              <p className="text-xs text-muted-foreground">
                Asked {plural(next.count, "time")}, in {next.shelf.name}. Opening it starts a cold rep.
              </p>
            </div>
          ) : (
            <p className="text-base">Every card is proven.</p>
          )
        ) : desk.error !== null ? (
          <ErrorNotice error={desk.error} title="The next card didn't load." onRetry={desk.retry} focus={false} />
        ) : (
          <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
        )}
        <div className="flex flex-wrap gap-2">
          <a href="/app/desk" className={buttonVariants({ variant: "secondary" })}>
            Back to Home
          </a>
          <a href={`/app/shelves/${encodeURIComponent(shelf.id)}`} className={cn(buttonVariants({ variant: "secondary" }), "max-w-full")}>
            <span className="truncate">Back to {shelf.name}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
