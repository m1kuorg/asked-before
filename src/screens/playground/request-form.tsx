// The request's inputs, the ones the open endpoint takes: its path's ids (a
// picker of your own shelves for :shelfId, a text field for any other id,
// which a click on an id in a response fills), limit and cursor for a list
// a page at a time, the JSON body of a POST or PATCH (one that reads none
// says {} is sent), and who it's sent as: this session, or a pasted API key
// kept in memory only. A field the last Send found wrong is marked, holds
// the message, and has focus. An endpoint that doesn't run here shows why,
// and where the app does it, instead.

import type { Shelf } from "@asked-before/sdk";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Resource } from "@/app/use-resource";
import { Code } from "@/components/section";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { TextLink } from "@/components/text-link";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FIELD_NAMES, hrefOf, sendsBody, ENTRIES, type Entry, type Param } from "./endpoints";
import type { Draft, SendAs } from "./request";

/** A field the last Send found wrong: an id, the body, or the key. */
export type Problem = { field: Param | "body" | "key"; message: string };

type RequestFormProps = {
  entry: Entry;
  guest: boolean;
  shelves: Resource<Shelf[]>;
  /** What the inputs hold; each input changes its part of it. */
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  /** The draft's ids, with the first shelf filled in until another is picked. */
  ids: Draft["ids"];
  /** The open endpoint's body: as typed, or its example. */
  body: string;
  problem: Problem | null;
  /** The id of the control for a field, so a problem can focus it. */
  idOf: (field: string) => string;
};

const POST_SHELVES = ENTRIES.find((entry) => entry.id === "POST /shelves");

export function RequestForm(props: RequestFormProps) {
  const { entry, setDraft, problem, idOf } = props;
  if (entry.off) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <p className="font-medium">Not sent from here</p>
        <p className="text-muted-foreground">
          {entry.off.reason} {entry.off.where}
        </p>
        {entry.off.link && (
          <p>
            <TextLink href={entry.off.link.href}>{entry.off.link.label}</TextLink>
          </p>
        )}
      </div>
    );
  }

  /** aria-invalid and aria-describedby for the field the problem names. */
  const marked = (field: Problem["field"], hint?: string) => ({
    "aria-invalid": problem?.field === field || undefined,
    "aria-describedby": [hint, problem?.field === field ? `${idOf(field)}-error` : undefined].filter(Boolean).join(" ") || undefined,
  });
  const error = (field: Problem["field"]) =>
    problem?.field === field && (
      <FieldError id={`${idOf(field)}-error`} className="text-sm">
        {problem.message}
      </FieldError>
    );

  return (
    <FieldGroup className="gap-5">
      {entry.params.map((param) =>
        param === "shelfId" ? (
          <ShelfField key={param} {...props} marked={marked("shelfId")} error={error("shelfId")} />
        ) : (
          <Field key={param} data-invalid={problem?.field === param || undefined}>
            <FieldLabel htmlFor={idOf(param)}>{FIELD_NAMES[param]}</FieldLabel>
            <Input
              id={idOf(param)}
              name={param}
              value={props.ids[param] ?? ""}
              onChange={({ target: { value } }) => setDraft((before) => ({ ...before, ids: { ...before.ids, [param]: value } }))}
              placeholder="Such as 019a0c2e-…"
              autoComplete="off"
              spellCheck={false}
              /* taste-skill-ignore: an id is code */ className="font-mono"
              {...marked(param, `${idOf(param)}-hint`)}
            />
            <FieldDescription id={`${idOf(param)}-hint`}>Click one in a response to fill it, or paste it.</FieldDescription>
            {error(param)}
          </Field>
        ),
      )}

      {entry.paged && (
        <div className="grid gap-5 @md/request:grid-cols-[8rem_minmax(0,1fr)]">
          <Field>
            <FieldLabel htmlFor={idOf("limit")}>Limit</FieldLabel>
            <Input
              id={idOf("limit")}
              name="limit"
              inputMode="numeric"
              autoComplete="off"
              placeholder="50"
              value={props.draft.limit}
              onChange={({ target: { value } }) => setDraft((before) => ({ ...before, limit: value }))}
              aria-describedby={`${idOf("limit")}-hint`}
              className="tabular-nums"
            />
            <FieldDescription id={`${idOf("limit")}-hint`}>1 to 100; 50 when it's empty.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={idOf("cursor")}>Cursor</FieldLabel>
            <Input
              id={idOf("cursor")}
              name="cursor"
              autoComplete="off"
              spellCheck={false}
              placeholder="The page before's next…"
              value={props.draft.cursor}
              onChange={({ target: { value } }) => setDraft((before) => ({ ...before, cursor: value }))}
              aria-describedby={`${idOf("cursor")}-hint`}
              /* taste-skill-ignore: a cursor is code */ className="font-mono"
            />
            <FieldDescription id={`${idOf("cursor")}-hint`}>Click next in a response to fill it.</FieldDescription>
          </Field>
        </div>
      )}

      {sendsBody(entry) &&
        (entry.noBody ? (
          <p className="text-sm text-muted-foreground">
            It reads no body, so it sends <Code>{"{}"}</Code>, as every POST from the page carries JSON.
          </p>
        ) : (
          <Field data-invalid={problem?.field === "body" || undefined}>
            <FieldLabel htmlFor={idOf("body")}>JSON body</FieldLabel>
            <Textarea
              id={idOf("body")}
              name="body"
              value={props.body}
              onChange={({ target: { value } }) => setDraft((before) => ({ ...before, bodies: { ...before.bodies, [entry.id]: value } }))}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              /* taste-skill-ignore: the body is JSON */ className="min-h-28 font-mono text-xs leading-5 md:text-xs"
              {...marked("body", `${idOf("body")}-hint`)}
            />
            <FieldDescription id={`${idOf("body")}-hint`}>
              Sent with <Code>content-type: application/json</Code>. Left empty, it sends <Code>{"{}"}</Code>.
            </FieldDescription>
            {error("body")}
          </Field>
        ))}

      <SendAsField {...props} marked={marked("key", `${idOf("key")}-hint`)} error={error("key")} />
    </FieldGroup>
  );
}

