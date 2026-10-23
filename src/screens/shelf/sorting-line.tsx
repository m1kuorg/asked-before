// Above a list that an upload's sort is still adding to: which upload, and a
// link to watch it.

import type { Shelf, Upload } from "@asked-before/sdk";
import { Time } from "@/components/time";
import { watchPath } from "@/screens/shelf/data";

export function SortingLine({ shelf, upload, more }: { shelf: Shelf; upload: Upload; more: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {"Your upload of "}
      <Time iso={upload.createdAt} />
      {` into ${shelf.name} is still being sorted, so more ${more} may show here. `}
      <a href={watchPath(shelf.id, upload.id)} className="font-medium text-foreground underline underline-offset-4 hover:decoration-2">
        See its sort
      </a>
    </p>
  );
}
