// Your messages on this shelf that nothing else asks yet, word for word with
// the day you sent each, newest first, 50 at a time with "Show more". The sort
// catches most repeats, not all, so these are never called "asked once". A
// long message (a pasted log, say) is clamped to four lines with a visible
// "Show the whole message". Below 640px each row is the message over its date.

import type { Client, Shelf, StoredPhrasing, UnsortedPage, Upload } from "@asked-before/sdk";
import { useId, useState } from "react";
import { cn } from "cn";
import { Phrasing } from "@/components/phrasing";
import { Time } from "@/components/time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE, sorting, uploadPath, watchPath } from "@/screens/shelf/data";
import { ShowMore, usePages } from "@/screens/shelf/paging";
import { SortingLine } from "@/screens/shelf/sorting-line";

type OnceViewProps = { client: Client; shelf: Shelf; first: UnsortedPage; uploads: Upload[]; signal: AbortSignal };

export function OnceView({ client, shelf, first, uploads, signal }: OnceViewProps) {
  const pages = usePages(
    { items: first.phrasings, next: first.next },
    (cursor) => client.cards.unsorted(shelf.id, { limit: PAGE, cursor }).then((page) => ({ items: page.phrasings, next: page.next })),
    signal,
  );
  const under = sorting(uploads);
  if (!pages.items.length) return <NothingHere shelf={shelf} uploads={uploads} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        {`Your messages in ${shelf.name} that nothing else asks yet. Each waits here until a later one asks the same thing, and then they become a card.`}
      </p>
      {under && <SortingLine shelf={shelf} upload={under} more="messages" />}
      <div ref={pages.list}>
        <Table className="max-sm:block">
          <TableCaption className="sr-only">{`Your messages in ${shelf.name} not on a card, newest first`}</TableCaption>
          <TableHeader className="max-sm:hidden">
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead className="w-32 text-right">Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="max-sm:block">
            {pages.items.map((message, index) => (
              <TableRow key={message.id} data-row={index} className="max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:py-3">
                <TableCell className="whitespace-normal wrap-anywhere max-sm:p-0">
                  <Message message={message} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground max-sm:p-0 max-sm:text-left max-sm:text-xs">
                  <Time iso={message.time} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ShowMore pages={pages} noun="messages" />
    </div>
  );
}

/** Over 280 characters or 4 lines, a message shows its first 4 lines until asked for the rest. */
function Message({ message }: { message: StoredPhrasing }) {
  const long = message.text.length > 280 || message.text.split("\n").length > 4;
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col items-start gap-1">
      <p id={id} className={long && !open ? "line-clamp-4 whitespace-pre-line" : "whitespace-pre-line"}>
        <Phrasing text={message.text} />
      </p>
      {long && (
        <Button variant="link" size="xs" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="text-xs">
          {open ? "Show less" : "Show the whole message"}
        </Button>
      )}
    </div>
  );
}

/** No message off a card: nothing uploaded, a sort under way, or every message is on one. */
function NothingHere({ shelf, uploads }: { shelf: Shelf; uploads: Upload[] }) {
  const under = sorting(uploads);
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{uploads.length ? "Nothing here" : "Nothing here yet"}</EmptyTitle>
        <EmptyDescription>
          {!uploads.length
            ? "Upload a chat export onto this shelf, and your messages that nothing else asks yet show here."
            : under
              ? `Your upload into ${shelf.name} is still being sorted. Messages that land on no card show here once the sort is done.`
              : `Every message sorted into ${shelf.name} so far is on a card.`}
        </EmptyDescription>
      </EmptyHeader>
      {(!uploads.length || under) && (
        <EmptyContent>
          <a href={under ? watchPath(shelf.id, under.id) : uploadPath(shelf.id)} className={cn(buttonVariants({ variant: "secondary" }))}>
            {under ? "See its sort" : "Upload a chat export"}
          </a>
        </EmptyContent>
      )}
    </Empty>
  );
}
