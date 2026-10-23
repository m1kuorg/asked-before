// What "Prove next" holds when it has no rows (brief section 4; inventory.md,
// Desk): on a first visit, the demo shelf and a one-line form to name your
// first shelf, which goes to its upload page; with shelves but no cards, the
// way to your shelves; with every card proven, the sentence that says so.
import type { Client } from "@asked-before/sdk";
import { useId } from "react";
import { useShell } from "@/app/shell";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { DemoShelfButton } from "@/screens/shelves/demo-shelf-button";
import { shelfName } from "@/screens/shelves/shelf-name";

type Navigate = (path: string) => void;

export function FirstVisit({ client, navigate }: { client: Client; navigate: Navigate }) {
  return (
    <div className="@container/first">
      <Empty className="grid items-start gap-6 text-left @min-[40rem]/first:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Try the demo shelf to see a sorted history, made from a demo chat export.</p>
          <DemoShelfButton client={client} navigate={navigate} variant="default" />
        </div>
        <FirstShelf client={client} navigate={navigate} />
      </Empty>
    </div>
  );
}

function FirstShelf({ client, navigate }: { client: Client; navigate: Navigate }) {
  const { refreshShell } = useShell();
  const id = useId();
  const submit = useSafeSubmit(async (form) => {
    const shelf = await client.shelves.create({ name: shelfName(new FormData(form).get("name")) });
    refreshShell();
    navigate(`/app/shelves/${encodeURIComponent(shelf.id)}/upload`);
  });
  return (
    <form {...submit.form} className="flex min-w-0 flex-col gap-2">
      <Field data-invalid={submit.invalid === "name" || undefined}>
        <FieldLabel htmlFor={id}>Or name your first shelf</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Input id={id} placeholder="Such as Work or Bootcamp" autoComplete="off" className="min-w-40 flex-1" {...submit.field("name")} />
          <Button type="submit" variant="secondary" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Upload a chat export
          </Button>
        </div>
      </Field>
      {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
    </form>
  );
}

export function NoCards() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>Open one of your shelves to upload a chat export to it, or to see its uploads.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <a href="/app/shelves" className={cn(buttonVariants())}>
          Go to your shelves
        </a>
      </EmptyContent>
    </Empty>
  );
}

export function AllProven() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Every card is proven.</EmptyTitle>
        <EmptyDescription>Each card's latest cold rep passed after you last asked it. A card comes back here when you ask it again.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
