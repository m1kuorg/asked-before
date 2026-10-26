// One upload after sending (?upload=<id>; m1kuorg/basics#74): how many of its
// messages were new, then where its sort stands, asked for with uploads.get a
// second after each answer while it waits or sorts, and never again once the
// screen is left. Sorting shows "120 of 300 sorted" on a bar, then the last
// pass over the messages not on a card; a failed sort shows its error (the
// daily model cap's message included) and "Try again", which runs
// uploads.retry. When a sort it watched ends, the sidebar's counts refresh.
// "Go to <shelf>" and "Upload another export" close every state.

import type { Client, Shelf, Upload } from "@asked-before/sdk";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { CircleAlertIcon } from "lucide-react";
import { useShell } from "@/app/shell";
import { ErrorNotice } from "@/components/error-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { WaitLine } from "@/components/wait-line";
import { count } from "@/lib/format";
import { shelfPath, uploadPath, WATCH_MS } from "@/screens/upload/data";
import { Headline } from "@/screens/upload/preview";
import { ProgressLine } from "@/screens/upload/progress-line";

const isLive = (upload: Upload) => upload.status === "waiting" || upload.status === "sorting";

type WatchProps = { client: Client; shelf: Shelf; initial: Upload; signal: AbortSignal };

export function Watch({ client, shelf, initial, signal }: WatchProps) {
  const { refreshShell } = useShell();
  const [upload, setUpload] = useState(initial);
  // A poll or a retry that failed, with what "Try again" repeats.
  const [problem, setProblem] = useState<{ error: unknown; title: string; again: () => void } | null>(null);
  const [restarting, setRestarting] = useState(false);
  const retry = useRef<HTMLButtonElement>(null);
  const before = useRef(initial.status);

  useEffect(() => {
    if (!isLive(upload) || problem || restarting) return;
    const timer = setTimeout(async () => {
      try {
        const next = await client.uploads.get(upload.id);
        if (!signal.aborted) setUpload(next);
      } catch (error) {
        if (!signal.aborted) setProblem({ error, title: "The sort's progress didn't load.", again: () => setProblem(null) });
      }
    }, WATCH_MS);
    return () => clearTimeout(timer);
  }, [upload, problem, restarting]);

  // A sort this page watched has ended: the counts changed, and a failure's retry takes focus.
  useEffect(() => {
    const was = before.current;
    before.current = upload.status;
    if (was !== "waiting" && was !== "sorting") return;
    if (upload.status === "sorted" || upload.status === "failed") refreshShell();
    if (upload.status === "failed") retry.current?.focus();
  }, [upload.status]);

  async function restart() {
    setRestarting(true);
    setProblem(null);
    try {
      const next = await client.uploads.retry(upload.id);
      if (!signal.aborted) setUpload(next);
    } catch (error) {
      if (!signal.aborted) setProblem({ error, title: "The sort didn't start again.", again: () => void restart() });
    } finally {
      if (!signal.aborted) setRestarting(false);
    }
  }

  const name = shelf.name;
  const failed = upload.status === "failed";
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Headline n={upload.phrasings} words={upload.phrasings === 1 ? "new message" : "new messages"} />
        <Held upload={upload} name={name} />
      </div>
      {restarting ? <WaitLine spinner>Starting the sort again…</WaitLine> : <Standing upload={upload} name={name} retry={retry} onRetry={restart} />}
      {problem && <ErrorNotice error={problem.error} title={problem.title} onRetry={problem.again} />}
      <div className="flex flex-wrap gap-2">
        {/* A long shelf name is cut to the column, never pushing the page sideways; the link's name stays whole. */}
        <a href={shelfPath(shelf.id)} className={cn(buttonVariants({ variant: failed ? "secondary" : "default" }), "max-w-full")}>
          <span className="truncate">{`Go to ${name}`}</span>
        </a>
        <a href={uploadPath(shelf.id)} className={cn(buttonVariants({ variant: "secondary" }))}>
          Upload another export
        </a>
      </div>
    </section>
  );
}

/** "conversations.json held 27 of your messages, 3 of them in Work already.", or that nothing was new. */
function Held({ upload, name }: { upload: Upload; name: string }) {
  const { fileName, messages, phrasings } = upload;
  if (!messages) return null;
  const already = messages - phrasings;
  const said =
    phrasings > 0
      ? `${fileName} held ${count(messages)} of your messages${already > 0 ? `, ${count(already)} of them in ${name} already` : ""}.`
      : messages === 1
        ? `The one message in ${fileName} was in ${name} already, so nothing new was added.`
        : `All ${count(messages)} of your messages in ${fileName} were in ${name} already, so nothing new was added.`;
  return <p className="text-sm text-muted-foreground">{said}</p>;
}

type StandingProps = { upload: Upload; name: string; retry: RefObject<HTMLButtonElement | null>; onRetry: () => void };

/** Where the sort stands, in words. */
function Standing({ upload, name, retry, onRetry }: StandingProps) {
  const one = upload.phrasings === 1;
  const sorted = `${count(upload.offered)} of ${count(upload.phrasings)}`;
  // Once every message has been offered, the sort's last pass offers the shelf's messages not on a card again.
  const lastPass = upload.phrasings > 0 && upload.offered === upload.phrasings;

  switch (upload.status) {
    case "receiving":
      return <p className="text-sm">This upload stopped before all its messages arrived. Upload the export again: nothing already sent is counted twice.</p>;
    case "waiting":
      return upload.phrasings === 0 ? (
        <p role="status" className="text-sm">
          There's nothing new to sort.
        </p>
      ) : (
        <WaitLine spinner>{`${one ? "It waits" : "They wait"} to be sorted into the cards on ${name}…`}</WaitLine>
      );
    case "sorting":
      return (
        <ProgressLine
          spinner
          label={`Sorting ${one ? "it" : "them"} into the cards on ${name}${lastPass ? ", and a last pass over the messages not on a card" : ""}…`}
          done={upload.offered}
          total={upload.phrasings}
          unit="sorted"
        />
      );
    case "sorted":
      return (
        <p role="status" className="text-sm font-medium">
          {upload.phrasings === 0 ? "There was nothing new to sort." : `${one ? "It's" : "They're"} sorted into the cards on ${name}.`}
        </p>
      );
    case "failed":
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="negative">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{upload.error ?? "The sort failed."}</AlertDescription>
          </Alert>
          {lastPass ? (
            <p className="text-sm">{`${sorted} were sorted, and it stopped on the last pass over the messages not on a card. Trying again runs that pass.`}</p>
          ) : upload.offered > 0 ? (
            <p className="text-sm">{`${sorted} were sorted before it stopped. Trying again carries on from there.`}</p>
          ) : null}
          <Button ref={retry} onClick={onRetry}>
            Try again
          </Button>
        </div>
      );
  }
}
