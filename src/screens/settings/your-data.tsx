// Download your data: everything Asked Before keeps for you, from
// account.export(), saved as asked-before-<yyyy-mm-dd of exportedAt,
// local>.json through a blob: URL and an a[download] click, which the
// content security policy allows. The panel names the file before it's
// made, and the label column sums up what it would hold now, from
// shelves.list(): the shelves, their cards, and the latest upload.

import type { AccountData, Shelf } from "@asked-before/sdk";
import { useState } from "react";
import type { ScreenProps } from "@/app/router";
import { useResource, type Resource } from "@/app/use-resource";
import { Figure } from "@/components/figure";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { canRetry } from "@/lib/client";
import { BACKUPS_YOUR_DATA } from "@/lib/copy";
import { DASH, isoDate } from "@/lib/format";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { Code, FormFooter, Section } from "@/components/section";
import { Facts } from "./facts";

const fileName = (iso: string) => `asked-before-${isoDate(iso)}.json`;

/** Saves the data as a JSON file and returns its name. */
function save(data: AccountData): string {
  const name = fileName(data.exportedAt);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // The browser has the file once the download starts; the URL is let go well after.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return name;
}

export function YourData({ client }: Pick<ScreenProps, "client">) {
  const shelves = useResource(() => client.shelves.list(), []);
  const [saved, setSaved] = useState<string | null>(null);
  const submit = useSafeSubmit(async () => {
    setSaved(null);
    setSaved(save(await client.account.export()));
  });

  return (
    <Section id="download-your-data" title="Download your data" description={<Holds shelves={shelves} />}>
      <p className="text-sm text-muted-foreground">{BACKUPS_YOUR_DATA}</p>
      <form {...submit.form} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          It saves as <Code>{fileName(new Date().toISOString())}</Code>.
        </p>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
        <FormFooter status={saved ? `Downloaded ${saved}.` : ""}>
          <Button type="submit" variant="secondary" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Download your data
          </Button>
        </FormFooter>
      </form>
    </Section>
  );
}

/** What the file would hold now, besides the account: the shelves, their cards, and when the latest upload onto any of them was made. */
function Holds({ shelves }: { shelves: Resource<Shelf[]> }) {
  const list = shelves.data;
  const failed = shelves.error !== null && !list;
  const latest = list
    ?.map((shelf) => shelf.lastUploadAt)
    .filter((at) => at !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const known = <T,>(value: (shelves: Shelf[]) => T) => (list ? value(list) : failed ? DASH : undefined);
  return (
    <>
      <p>What it holds now, besides your account:</p>
      <Facts
        facts={[
          { term: "Shelves", value: known((all) => <Figure n={all.length} />) },
          { term: "Cards", value: known((all) => <Figure n={all.reduce((sum, shelf) => sum + shelf.counts.cards, 0)} />) },
          { term: "Last upload", value: known(() => (latest ? <Time iso={latest} /> : "None yet")) },
        ]}
      />
      {failed && (
        <p className="flex flex-wrap items-center gap-x-2">
          Your shelves didn't load.
          {canRetry(shelves.error) && (
            <Button variant="link" size="xs" onClick={shelves.retry}>
              Try again
            </Button>
          )}
        </p>
      )}
    </>
  );
}
