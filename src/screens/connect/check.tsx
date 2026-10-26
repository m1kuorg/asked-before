// Check it: whether the key made here has been used yet. While the screen
// is open, useFirstUse asks keys.list() every 3 seconds, a read that spends
// no model request, until the key has a last use, and hands each list on so
// the keys beside the flow show it too. It stops at that first use, when the
// key is gone (revoked elsewhere), or when the screen's signal aborts. Every
// Bearer call stamps a key's use, so the line says only what's true: when
// the key was first used, never which program used it (m1kuorg/basics#77).
// The line is the screen's answer, so it's set at 16/500 with a still mark,
// and it's one status region, so the change is announced; a failed check
// shows in the step with Try again, which asks at once.

import type { ApiKey, CreatedApiKey } from "@asked-before/sdk";
import { useEffect, useRef, useState } from "react";
import { CircleCheckIcon, CircleDashedIcon, CircleSlashIcon } from "lucide-react";
import { cn } from "cn";
import { ErrorNotice } from "@/components/error-notice";
import { clientFor } from "@/lib/client";

const EVERY_MS = 3000;

type Watch = { state: "waiting" } | { state: "used"; at: string } | { state: "gone" } | { state: "failed"; error: unknown };

/** Watches `made` for its first use, from 3 seconds after it's made; null before a key is made. */
export function useFirstUse(made: CreatedApiKey | null, signal: AbortSignal, onList: (keys: ApiKey[]) => void) {
  const [watch, setWatch] = useState<Watch>({ state: "waiting" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(onList);
  latest.current = onList;

  useEffect(() => {
    if (!made) return;
    const stop = new AbortController();
    const both = AbortSignal.any([signal, stop.signal]);
    const keys = clientFor(both).keys;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      try {
        const list = await keys.list();
        if (both.aborted) return;
        latest.current(list);
        const key = list.find((k) => k.id === made.id);
        if (!key) setWatch({ state: "gone" });
        else if (key.lastUsedAt) setWatch({ state: "used", at: key.lastUsedAt });
        else timer = setTimeout(ask, EVERY_MS);
      } catch (error) {
        if (!both.aborted) setWatch({ state: "failed", error });
      }
    };
    setWatch({ state: "waiting" });
    timer = setTimeout(ask, attempt ? 0 : EVERY_MS);
    return () => {
      stop.abort();
      clearTimeout(timer);
    };
  }, [made?.id, signal, attempt]);

  return { watch: made ? watch : null, retry: () => setAttempt((n) => n + 1) };
}

/** "14:02", in the learner's own time zone. */
const clock = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

type CheckProps = { made: CreatedApiKey | null; watch: Watch | null; onRetry: () => void; guest: boolean };

export function Check({ made, watch, onRetry, guest }: CheckProps) {
  if (guest) return <p className="text-sm text-muted-foreground">With an account of your own and a key made here, this says when the key is first used, while the page is open.</p>;
  if (!made || !watch) return <p className="text-sm text-muted-foreground">Once you make a key above, this says when it's first used, while the page is open.</p>;

  // A still mark, never a spinner: an open ring while it waits, a tick once the key's been used.
  const Mark = watch.state === "used" ? CircleCheckIcon : watch.state === "gone" ? CircleSlashIcon : CircleDashedIcon;
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="flex items-start gap-2 text-base font-medium">
        <Mark aria-hidden="true" className={cn("mt-1 size-4 shrink-0 stroke-[1.5]", watch.state !== "used" && "text-muted-foreground")} />
        <span>
          {watch.state === "used" ? (
            <>
              {made.name}'s key was first used at <time dateTime={watch.at}>{clock.format(new Date(watch.at))}</time>.
            </>
          ) : watch.state === "gone" ? (
            `${made.name}'s key isn't on your account any more, so nothing can use it.`
          ) : watch.state === "failed" ? (
            `Stopped waiting for the first request from ${made.name}.`
          ) : (
            `Waiting for the first request from ${made.name}…`
          )}
        </span>
      </p>
      {watch.state === "failed" && <ErrorNotice error={watch.error} title="The check didn't go through." onRetry={onRetry} focus={false} />}
      {(watch.state === "waiting" || watch.state === "failed") && (
        <p className="text-sm text-muted-foreground">
          To try it, ask your agent to list your Asked Before shelves: that sends nothing of yours and spends no model request. Any request with the key counts, from your agent or anything else that has it.
        </p>
      )}
    </div>
  );
}
