// Search (/app/search?q=; search.get() and desk.get()). Its question: have
// I asked this before? The h1 is the question, over one large field in a
// <form role="search">. The search lives in ?q=, so it can be linked:
// typing writes it there 250 ms after the last key, and Enter at once, both
// replacing the history entry, and q is the route's local param, so the
// screen isn't remounted. Each new search aborts the one before. The answer
// is a 24px sentence built from the data ("Yes: 9 of your messages ask
// that, all on Undo a git commit, To prove."), announced as it changes,
// then the cards it's on, then the messages, word for word with the words
// marked. Until there's a search with a word of 2 or more characters, it
// shows searches made from the learner's own cards and never calls search.
// "/" focuses the field, unless the learner is typing in another.
//
// The grid: Home's 1100px column of 12, 8 + 4 (729 + 16 + 355): the field,
// the cards, and the messages on the left, "How a search matches" on the
// right. Below a 1100px canvas everything stacks, the note last.
import { searchWords, type SearchAnswer } from "@asked-before/sdk";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { ErrorNotice } from "@/components/error-notice";
import { WaitLine } from "@/components/wait-line";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { clientFor } from "@/lib/client";
import { Examples, searchPath } from "./search/examples";
import { CardsFound, MessagesFound, ResultsLoading } from "./search/results";
import { answerOf, lookedFor } from "./search/sentences";

/** How long after the last key the search is sent. */
const SETTLE_MS = 250;

const grid = "grid grid-cols-1 gap-4 @min-[68.75rem]/search:grid-cols-12";
const eight = "flex min-w-0 flex-col gap-4 @min-[68.75rem]/search:col-span-8";
// The rail stays in view beside a long list of messages, so the rule a search follows is always beside its answer.
const four = "@min-[68.75rem]/search:sticky @min-[68.75rem]/search:top-9 @min-[68.75rem]/search:col-span-4 @min-[68.75rem]/search:self-start";

export function Search({ client, query, navigate }: ScreenProps) {
  const asked = query.get("q") ?? "";
  const words = searchWords(asked);
  const key = words.join(" ");

  const [text, setText] = useState(asked);
  // What this screen last wrote in the address. An address it didn't write (a link, back, forward) fills the field.
  const wrote = useRef(asked);
  useEffect(() => {
    if (asked === wrote.current) return;
    wrote.current = asked;
    setText(asked);
  }, [asked]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const write = (value: string) => {
    clearTimeout(timer.current);
    wrote.current = value.trim() ? value : "";
    navigate(wrote.current ? searchPath(value) : "/app/search", { replace: true });
  };

  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusField = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest("input, textarea, select")) return;
      event.preventDefault();
      field.current?.focus();
      field.current?.select();
    };
    document.addEventListener("keydown", focusField);
    return () => document.removeEventListener("keydown", focusField);
  }, []);

  // Searched again only when the words change; the load aborts with the next one, or when the screen goes.
  const results = useResource((signal) => (key ? clientFor(signal).search.get({ q: asked }) : Promise.resolve(null)), [key]);
  const desk = useResource(() => client.desk.get(), []);

  // While the next answer comes, the last one stays, so nothing jumps between keys.
  const last = useRef<SearchAnswer | null>(null);
  if (!key) last.current = null;
  else if (results.data) last.current = results.data;
  const answer = key ? (results.data ?? (results.loading ? last.current : null)) : null;

  const fieldId = useId();
  const hintId = useId();
  // After an example, focus comes back to the field, where the next search starts; not on a touch screen, where it would open the keyboard.
  const pickExample = () => matchMedia("(pointer: fine)").matches && requestAnimationFrame(() => field.current?.focus());

  return (
    <div className="@container/search flex flex-col lg:pt-9">
      <h1 className="text-2xl font-semibold">Have you asked this before?</h1>

      <div className={cn(grid, "mt-6")}>
        <form
          role="search"
          aria-label="Your messages and cards"
          className={eight}
          onSubmit={(event) => {
            event.preventDefault();
            write(text);
          }}
        >
          <Field>
            <FieldLabel htmlFor={fieldId}>Search your messages and your cards' names</FieldLabel>
            <div className="flex gap-2">
              <Input
                ref={field}
                id={fieldId}
                type="search"
                name="q"
                value={text}
                onChange={({ target: { value } }) => {
                  setText(value);
                  clearTimeout(timer.current);
                  timer.current = setTimeout(() => write(value), SETTLE_MS);
                }}
                placeholder="Such as git commit…"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                aria-keyshortcuts="/"
                aria-describedby={hintId}
                className="h-11 flex-1 text-base md:text-base"
              />
              <Button type="submit" size="lg">
                Search
              </Button>
            </div>
            <FieldDescription id={hintId}>A message matches when it has every word, with capitals or without. Press / to come back here.</FieldDescription>
          </Field>
        </form>
      </div>

      {/* Always in the page, so each new answer is announced. */}
      <div aria-live="polite" aria-atomic="true" className="empty:hidden mt-10 flex flex-col">
        {answer ? (
          <>
            {/* 24px from a small tablet up; on a phone 16/500, so the answer stays within two or three short lines. */}
            <p className="text-base font-medium text-pretty sm:text-2xl sm:font-normal">{answerOf(answer)}</p>
            {results.loading ? <WaitLine className="mt-1">Looking through your messages…</WaitLine> : <p className="mt-1 text-sm text-muted-foreground">{lookedFor(answer)}</p>}
          </>
        ) : key && results.loading ? (
          <>
            <Skeleton className="my-0.5 h-5 w-full max-w-120 sm:my-1 sm:h-6" />
            <WaitLine className="mt-1">Looking through your messages…</WaitLine>
          </>
        ) : asked.trim() && !key ? (
          <p className="text-sm text-muted-foreground">Type a word of 2 or more characters to search.</p>
        ) : null}
      </div>

      <div className={cn(grid, "mt-6")}>
        <div className={eight}>
          {key && results.error !== null && !answer ? (
            <ErrorNotice error={results.error} title="The search didn't run." onRetry={results.retry} focus={false} />
          ) : answer ? (
            answer.total > 0 ? (
              <>
                <CardsFound answer={answer} />
                <MessagesFound answer={answer} />
              </>
            ) : answer.cards.length ? (
              <CardsFound answer={answer} />
            ) : (
              <Examples desk={desk} title="Try one you've asked" onPick={pickExample} />
            )
          ) : key ? (
            <ResultsLoading />
          ) : (
            <Examples desk={desk} title="Try one you've asked" onPick={pickExample} />
          )}
        </div>
        <HowItMatches className={four} />
      </div>
    </div>
  );
}

/** The rail: how matching works, in words, on the white ground with no frame. */
function HowItMatches({ className }: { className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2 text-sm text-muted-foreground @min-[68.75rem]/search:pt-5", className)}>
      <h2 id={id} className="font-semibold text-foreground">
        How a search matches
      </h2>
      <p>A message matches when every word you type is somewhere in it, with capitals or without, so “git” finds “digit” too. Up to 8 words count, each of 2 or more characters.</p>
      <p>A card matches when one of its messages does, or when its name has every word. Code does the looking: a search asks the model nothing.</p>
    </section>
  );
}
