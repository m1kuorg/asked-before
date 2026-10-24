// Playground (/app/playground): what does this endpoint answer? It sends a
// real request to /api/v1 with fetch, as this session or with a pasted API
// key, and shows the whole answer (plan.md, Playground; plan-review.md notes
// 4 and 8 and its table of endpoint classes). The endpoints are the docs'
// (endpoints.ts), opened by ?endpoint=GET%20/shelves, a local query param,
// so picking one redraws the screen without remounting it: the inputs, the
// key, and the last answer stay. Under the address, with Send at its end
// (or ⌘Enter, Ctrl+Enter elsewhere), what the endpoint does and who may
// send it; then the request's inputs beside the response, and the request
// as code. Nothing runs on page load. A DELETE asks first, in place, naming
// the object; one that spends model requests says what it costs and needs a
// second click; one that would end or replace this session or the account
// doesn't run here. A send that changes something refreshes the shelf
// picker and the sidebar. Ids picked in a response fill their fields, which
// every endpoint shares. On a canvas under 42rem the panes stack and the
// endpoint list is a select.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ScreenProps } from "@/app/router";
import { useShell } from "@/app/shell";
import { useResource } from "@/app/use-resource";
import { ConfirmInline } from "@/components/confirm-inline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CodeTabs } from "./playground/code-tabs";
import { EndpointList, EndpointSelect, breakable } from "./playground/endpoint-list";
import { FIELD_NAMES, FIRST, entryOf, hrefOf, type Entry, type Fillable, type Param } from "./playground/endpoints";
import { build, exampleBody, send, type Built, type Draft } from "./playground/request";
import { RequestForm, type Problem } from "./playground/request-form";
import { ResponsePane, type Sent, type Shown } from "./playground/response";
import { SpendConfirm } from "./playground/spend-confirm";

/** What Send is asking before it sends: a delete naming its object, or a model request's cost. */
type Asking = { kind: "delete"; title: string; action: string } | { kind: "spend" } | null;

/** Apple's platforms, by the user agent (navigator.platform is deprecated); an iPad's says Macintosh. */
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const SHORTCUT = MAC ? "⌘" : "Ctrl";

const WHO: Record<Entry["who"], string> = {
  "Key or session": "An API key or this session can send it.",
  "Session only": "Only a session can send it: with an API key it answers 403.",
  None: "It needs no session or key.",
};

