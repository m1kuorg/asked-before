// Each export uploaded onto this shelf, newest first, 50 at a time: when
// (linking to its own page, where its sort is watched), the file, the
// chatbot, how many of your messages it held, and how many were new; an
// upload whose sort isn't done says where it stands. Delete opens the
// confirmation in place under the row (inventory.md, "Shelf"). Below 640px a
// row is the date over a grey line of the rest, with Delete at the right. A
// long file name wraps anywhere rather than being cut.

import type { Client, Shelf, Upload, UploadPage } from "@asked-before/sdk";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { ConfirmInline } from "@/components/confirm-inline";
import { Figure } from "@/components/figure";
import { Time } from "@/components/time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SOURCE_NAMES } from "@/lib/copy";
import { count, plural, shortDate } from "@/lib/format";
import { PAGE, uploadPath, watchPath } from "@/screens/shelf/data";
import { ShowMore, usePages } from "@/screens/shelf/paging";

/** Where an upload whose sort isn't done stands. */
const STANDING: Partial<Record<Upload["status"], string>> = {
  receiving: "Didn't finish sending",
  waiting: "Waiting to be sorted",
  sorting: "Being sorted",
  failed: "Sort failed",
};

type UploadsViewProps = { client: Client; shelf: Shelf; first: UploadPage; signal: AbortSignal; onDeleted: () => Promise<void> };

export function UploadsView({ client, shelf, first, signal, onDeleted }: UploadsViewProps) {
  const pages = usePages(
    { items: first.uploads, next: first.next },
    (cursor) => client.uploads.list(shelf.id, { limit: PAGE, cursor }).then((page) => ({ items: page.uploads, next: page.next })),
    signal,
  );
  const [open, setOpen] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  if (!pages.items.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No uploads yet</EmptyTitle>
          <EmptyDescription>Upload a chat export onto this shelf, and every question you asked more than once becomes a card.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <a href={uploadPath(shelf.id)} className={cn(buttonVariants({ variant: "secondary" }))}>
            Upload a chat export
          </a>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        {`Each chat export uploaded into ${shelf.name}, newest first, with how many of your messages it held and how many of them were new.`}
      </p>
      <div ref={pages.list}>
        <Table className="max-sm:block">
          <TableCaption className="sr-only">{`Uploads into ${shelf.name}, newest first`}</TableCaption>
          <TableHeader className="max-sm:hidden">
            <TableRow>
              <TableHead>Uploaded</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Your messages</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="max-sm:block">
            {pages.items.flatMap((upload, index) => {
              const date = shortDate(upload.createdAt);
              const rows: ReactNode[] = [
                <TableRow key={upload.id} data-row={index} className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1 max-sm:py-3">
                  <TableCell className="max-sm:p-0">
                    <a href={watchPath(shelf.id, upload.id)} className="font-medium hover:underline hover:underline-offset-4">
                      <Time iso={upload.createdAt} />
                    </a>
                    {STANDING[upload.status] && <span className="block text-xs text-muted-foreground">{STANDING[upload.status]}</span>}
                  </TableCell>
                  <TableCell className="max-w-56 break-all whitespace-normal text-muted-foreground max-sm:hidden">{upload.fileName}</TableCell>
                  <TableCell className="text-muted-foreground max-sm:hidden">{SOURCE_NAMES[upload.source]}</TableCell>
                  <TableCell className="text-right max-sm:hidden">
                    <Figure n={upload.messages} />
                  </TableCell>
                  <TableCell className="text-right max-sm:hidden">
                    <Figure n={upload.phrasings} />
                  </TableCell>
                  {/* On a phone, the file, source, and counts as one grey line under the date. */}
                  <TableCell className="hidden min-w-0 p-0 text-sm whitespace-normal text-muted-foreground max-sm:col-start-1 max-sm:row-start-2 max-sm:block">
                    <span className="break-all">{upload.fileName}</span>
                    {` · ${SOURCE_NAMES[upload.source]} · ${plural(upload.messages, "message")} · ${count(upload.phrasings)} new`}
                  </TableCell>
                  <TableCell className="text-right sm:w-0 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete the upload of ${date}, ${upload.fileName}`}
                      aria-expanded={open === upload.id}
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        setOpen(open === upload.id ? null : upload.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>,
              ];
              if (open === upload.id) {
                rows.push(
                  <TableRow key={`${upload.id}-confirm`} className="bg-muted max-sm:block">
                    <TableCell colSpan={6} className="pt-0 whitespace-normal max-sm:block max-sm:px-0 max-sm:pb-3">
                      <ConfirmInline
                        title={`Delete the upload of ${date}?`}
                        body={
                          upload.phrasings
                            ? `This deletes the ${plural(upload.phrasings, "message")} ${upload.fileName} brought into ${shelf.name}, and any card left with fewer than two asks, with its cold reps; a card's last message goes back to Not on a card. It can't be undone.`
                            : `${upload.fileName} brought nothing new into ${shelf.name}, so only the upload goes. It can't be undone.`
                        }
                        action="Delete the upload"
                        returnFocus={opener}
                        onCancel={() => setOpen(null)}
                        onConfirm={async () => {
                          await client.uploads.delete(upload.id);
                          setOpen(null);
                          await onDeleted();
                        }}
                      />
                    </TableCell>
                  </TableRow>,
                );
              }
              return rows;
            })}
          </TableBody>
        </Table>
      </div>
      <ShowMore pages={pages} noun="uploads" />
    </div>
  );
}
