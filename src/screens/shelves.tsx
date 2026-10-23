// Shelves (/app/shelves; shelves.list()). A list screen: the h1, what a
// shelf is for, "New shelf" at the top right, then a table of every shelf
// with its counts and Rename and Delete in place (brief section 4; inventory.md,
// Shelves list and Flows 5 to 8). One row is open at a time: opening Rename
// closes a Delete and the reverse. Every change calls refreshShell() so the
// sidebar's shelves and counts follow, and is said in a status line for
// screen readers. Focus: after a rename or its cancel, that row's Rename;
// after a delete, the next row's name, or the new-shelf field when none is
// left; cancelling a delete returns to its Delete (ConfirmInline does that).
import type { Shelf } from "@asked-before/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenProps } from "@/app/router";
import { useShell } from "@/app/shell";
import { useResource } from "@/app/use-resource";
import { ErrorNotice } from "@/components/error-notice";
import { WaitLine } from "@/components/wait-line";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NEED_REP_COLUMN, needRep } from "@/lib/copy";
import { plural } from "@/lib/format";
import { DemoShelfButton } from "./shelves/demo-shelf-button";
import { NewShelf } from "./shelves/new-shelf";
import { ShelfRow, wideOnly, type FocusTarget, type Mode } from "./shelves/shelf-row";

type Open = { id: string; mode: Mode } | null;

export function Shelves({ client, navigate }: ScreenProps) {
  const { refreshShell } = useShell();
  const shelves = useResource(() => client.shelves.list(), []);
  const [open, setOpen] = useState<Open>(null);
  const [focus, setFocus] = useState<FocusTarget | "new" | null>(null);
  const [said, setSaid] = useState("");
  const newField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focus !== "new") return;
    newField.current?.focus();
    setFocus(null);
  }, [focus]);
  const focused = useCallback(() => setFocus(null), []);

  function setMode(shelf: Shelf, mode: Mode | null) {
    if (mode === null && open?.id === shelf.id && open.mode === "rename") setFocus({ id: shelf.id, on: "rename" });
    setOpen(mode ? { id: shelf.id, mode } : null);
  }

  function created(shelf: Shelf) {
    shelves.setData((list) => [...(list ?? []), shelf]);
    setSaid(`Added ${shelf.name}.`);
    refreshShell();
  }

  function renamed(shelf: Shelf) {
    const before = shelves.data?.find((each) => each.id === shelf.id)?.name;
    shelves.setData((list) => list?.map((each) => (each.id === shelf.id ? shelf : each)));
    setOpen(null);
    setFocus({ id: shelf.id, on: "rename" });
    setSaid(before && before !== shelf.name ? `Renamed ${before} to ${shelf.name}.` : `Kept the name ${shelf.name}.`);
    refreshShell();
  }

  async function deleted(shelf: Shelf) {
    await client.shelves.delete(shelf.id);
    const list = shelves.data ?? [];
    const at = list.findIndex((each) => each.id === shelf.id);
    const rest = list.filter((each) => each.id !== shelf.id);
    const next = rest[Math.min(at, rest.length - 1)];
    shelves.setData(rest);
    setOpen(null);
    setFocus(next ? { id: next.id, on: "name" } : "new");
    setSaid(`Deleted ${shelf.name}.`);
    refreshShell();
  }

  const list = shelves.data;
  return (
    <div className="@container/shelves flex flex-col gap-8">
      <div className="flex flex-col gap-6 @min-[48rem]/shelves:flex-row @min-[48rem]/shelves:items-end @min-[48rem]/shelves:justify-between">
        <div className="flex max-w-xl flex-col gap-1">
          <h1 className="text-2xl font-semibold">Shelves</h1>
          <p className="text-sm text-muted-foreground">
            A shelf keeps one part of your history apart, such as Work or Bootcamp. Its cards come only from its own uploads, so a question from one never lands on another's card.
          </p>
        </div>
        <NewShelf client={client} field={newField} onCreated={created} />
      </div>
      <p role="status" className="sr-only">
        {said}
      </p>

      {list ? (
        list.length ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{total(list)}</p>
            <Table>
              <TableCaption className="sr-only">Your shelves</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className={`${wideOnly} text-right`}>Cards</TableHead>
                  <TableHead className={`${wideOnly} text-right`}>{NEED_REP_COLUMN}</TableHead>
                  <TableHead className={`${wideOnly} text-right`}>Proven</TableHead>
                  <TableHead className={`${wideOnly} text-right`}>Last upload</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((shelf) => (
                  <ShelfRow
                    key={shelf.id}
                    shelf={shelf}
                    client={client}
                    mode={open?.id === shelf.id ? open.mode : null}
                    setMode={(mode) => setMode(shelf, mode)}
                    focus={typeof focus === "object" ? focus : null}
                    onFocused={focused}
                    onRenamed={renamed}
                    onDeleted={deleted}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No shelves yet</EmptyTitle>
              <EmptyDescription>
                Make one for each part of your life you ask a chatbot about. Then upload a chat export to it, and every question you asked more than once becomes a card.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <DemoShelfButton client={client} navigate={navigate} />
            </EmptyContent>
          </Empty>
        )
      ) : shelves.error !== null ? (
        <ErrorNotice error={shelves.error} title="Your shelves didn't load." onRetry={shelves.retry} />
      ) : (
        <div className="flex flex-col gap-3">
          <WaitLine>Finding your shelves…</WaitLine>
          <Table aria-hidden="true">
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell className="w-full">
                    <Skeleton className="h-3.5 w-32" />
                  </TableCell>
                  {[0, 1, 2].map((j) => (
                    <TableCell key={j} className={wideOnly}>
                      <Skeleton className="ml-auto h-3.5 w-6" />
                    </TableCell>
                  ))}
                  <TableCell className={wideOnly}>
                    <Skeleton className="ml-auto h-3.5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-8 w-36 max-lg:h-11 pointer-coarse:h-11" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** The list's total, over the table: "2 shelves, 5 cards, 4 cards need a cold rep." */
function total(list: Shelf[]): string {
  const cards = list.reduce((sum, shelf) => sum + shelf.counts.cards, 0);
  const need = list.reduce((sum, shelf) => sum + shelf.counts.borrowed + shelf.counts.borrowedAgain, 0);
  return `${plural(list.length, "shelf", "shelves")}, ${plural(cards, "card")}. ${needRep(need)}.`;
}