type Marks = { marked: { "aria-invalid"?: true; "aria-describedby"?: string }; error: ReactNode };

/** :shelfId, from your own shelves. */
function ShelfField({ shelves, ids, setDraft, idOf, problem, marked, error }: RequestFormProps & Marks) {
  const list = shelves.data;
  const nameOf = (id: string) => list?.find((shelf) => shelf.id === id)?.name ?? id;
  return (
    <Field data-invalid={problem?.field === "shelfId" || undefined}>
      <FieldLabel htmlFor={idOf("shelfId")}>Shelf</FieldLabel>
      {list === undefined && shelves.error !== null ? (
        <ErrorNotice error={shelves.error} title="Your shelves didn't load." onRetry={shelves.retry} focus={false} />
      ) : list === undefined ? (
        <Skeleton className="h-10 w-full" />
      ) : list.length === 0 && !ids.shelfId ? (
        <p id={idOf("shelfId")} tabIndex={-1} className="text-sm text-muted-foreground">
          You have no shelves yet.{" "}
          {POST_SHELVES && (
            <TextLink href={hrefOf(POST_SHELVES)}>
              Make one with <code>POST /shelves</code>
            </TextLink>
          )}
          .
        </p>
      ) : (
        <Select value={ids.shelfId ?? null} onValueChange={(value) => value && setDraft((before) => ({ ...before, ids: { ...before.ids, shelfId: value } }))}>
          <SelectTrigger id={idOf("shelfId")} className="w-full bg-background data-[size=default]:h-10 dark:bg-background" {...marked}>
            <SelectValue placeholder="Choose a shelf">{(value: string | null) => (value ? nameOf(value) : "Choose a shelf")}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {list.map((shelf) => (
              <SelectItem key={shelf.id} value={shelf.id} className="min-h-9 max-lg:min-h-11">
                <span className="truncate">{shelf.name}</span>
                {shelf.demo && <DemoChip />}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error}
    </Field>
  );
}

function SendAsField({ draft, setDraft, guest, idOf, problem, marked, error }: RequestFormProps & Marks) {
  return (
    <Field data-invalid={problem?.field === "key" || undefined}>
      <p id={idOf("send-as")} className="text-sm leading-snug font-medium">
        Send as
      </p>
      <ToggleGroup aria-labelledby={idOf("send-as")} className="w-fit!" value={[draft.sendAs]} onValueChange={([next]) => next && setDraft((before) => ({ ...before, sendAs: next as SendAs }))}>
        <ToggleGroupItem value="session">This session</ToggleGroupItem>
        <ToggleGroupItem value="key">An API key</ToggleGroupItem>
      </ToggleGroup>
      {draft.sendAs === "session" ? (
        <FieldDescription>{guest ? "The shared guest's session cookie" : "Your session cookie"}, as the app's own requests send it, with the page's Origin.</FieldDescription>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={idOf("key")}>API key</FieldLabel>
          <Input
            id={idOf("key")}
            name="api-key"
            type="password"
            value={draft.key}
            onChange={({ target: { value } }) => setDraft((before) => ({ ...before, key: value }))}
            placeholder="ab_…"
            autoComplete="off"
            spellCheck={false}
            /* taste-skill-ignore: a key is code */ className="font-mono"
            {...marked}
          />
          <FieldDescription id={`${idOf("key")}-hint`}>
            Sent as a Bearer token, with no cookie. It stays in this page's memory only: never in the address, in storage, or in the code. It's gone when you leave.
            {!guest && (
              <>
                {" "}
                Make one under{" "}
                <TextLink href="/app/settings/keys">API keys</TextLink>
                , in Settings.
              </>
            )}
          </FieldDescription>
          {error}
        </div>
      )}
    </Field>
  );
}
