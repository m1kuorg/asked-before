// "Your shelves" (m1kuorg/basics#74), under Prove next: each shelf (to its
// page, with Demo data) and how many of its cards need a cold rep, as
// rule-separated rows on the panel, then "Upload an export". With one shelf
// that's a link to its upload page; with more, a menu asks which shelf. The
// action sits under the shelves, as wide as its words once the panel is.
import type { Shelf } from "@asked-before/sdk";
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import type { Resource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { Figure } from "@/components/figure";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NEED_REP_COLUMN } from "@/lib/copy";
import { count, plural } from "@/lib/format";
import { Panel, nameLink, ruleRow } from "./panel";

const shelfPath = (shelf: Shelf) => `/app/shelves/${encodeURIComponent(shelf.id)}`;

export function YourShelves({ shelves, className }: { shelves: Resource<Shelf[]>; className?: string }) {
  const list = shelves.data;
  return (
    <Panel
      title="Your shelves"
      className={className}
      link={
        <a href="/app/shelves" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          All shelves
        </a>
      }
      footer={list && list.length > 0 && <UploadAction shelves={list} />}
    >
      {list ? (
        list.length ? (
          <div className="flex flex-col">
            <p aria-hidden="true" className="flex justify-between border-b border-border pb-2 text-xs text-muted-foreground">
              <span>Shelf</span>
              <span>{NEED_REP_COLUMN}</span>
            </p>
            <ul aria-label="Your shelves" className="flex flex-col">
              {list.map((shelf) => (
                <ShelfRow key={shelf.id} shelf={shelf} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No shelves yet. A shelf keeps one part of your history apart, such as Work or Bootcamp.</p>
        )
      ) : shelves.error !== null ? (
        <ErrorNotice error={shelves.error} title="Your shelves didn't load." onRetry={shelves.retry} focus={false} />
      ) : (
        <div aria-hidden="true" className="flex flex-col">
          {[0, 1].map((i) => (
            <div key={i} className={cn(ruleRow, "flex items-center justify-between gap-3")}>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ShelfRow({ shelf }: { shelf: Shelf }) {
  const need = shelf.counts.borrowed + shelf.counts.borrowedAgain;
  const { cards, returned } = shelf.counts;
  return (
    <li className={cn(ruleRow, "flex items-center gap-3")}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <ShelfName shelf={shelf} />
          {shelf.demo && <DemoChip />}
        </span>
        <span className="text-xs text-muted-foreground">{cards === 0 ? "0 cards" : `${plural(cards, "card")}, ${count(returned)} proven`}</span>
      </div>
      <span className="text-sm font-medium">
        <Figure n={need} />
        <span className="sr-only"> {need === 1 ? "needs" : "need"} a cold rep</span>
      </span>
    </li>
  );
}

/** The shelf's name as a link, cut to the row with the whole name in a tooltip only when it's cut. */
function ShelfName({ shelf }: { shelf: Shelf }) {
  const name = useRef<HTMLAnchorElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const node = name.current;
    if (!node) return;
    const measure = () => setCut(node.scrollWidth > node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shelf.name]);
  return (
    <Tooltip>
      <TooltipTrigger disabled={!cut} render={<a ref={name} href={shelfPath(shelf)} className={cn(nameLink, "min-w-0 truncate")} />}>
        {shelf.name}
      </TooltipTrigger>
      <TooltipContent>{shelf.name}</TooltipContent>
    </Tooltip>
  );
}

function UploadAction({ shelves }: { shelves: Shelf[] }) {
  if (shelves.length === 1) {
    return (
      <a href={`${shelfPath(shelves[0]!)}/upload`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full @min-[40rem]/home:w-auto")}>
        Upload an export
      </a>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" size="sm" className="w-full @min-[40rem]/home:w-auto" />}>
        Upload an export
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>To which shelf?</DropdownMenuLabel>
          {shelves.map((shelf) => (
            <DropdownMenuItem key={shelf.id} render={<a href={`${shelfPath(shelf)}/upload`} />}>
              <span className="truncate">{shelf.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
