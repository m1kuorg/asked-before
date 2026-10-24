// Your data: everything Asked Before keeps for you, from account.export(),
// saved as asked-before-<yyyy-mm-dd of exportedAt, local>.json through a
// blob: URL and an a[download] click, which the content security policy
// allows. The panel names the file before it's made.

import type { AccountData } from "@asked-before/sdk";
import { useState } from "react";
import type { ScreenProps } from "@/app/router";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { BACKUPS_YOUR_DATA } from "@/lib/copy";
import { isoDate } from "@/lib/format";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { Code, FormFooter, Section } from "@/components/section";

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
  const [saved, setSaved] = useState<string | null>(null);
  const submit = useSafeSubmit(async () => {
    setSaved(null);
    setSaved(save(await client.account.export()));
  });

  return (
    <Section id="your-data" title="Your data" description={<p>Your data is yours: download all of it, or delete your account and everything in it.</p>}>
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
