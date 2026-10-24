// Your keys: the keys (name, prefix, made, last used), and a one-line form
// that makes one; the label column sums them up (how many, and the last
// use) and points to Connect your AI, whose snippets a key goes in. A new
// key is the only answer that carries the whole key, so it's shown once,
// under its row, with its copy button focused, and it stays in this view's
// memory alone until the learner leaves: never in the URL or in storage.
// Revoking asks first, in place under the row: the row's "Revoke Laptop…"
// opens it, and its "Revoke Laptop" revokes.

import type { ApiKey, CreatedApiKey } from "@asked-before/sdk";
import { Fragment, useId, useRef, useState } from "react";
import { PLACEHOLDERS } from "../../../packages/mcp/src/connect";
import type { ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { ConfirmInline } from "@/components/confirm-inline";
import { ErrorNotice } from "@/components/error-notice";
import { Figure } from "@/components/figure";
import { Time } from "@/components/time";
import { WaitLine } from "@/components/wait-line";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DASH } from "@/lib/format";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { Code, Section } from "@/components/section";
import { ShownKey } from "@/components/shown-key";
import { TextLink } from "@/components/text-link";
import { Facts, type Fact } from "./facts";

/** Below this panel width the table's rows become two lines: the name and Revoke, then the prefix and dates. */
const WIDE = "hidden @xl/keys:table-cell";

