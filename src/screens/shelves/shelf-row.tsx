// One shelf in the shelves table (brief section 4; inventory.md, Shelves
// list): its name (to the shelf, with Demo data), Cards, Need a rep, Proven,
// Last upload, and Rename and Delete. Rename turns the name into a field in
// place, with Save and Cancel; Escape cancels. Delete opens the confirmation
// in a row under it, never a modal; its toggle is "Delete Work…", and the
// confirmation's action "Delete Work". Below a 40rem canvas the figures move to
// a grey second line under the name. The list owns which row is open and
// where focus goes next; the row focuses its own controls when asked.
import type { Client, Shelf } from "@asked-before/sdk";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ConfirmInline } from "@/components/confirm-inline";
import { DemoChip } from "@/components/demo-chip";
import { Figure } from "@/components/figure";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { count, plural, shortDate } from "@/lib/format";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { shelfName } from "./shelf-name";

export type Mode = "rename" | "delete";
/** A control in a row that should take focus after the row draws again. */
export type FocusTarget = { id: string; on: "name" | "rename" | "delete" };

/** Shown only from a 40rem canvas; under it the figures sit on the name's second line. */
export const wideOnly = "hidden @min-[40rem]/shelves:table-cell";

type ShelfRowProps = {
  shelf: Shelf;
  client: Client;
  mode: Mode | null;
  setMode: (mode: Mode | null) => void;
  focus: FocusTarget | null;
  onFocused: () => void;
  onRenamed: (shelf: Shelf) => void;
  onDeleted: (shelf: Shelf) => Promise<void>;
};

export function ShelfRow({ shelf, client, mode, setMode, focus, onFocused, onRenamed, onDeleted }: ShelfRowProps) {
  const name = useRef<HTMLAnchorElement>(null);
  const rename = useRef<HTMLButtonElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const need = shelf.counts.borrowed + shelf.counts.borrowedAgain;

  useEffect(() => {
    if (focus?.id !== shelf.id) return;
    ({ name, rename, delete: remove })[focus.on].current?.focus();
    onFocused();
  }, [focus, shelf.id, onFocused]);

  const second = [
    plural(shelf.counts.cards, "card"),
    `${count(need)} ${need === 1 ? "needs" : "need"} a rep`,
    `${count(shelf.counts.returned)} proven`,
    shelf.lastUploadAt ? `last upload ${shortDate(shelf.lastUploadAt)}` : "no upload yet",
  ];

  return (
    <>
      <TableRow>
        <TableCell className="w-full max-w-0 @min-[40rem]/shelves:w-2/5">
          {mode === "rename" ? (
            <RenameForm shelf={shelf} client={client} onRenamed={onRenamed} onCancel={() => setMode(null)} />
          ) : (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                <ShelfName shelf={shelf} link={name} />
                {shelf.demo && <DemoChip />}
              </span>
              <span className="flex flex-wrap gap-x-1 text-xs whitespace-normal text-muted-foreground @min-[40rem]/shelves:hidden">
                {/* Each fact keeps its separator, so no line starts or ends on a dot. */}
                {second.map((fact, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {i > 0 && <span aria-hidden="true">· </span>}
                    {fact}
                  </span>
                ))}
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className={`${wideOnly} text-right`}>
          <Figure n={shelf.counts.cards} />
        </TableCell>
        <TableCell className={`${wideOnly} text-right`}>
          <Figure n={need} />
        </TableCell>
        <TableCell className={`${wideOnly} text-right`}>
          <Figure n={shelf.counts.returned} />
        </TableCell>
        <TableCell className={`${wideOnly} text-right`}>{shelf.lastUploadAt ? <Time iso={shelf.lastUploadAt} /> : <span className="text-faint">None yet</span>}</TableCell>
        <TableCell className="text-right">
          {mode !== "rename" && (
            <span className="inline-flex gap-1">
              <Button ref={rename} variant="ghost" size="sm" aria-label={`Rename ${shelf.name}`} onClick={() => setMode("rename")}>
                Rename
              </Button>
              <Button ref={remove} variant="ghost" size="sm" aria-label={`Delete ${shelf.name}…`} aria-expanded={mode === "delete"} onClick={() => setMode(mode === "delete" ? null : "delete")}>
                Delete
              </Button>
            </span>
          )}
        </TableCell>
      </TableRow>
      {mode === "delete" && (
        <TableRow className="bg-muted">
          <TableCell colSpan={6} className="pt-0 pb-4 whitespace-normal first:pl-3 last:pr-3">
            <ConfirmInline
              title={`Delete ${shelf.name}?`}
              body="This deletes the shelf and everything on it: its uploads, messages, cards, and cold reps. It can't be undone."
              action={`Delete ${shelf.name}`}
              onConfirm={() => onDeleted(shelf)}
              onCancel={() => setMode(null)}
              returnFocus={remove}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The name in place: Save or Enter renames it, Cancel or Escape keeps it. The server's message marks the field. */
function RenameForm({ shelf, client, onRenamed, onCancel }: { shelf: Shelf; client: Client; onRenamed: (shelf: Shelf) => void; onCancel: () => void }) {
  const field = useRef<HTMLInputElement>(null);
  const submit = useSafeSubmit(async (form) => {
    onRenamed(await client.shelves.rename(shelf.id, shelfName(new FormData(form).get("name"))));
  });
  useEffect(() => {
    field.current?.select();
  }, []);
  return (
    <form
      {...submit.form}
      aria-label={`Rename ${shelf.name}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !submit.busy) onCancel();
      }}
      className="flex flex-col gap-2"
    >
      <Field data-invalid={submit.invalid === "name" || undefined} orientation="horizontal" className="flex-wrap">
        <Input ref={field} defaultValue={shelf.name} aria-label={`Name of ${shelf.name}`} autoComplete="off" className="min-w-40 flex-1" {...submit.field("name")} />
        <span className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={submit.busy} onClick={onCancel}>
            Cancel
          </Button>
        </span>
      </Field>
      {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
    </form>
  );
}

/** The shelf's name as a link, cut to its cell with the whole name in a tooltip only when it's cut. */
function ShelfName({ shelf, link }: { shelf: Shelf; link: RefObject<HTMLAnchorElement | null> }) {
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const node = link.current;
    if (!node) return;
    const measure = () => setCut(node.scrollWidth > node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shelf.name, link]);
  return (
    <Tooltip>
      <TooltipTrigger
        disabled={!cut}
        render={<a ref={link} href={`/app/shelves/${encodeURIComponent(shelf.id)}`} className="min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline" />}
      >
        {shelf.name}
      </TooltipTrigger>
      <TooltipContent>{shelf.name}</TooltipContent>
    </Tooltip>
  );
}