export function Playground({ client, account, query, navigate, signal }: ScreenProps) {
  const { refreshShell } = useShell();
  const shelves = useResource(() => client.shelves.list(), []);
  const asked = query.get("endpoint");
  const entry = entryOf(asked) ?? FIRST;

  const [draft, setDraft] = useState<Draft>({ ids: {}, limit: "", cursor: "", bodies: {}, sendAs: "session", key: "" });
  const [shown, setShown] = useState<Shown>({ state: "empty" });
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<Asking>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const idOf = (field: string) => `${uid}-${field}`;

  // The shelf is the first of yours until another is picked.
  const filled = useMemo(() => ({ ...draft.ids, shelfId: draft.ids.shelfId ?? shelves.data?.[0]?.id }), [draft.ids, shelves.data]);
  const shelfName = shelves.data?.find((shelf) => shelf.id === filled.shelfId)?.name;
  const example = useMemo(() => exampleBody(entry, shelfName), [entry, shelfName]);
  const body = draft.bodies[entry.id] ?? example;
  const built = useMemo(() => build({ entry, ids: filled, limit: draft.limit, cursor: draft.cursor, body }), [entry, filled, draft.limit, draft.cursor, body]);

  // A change to the request closes a question Send asked about it, and clears the last Send's problem.
  const signature = `${entry.id} ${built.url} ${built.body} ${draft.sendAs} ${draft.key.trim() !== ""}`;
  useEffect(() => {
    setAsking(null);
    setProblem(null);
  }, [signature]);
  useEffect(() => {
    if (problem) document.getElementById(idOf(problem.field))?.focus();
  }, [problem]);

  const choose = (next: Entry) => navigate(hrefOf(next), { replace: true });

  /** What a DELETE names, by its noun: the id it takes, and a look-up of the object's name. */
  const deleting = {
    shelf: { id: filled.shelfId, name: async () => shelfName },
    upload: { id: filled.uploadId, name: async () => (await client.uploads.get(filled.uploadId!)).fileName },
    key: { id: filled.keyId, name: async () => (await client.keys.list()).find((key) => key.id === filled.keyId)?.name },
  };

  async function onSend() {
    if (busy || asking || entry.off) return;
    const missing = built.missing[0];
    if (missing) return setProblem({ field: missing, message: missing === "shelfId" ? "Choose a shelf first." : `Fill in the ${FIELD_NAMES[missing].toLowerCase()}: click one in a response, or paste it.` });
    if (built.bodyError) return setProblem({ field: "body", message: `The body isn't JSON: ${built.bodyError}` });
    if (draft.sendAs === "key" && !draft.key.trim()) return setProblem({ field: "key", message: "Paste an API key, or send as this session." });
    if (entry.deletes) {
      const { verb, noun } = entry.deletes;
      const { id, name: lookUp } = deleting[noun];
      // Not yours, or not there: the DELETE itself will say so.
      const name = await lookUp().catch(() => undefined);
      return setAsking({ kind: "delete", title: name ? `${verb} ${name}?` : `${verb} the ${noun} ${id}?`, action: name ? `${verb} ${name}` : `${verb} this ${noun}` });
    }
    if (entry.spends) return setAsking({ kind: "spend" });
    await run();
  }

  const latest = useRef(onSend);
  latest.current = onSend;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.repeat || event.defaultPrevented) return;
      event.preventDefault();
      void latest.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function run() {
    const sent: Sent = { request: `${built.method} ${built.url}`, via: draft.sendAs === "key" ? "with an API key" : "as this session" };
    setBusy(true);
    setPicked(null);
    setShown({ state: "sending", sent, spends: entry.spends !== undefined });
    try {
      const answer = await send(built, draft.sendAs, draft.key, signal);
      setShown({ state: "answered", sent, answer, root: entry.returns ?? null });
      if (answer.status < 300 && built.method !== "GET") {
        // The picker, the sidebar's shelves, and its counts follow what changed.
        shelves.retry();
        refreshShell();
        if (entry.id === "DELETE /shelves/:shelfId") setDraft((before) => ({ ...before, ids: { ...before.ids, shelfId: undefined } }));
      }
    } catch (error) {
      if (!signal.aborted) setShown({ state: "failed", sent, error });
    } finally {
      setBusy(false);
    }
  }

  /** After a question's answer is sent, Send has focus again. */
  async function confirmed() {
    await run();
    setAsking(null);
    sendButton.current?.focus();
  }

  function pick(field: Fillable, value: string) {
    setDraft((before) => (field === "cursor" ? { ...before, cursor: value } : { ...before, ids: { ...before.ids, [field]: value } }));
    const takes = field === "cursor" ? entry.paged : entry.params.includes(field);
    const said = field === "shelfId" ? (shelves.data?.find((shelf) => shelf.id === value)?.name ?? value) : value;
    setPicked(`${FIELD_NAMES[field]} filled with ${said}${takes ? "." : ", for the next endpoint that takes one."}`);
  }

  return (
    <div className="@container/screen flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Playground</h1>
        <p className="text-muted-foreground">Send a real request to Asked Before's API, as this session or with an API key, and see what it answers. Nothing is sent until you press Send.</p>
        {asked !== null && !entryOf(asked) && (
          <p className="text-sm text-muted-foreground">
            There's no endpoint “{asked}”, so <code translate="no">{FIRST.id}</code> is open.
          </p>
        )}
      </header>

      <div className="grid gap-6 @2xl/screen:grid-cols-[15rem_minmax(0,1fr)] @6xl/screen:grid-cols-[17rem_minmax(0,1fr)]">
        <EndpointList open={entry} choose={choose} />
        <div className="@container/work flex min-w-0 flex-col gap-4">
          <EndpointSelect open={entry} choose={choose} id={idOf("endpoint")} />
          <Address entry={entry} built={built} ids={filled} busy={busy} onSend={onSend} sendButton={sendButton} />
          <About entry={entry} guest={account.guest} spendAsked={asking?.kind === "spend"} />
          {asking?.kind === "delete" && entry.deletes && (
            <ConfirmInline title={asking.title} body={entry.deletes.body} action={asking.action} returnFocus={sendButton} onCancel={() => setAsking(null)} onConfirm={confirmed} />
          )}
          {asking?.kind === "spend" && entry.spends && (
            <SpendConfirm title={entry.spends.title} cost={entry.spends.cost} action={entry.spends.action} returnFocus={sendButton} onCancel={() => setAsking(null)} onConfirm={confirmed} />
          )}

          {/* Wide: the request and its code on the left, the response beside both. Narrow: the request, the response, then the code. */}
          <div className="grid items-start gap-x-6 gap-y-8 @3xl/work:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @3xl/work:grid-rows-[auto_1fr]">
            <Pane title="Request" className="@container/request">
              <RequestForm entry={entry} guest={account.guest} shelves={shelves} draft={draft} setDraft={setDraft} ids={filled} body={body} problem={problem} idOf={idOf} />
            </Pane>
            <Pane title="Response" className="@3xl/work:col-start-2 @3xl/work:row-span-2 @3xl/work:row-start-1">
              <ResponsePane shown={shown} entry={entry} canSend={!entry.off} shortcut={SHORTCUT} picked={picked} onPick={pick} onRetry={onSend} />
            </Pane>
            {!entry.off && <CodeTabs built={built} entry={entry} ids={filled} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pane({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`flex min-w-0 flex-col gap-3 ${className ?? ""}`}>
      <h2 id={headingId} className="text-base font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

type AddressProps = { entry: Entry; built: Built; ids: Partial<Record<Param, string>>; busy: boolean; onSend: () => void; sendButton: RefObject<HTMLButtonElement | null> };

/** The request's one line: the method, the path under /api/v1 with its ids and page, and Send at its end. */
function Address({ entry, built, ids, busy, onSend, sendButton }: AddressProps) {
  const query = new URLSearchParams(built.page).toString();
  return (
    <div role="group" aria-label="Address" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-edge bg-background py-1.5 pr-1.5 pl-3">
      <code translate="no" className="rounded-md bg-panel px-1.5 py-0.5 text-xs font-medium">
        {entry.method}
      </code>{" "}
      <code translate="no" className="min-w-48 flex-1 py-1.5 text-sm [overflow-wrap:anywhere]">
        <span className="text-muted-foreground">/api/v1</span>
        {entry.path.split(/(:\w+)/).map((part, i) => {
          if (!part.startsWith(":")) return <span key={i} className="text-muted-foreground">{breakable(part)}</span>;
          const value = ids[part.slice(1) as Param];
          return value ? <span key={i}>{value}</span> : <span key={i} className="text-faint">{part}</span>;
        })}
        {query && <span className="text-muted-foreground">?{query}</span>}
      </code>
      {!entry.off && (
        <Button ref={sendButton} onClick={onSend} disabled={busy} aria-keyshortcuts="Meta+Enter Control+Enter" className="@max-md/work:w-full">
          {busy && <Spinner data-icon="inline-start" />}
          Send
          <span aria-hidden="true" className="text-xs font-normal text-primary-foreground/70 pointer-coarse:hidden">
            {SHORTCUT}↵
          </span>
        </Button>
      )}
    </div>
  );
}

/** What the endpoint does, in the docs' words, who may send it, and what it costs or carries. */
function About({ entry, guest, spendAsked }: { entry: Entry; guest: boolean; spendAsked: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex max-w-prose flex-col gap-1 text-muted-foreground">
        <p>{entry.does}</p>
        <p>
          {WHO[entry.who]}
          {guest && entry.notGuest && " As the shared guest, it answers 403: keys and an account's data are for an account of one's own."}
        </p>
      </div>
      {entry.note && (
        <Alert variant="notice" role="note">
          <AlertDescription>{entry.note}</AlertDescription>
        </Alert>
      )}
      {entry.spends && !spendAsked && (
        <Alert variant="notice" role="note">
          <AlertDescription>{entry.spends.cost} Send asks before it sends.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