export function ApiKeys({ client }: Pick<ScreenProps, "client">) {
  const keys = useResource(() => client.keys.list(), []);
  /** The key made on this visit, whole; null before one is made, or once it's revoked. */
  const [made, setMade] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  /** Whether the new key's copy button takes focus when it's drawn: once, when the key arrives, not again after a revoke is kept. */
  const [focusMade, setFocusMade] = useState(false);
  const [name, setName] = useState("");
  const nameId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const revokeButtons = useRef(new Map<string, HTMLButtonElement>());

  const submit = useSafeSubmit(async () => {
    const created = await client.keys.create({ name });
    const { key: _shownOnce, ...listed } = created;
    if (keys.data) keys.setData((list) => list && [...list, listed]);
    else keys.retry();
    setRevoking(null);
    setName("");
    setFocusMade(true);
    setMade(created);
  });

  function revoke(key: ApiKey) {
    setFocusMade(false);
    setRevoking((open) => (open === key.id ? null : key.id));
  }

  function detail(key: ApiKey) {
    if (key.id === revoking) {
      return (
        <ConfirmInline
          title={`Revoke ${key.name}?`}
          body="Anything that uses this key loses access to your shelves at once. It can't be undone."
          action={`Revoke ${key.name}`}
          returnFocus={{ current: revokeButtons.current.get(key.id) ?? null }}
          onCancel={() => setRevoking(null)}
          onConfirm={async () => {
            await client.keys.revoke(key.id);
            keys.setData((list) => list?.filter((k) => k.id !== key.id));
            if (made?.id === key.id) setMade(null);
            setRevoking(null);
            nameInput.current?.focus();
          }}
        />
      );
    }
    // The new key, shown this once under its row, and where it goes.
    if (key.id === made?.id) {
      return (
        <ShownKey made={made} autoFocus={focusMade} framed>
          It's what goes in for <Code>{PLACEHOLDERS.apiKey}</Code> in an agent's snippet, on <TextLink href="/app/connect">Connect your AI</TextLink>.
        </ShownKey>
      );
    }
    return null;
  }

  return (
    <Section
      id="your-keys"
      title="Your keys"
      description={
        <>
          <p>
            A key goes in for <Code>{PLACEHOLDERS.apiKey}</Code> in an agent's snippet, on <TextLink href="/app/connect">Connect your AI</TextLink>, which can make one for the agent too.
          </p>
          <Facts facts={summary(keys.data, keys.error !== null)} />
        </>
      }
    >
      {keys.error !== null && !keys.data ? (
        <ErrorNotice error={keys.error} title="Your API keys didn't load." onRetry={keys.retry} />
      ) : keys.data?.length === 0 ? (
        <Empty className="p-5">
          <EmptyHeader>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>Make one below for a script or an agent. It's shown once, when you make it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="@container/keys">
          <Table>
            <TableCaption className="sr-only">Your API keys</TableCaption>
            <TableHeader className="[&_tr]:border-edge">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className={WIDE}>Prefix</TableHead>
                <TableHead className={`${WIDE} text-right`}>Made</TableHead>
                <TableHead className={`${WIDE} text-right`}>Last used</TableHead>
                <TableHead className="w-0 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.data
                ? keys.data.map((key) => {
                    const open = detail(key);
                    return (
                      <Fragment key={key.id}>
                        <TableRow className={open ? "border-0" : "border-border"}>
                          <TableCell className="max-w-0 w-full font-medium">
                            <span className="block truncate">{key.name}</span>
                            <span className="mt-1 flex flex-wrap gap-x-2 text-xs font-normal text-muted-foreground @xl/keys:hidden">
                              <code className="text-foreground">{key.prefix}</code>
                              <span>
                                Made <Time iso={key.createdAt} format="iso" />
                              </span>
                              <span>{key.lastUsedAt ? <>Last used <Time iso={key.lastUsedAt} format="iso" /></> : "Never used"}</span>
                            </span>
                          </TableCell>
                          <TableCell className={WIDE}>
                            <code>{key.prefix}</code>
                          </TableCell>
                          <TableCell className={`${WIDE} text-right tabular-nums text-muted-foreground`}>
                            <Time iso={key.createdAt} format="iso" />
                          </TableCell>
                          <TableCell className={`${WIDE} text-right tabular-nums text-muted-foreground`}>
                            {key.lastUsedAt ? <Time iso={key.lastUsedAt} format="iso" /> : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              ref={(button) => {
                                if (button) revokeButtons.current.set(key.id, button);
                                else revokeButtons.current.delete(key.id);
                              }}
                              variant="ghost"
                              size="sm"
                              aria-label={`Revoke ${key.name}…`}
                              aria-expanded={revoking === key.id}
                              onClick={() => revoke(key)}
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="border-border">
                            <TableCell colSpan={5} className="pt-0 whitespace-normal">
                              {open}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                : (
                  <TableRow className="border-border">
                    <TableCell className="max-w-0 w-full">
                      <WaitLine>Finding your API keys…</WaitLine>
                    </TableCell>
                    <TableCell className={WIDE}>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell className={WIDE}>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className={WIDE}>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-16 max-lg:h-11 pointer-coarse:h-11" />
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      )}

      <form {...submit.form} className="flex flex-col gap-2">
        <Field data-invalid={submit.invalid === "name" || undefined}>
          <FieldLabel htmlFor={nameId}>Key name</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              ref={nameInput}
              id={nameId}
              className="min-w-60 flex-1"
              placeholder="Such as Laptop or Claude Code"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              {...submit.field("name")}
            />
            <Button type="submit" disabled={submit.busy}>
              {submit.busy && <Spinner data-icon="inline-start" />}
              Create key
            </Button>
          </div>
        </Field>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
      </form>
    </Section>
  );
}

/** The label column's sum of the keys: how many, and the latest use of any of them, with its key's name. Bars while they load; dashes if they didn't, since the panel says why. */
function summary(keys: ApiKey[] | undefined, failed: boolean): Fact[] {
  if (!keys) {
    const value = failed ? DASH : undefined;
    return [
      { term: "Keys", value },
      { term: "Last used", value },
    ];
  }
  const used = keys.filter((key) => key.lastUsedAt !== null).sort((a, b) => Date.parse(b.lastUsedAt!) - Date.parse(a.lastUsedAt!));
  const last = used[0];
  return [
    { term: "Keys", value: <Figure n={keys.length} /> },
    {
      term: "Last used",
      value: last ? (
        <>
          {last.name}, <Time iso={last.lastUsedAt!} format="iso" />
        </>
      ) : keys.length ? (
        "Never"
      ) : (
        DASH
      ),
    },
  ];
}
