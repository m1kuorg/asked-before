// The endpoints, by the docs' areas, each its method and path as code. On a
// canvas from 42rem a panel beside the request, sticky below the top, with
// its own scroll; each row is a real link to its ?endpoint= address (so it
// opens in a new tab too), and a plain click replaces the address, so Back
// leaves the playground rather than stepping through endpoints. The open
// one carries the active fill and aria-current. The ones that don't run here
// are listed in grey and say so to a screen reader; opening one says why.
// Under 42rem the list becomes a select.

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "cn";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENTRIES, GROUPS, hrefOf, type Entry } from "./endpoints";

/** A path that wraps only before a slash: "/shelves/:shelfId" then "/uploads". */
export const breakable = (path: string): ReactNode[] => path.split(/(?=\/)/).flatMap((part, i) => (i ? [<wbr key={i} />, part] : [part]));

const slug = (area: string) => `endpoints-${area.toLowerCase().replace(/\W+/g, "-")}`;

type ListProps = { open: Entry; choose: (entry: Entry) => void };

export function EndpointList({ open, choose }: ListProps) {
  const list = useRef<HTMLDivElement>(null);
  // The open endpoint stays in view in the list's own scroll, when the address or the phone's select opened it.
  useEffect(() => {
    const box = list.current;
    const item = box?.querySelector<HTMLElement>("[aria-current=true]");
    if (!box || !item) return;
    const top = item.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop || top + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 3;
  }, [open.id]);
  return (
    <div
      ref={list}
      className="sticky top-16 hidden max-h-[calc(100svh-5rem)] flex-col gap-4 self-start overflow-y-auto rounded-2xl bg-panel p-2 @2xl/screen:flex lg:top-9 lg:max-h-[calc(100svh-4.5rem)]"
    >
      <h2 className="px-2 pt-2 text-base font-medium">Endpoints</h2>
      {GROUPS.map(({ area, entries }) => (
        <div key={area} className="flex flex-col gap-0.5">
          <h3 id={slug(area)} className="px-2 pb-1 text-xs text-muted-foreground">
            {area}
          </h3>
          <ul aria-labelledby={slug(area)} className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={hrefOf(entry)}
                  aria-current={entry.id === open.id ? "true" : undefined}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    choose(entry);
                  }}
                  className={cn(
                    "flex min-h-8 items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-background aria-[current=true]:bg-active max-lg:min-h-11 max-lg:items-center pointer-coarse:min-h-11",
                    entry.off ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  <code translate="no" className="w-12 shrink-0 font-medium text-muted-foreground">{entry.method}</code>{" "}
                  <code translate="no" className="min-w-0 [overflow-wrap:anywhere]">{breakable(entry.path)}</code>
                  {entry.off && <span className="sr-only">, not sent from here</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const ITEMS = ENTRIES.map((entry) => ({ value: entry.id, label: entry.id }));

/** The phone's picker: the same endpoints, grouped the same way. */
export function EndpointSelect({ open, choose, id }: ListProps & { id: string }) {
  return (
    <div className="flex flex-col gap-2 @2xl/screen:hidden">
      <label htmlFor={id} className="text-sm font-medium">
        Endpoint
      </label>
      <Select items={ITEMS} value={open.id} onValueChange={(value) => value && choose(ENTRIES.find((entry) => entry.id === value)!)}>
        <SelectTrigger id={id} className="w-full bg-background data-[size=default]:h-11 dark:bg-background">
          <SelectValue>{(value: string) => <code translate="no" className="text-sm">
              {value}
            </code>}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="max-h-[min(var(--available-height),28rem)]">
          {GROUPS.map(({ area, entries }) => (
            <SelectGroup key={area}>
              <SelectLabel>{area}</SelectLabel>
              {entries.map((entry) => (
                <SelectItem key={entry.id} value={entry.id} className="min-h-11 text-xs">
                  <code translate="no" className="w-11 shrink-0 font-medium text-muted-foreground">{entry.method}</code>{" "}
                  <code translate="no">{entry.path}</code>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
