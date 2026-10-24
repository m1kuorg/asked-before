// The response pane: the last answer, whatever endpoint is open now, so an
// id in it can fill the next request's field. Before anything is sent it
// says how to send (the shortcut too), that nothing runs until then, and
// what the endpoint can answer. While a request is out, the final layout in
// flat bars with what it waits for (a model wait turns its spinner). An
// answer, any status at all: the status and its words in a pale pair
// (positive under 400, negative from there), the time and the size, the
// request it answers, what the status means (for an error the docs' words
// from STATUSES, as they apply here), then the body, JSON pretty and
// coloured, or the text as it came, or "No body." A request that never
// arrived says so in a notice of its own, with Try again. A polite status
// line says each answer once, for a screen reader.

import { ErrorNotice } from "@/components/error-notice";
import { WaitLine } from "@/components/wait-line";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUSES } from "@/pages/docs/reference";
import { count } from "@/lib/format";
import { cn } from "cn";
import { answers, type Entry, type Fillable, type Param } from "./endpoints";
import { JsonView, fills } from "./json-view";
import type { Answer } from "./request";

export type Shown =
  | { state: "empty" }
  | { state: "sending"; sent: Sent; spends: boolean }
  | { state: "answered"; sent: Sent; answer: Answer; root: Param | null }
  | { state: "failed"; sent: Sent; error: unknown };

/** The request an answer is for: its method and address, and "as this session" or "with an API key". */
export type Sent = { request: string; via: string };

const PHRASES: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Content Too Large",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

const WORKED: Record<number, string> = {
  200: "It worked: the answer is below.",
  201: "It made what you asked for: the answer is the new object.",
  204: "It worked, and there's no body to send back.",
};

/** A success's words before it's sent. */
const BEFORE: Record<number, string> = {
  200: "What the line under the address describes.",
  201: "It made what the line under the address describes, and answers with it.",
  204: "It did it, and there's no body.",
};

/**
 * The docs' words for an error, less the cases only the endpoints that don't
 * run here can meet: logging in, signing up, and the account's password. So
 * here a 401 is never a wrong password, a 429 is always a daily cap, and
 * the page always sends its Origin and JSON.
 */
const HERE: Record<number, string> = {
  401: "No session or key came with the request, or the key is wrong or revoked.",
  403: "An API key on an endpoint that needs a session, or the shared guest on the account's endpoints or its keys.",
  409: "A conflict: an upload finished already, a retry of a sort that hasn't failed, or a cold rep checked already.",
  429: "One of the app's daily caps is spent, its model requests or its phrasings, for everyone. More open at midnight UTC.",
};

/** A status's words: what it did, or for an error what it means here, in the docs' words where they all apply. */
const meaning = (status: number) => WORKED[status] ?? HERE[status] ?? STATUSES.find(([code]) => code === String(status))?.[1] ?? null;

const tenths = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const size = (bytes: number) => (bytes < 1000 ? `${count(bytes)} B` : `${tenths.format(bytes / 1000)} kB`);
const took = (ms: number) => `${count(Math.round(ms))} ms`;

type ResponseProps = { shown: Shown; entry: Entry; canSend: boolean; shortcut: string; picked: string | null; onPick: (field: Fillable, value: string) => void; onRetry: () => void };

export function ResponsePane({ shown, entry, canSend, shortcut, picked, onPick, onRetry }: ResponseProps) {
  const said = shown.state === "answered" ? `${shown.answer.status} ${PHRASES[shown.answer.status] ?? ""}, in ${took(shown.answer.ms)}.` : shown.state === "failed" ? "No answer: the request didn't arrive." : "";
  const status = (
    <p role="status" className="sr-only">
      {said}
    </p>
  );
  // A failure is its own notice, not a notice inside the pane.
  if (shown.state === "failed") {
    return (
      <div className="flex min-w-0 flex-col">
        {status}
        <ErrorNotice error={shown.error} title={`No answer: ${shown.sent.request} didn't reach Asked Before.`} onRetry={onRetry} />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl bg-panel p-4">
      {status}
      {shown.state === "empty" && <Empty entry={entry} canSend={canSend} shortcut={shortcut} />}
      {shown.state === "sending" && (
        <>
          <WaitLine spinner={shown.spends}>{shown.spends ? "Waiting for the model…" : `Sending ${shown.sent.request} ${shown.sent.via}…`}</WaitLine>
          <div aria-hidden="true" className="flex flex-col gap-2">
            <Skeleton className="h-6 w-44 rounded-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={cn("h-4", i % 2 ? "w-48" : "w-72", "max-w-full")} />
            ))}
          </div>
        </>
      )}
      {shown.state === "answered" && <Answered sent={shown.sent} answer={shown.answer} root={shown.root} picked={picked} onPick={onPick} />}
    </div>
  );
}

/** Before a send: how to send, and what this endpoint can answer, in the docs' words. */
function Empty({ entry, canSend, shortcut }: { entry: Entry; canSend: boolean; shortcut: string }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Nothing sent yet</p>
        <p className="text-sm text-muted-foreground">
          {canSend ? (
            <>
              Press Send
              <span className="pointer-coarse:hidden">
                , or <Key>{shortcut}</Key> <Key>Enter</Key>,
              </span>{" "}
              and what it answers shows here, with its status, time, and size. Nothing runs until you do.
            </>
          ) : (
            "This endpoint isn't sent from here. Open one that is, and what it answers shows here."
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-rule pt-3">
        <h3 className="text-sm font-medium">What it can answer</h3>
        <dl className="flex flex-col gap-2 text-sm">
          {answers(entry).map((status) => (
            <div key={status} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
              <dt className="font-medium tabular-nums">{status}</dt>
              <dd className="text-muted-foreground">
                <span className="text-foreground">{PHRASES[status]}.</span> {BEFORE[status] ?? meaning(status)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

export function Key({ children }: { children: string }) {
  return <kbd className="rounded-sm border border-edge bg-background px-1 font-sans text-xs text-foreground">{children}</kbd>;
}

function Answered({ sent, answer, root, picked, onPick }: { sent: Sent; answer: Answer; root: Param | null; picked: string | null; onPick: (field: Fillable, value: string) => void }) {
  const ok = answer.status < 400;
  const words = meaning(answer.status);
  const picks = fills(answer.json, root);
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={cn("rounded-full px-2.5 py-0.5 font-medium tabular-nums", ok ? "bg-positive text-positive-foreground" : "bg-negative text-negative-foreground")}>
            {answer.status} {PHRASES[answer.status] ?? ""}
          </span>
          <span className="text-muted-foreground tabular-nums">{took(answer.ms)}</span>
          <span className="text-muted-foreground tabular-nums">{size(answer.bytes)}</span>
        </p>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          <code>{sent.request}</code> {sent.via}
        </p>
        {words && <p className="text-sm text-muted-foreground">{words}</p>}
      </div>
      {answer.text === "" ? (
        <p className="text-sm text-muted-foreground">No body.</p>
      ) : answer.json === undefined ? (
        <pre className="text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          <code>{answer.text}</code>
        </pre>
      ) : (
        <JsonView value={answer.json} text={answer.text} root={root} onPick={onPick} />
      )}
      {picks && (
        <p role="status" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {picked ?? "Click an underlined id to fill its field in the request."}
        </p>
      )}
    </>
  );
}
