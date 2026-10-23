// Upload a chat export (/app/shelves/:shelfId/upload, with ?upload=<id> or
// ?export=demo; brief section 4 item 4, as amended in section 7). The
// question: what leaves this computer, and did it sort? One screen whose main
// column advances: choose, read here, preview, send, then (at ?upload=) the
// sort watched to its end. The side column says how to get an export. A
// guest is warned, word for word, above both columns. Which state shows:
// ?upload= names an upload (on this shelf, or it's not found); else
// ?export=demo on a demo shelf uploads the demo export; else the drop target.
// Grid: 12 columns, 16px gutters, 8 + 4 once the canvas is 896px or wider
// (1100 = 12 x 77 + 11 x 16; 8 columns are 728, 4 are 356).

import { useEffect } from "react";
import { notFound, type ScreenProps } from "@/app/router";
import { useResource } from "@/app/use-resource";
import { DemoChip } from "@/components/demo-chip";
import { ErrorNotice } from "@/components/error-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/client";
import { GUEST_UPLOAD_WARNING } from "@/lib/copy";
import { finished, seenShelves } from "@/screens/upload/data";
import { Flow } from "@/screens/upload/flow";
import { HowTo } from "@/screens/upload/how-to";
import { Watch } from "@/screens/upload/watch";

export function Upload({ client, params, query, account, navigate, setTitle, signal }: ScreenProps<"shelfId">) {
  const shelfId = params.shelfId;
  const uploadId = query.get("upload");
  const loaded = useResource(
    () => Promise.all([client.shelves.get(shelfId), uploadId ? client.uploads.get(uploadId) : null]),
    [shelfId, uploadId],
  );
  const shelf = loaded.data?.[0] ?? seenShelves.get(shelfId);
  const upload = loaded.data ? loaded.data[1] : uploadId ? finished.get(uploadId) : null;
  const name = shelf?.name;

  useEffect(() => {
    if (loaded.data) seenShelves.set(shelfId, loaded.data[0]);
  }, [loaded.data, shelfId]);
  useEffect(() => {
    if (name) setTitle(`Upload into ${name}`);
  }, [name, setTitle]);
  if (isNotFound(loaded.error) || (shelf && upload && upload.shelfId !== shelf.id)) notFound();

  let main;
  if (shelf && upload) main = <Watch key={upload.id} client={client} shelf={shelf} initial={upload} signal={signal} />;
  else if (shelf && !uploadId) main = <Flow client={client} shelf={shelf} demo={query.get("export") === "demo" && shelf.demo} navigate={navigate} signal={signal} />;
  else if (loaded.error !== null) main = <ErrorNotice error={loaded.error} title={uploadId ? "This upload didn't load." : "This shelf didn't load."} onRetry={loaded.retry} />;
  else main = <Loading />;

  return (
    <div className="@container flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Upload a chat export</h1>
        {shelf ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="min-w-0 break-words">{`Into ${shelf.name}.`}</span>
            {shelf.demo && <DemoChip />}
          </p>
        ) : (
          <Skeleton className="h-5 w-40" />
        )}
      </header>
      {account.guest && (
        <Alert variant="notice" role="note">
          <AlertDescription>{GUEST_UPLOAD_WARNING}</AlertDescription>
        </Alert>
      )}
      {/* While a file is being chosen, the drop target and the side panel end level; after that, each keeps its own height. */}
      <div className="grid items-start gap-6 @min-[56rem]:grid-cols-12 @min-[56rem]:gap-4 has-[[data-step=choose]]:items-stretch">
        <div className="flex min-w-0 flex-col gap-6 @min-[56rem]:col-span-8">{main}</div>
        <HowTo className="@min-[56rem]:col-span-4" />
      </div>
    </div>
  );
}

/** The drop target's frame, flat, while the shelf (and the upload) load. */
function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        Finding the shelf…
      </p>
      <Skeleton className="h-60 w-full rounded-2xl" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}
