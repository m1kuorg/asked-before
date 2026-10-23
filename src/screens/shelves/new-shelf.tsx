// "New shelf" (inventory.md, Shelves list and Flows 5): a one-line form at the
// top right of the shelves list. shelves.create({ name }) adds the row in
// place; the field is cleared and keeps focus, and nothing navigates. A
// refused name ("A shelf needs a name.", "A shelf's name can have at most 80
// characters.", from shelfName or the server) marks the field, describes it,
// and focuses it.
import type { Client, Shelf } from "@asked-before/sdk";
import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { shelfName } from "./shelf-name";

type NewShelfProps = { client: Client; field: RefObject<HTMLInputElement | null>; onCreated: (shelf: Shelf) => void };

export function NewShelf({ client, field, onCreated }: NewShelfProps) {
  const id = useId();
  const submit = useSafeSubmit(async (form) => {
    const shelf = await client.shelves.create({ name: shelfName(new FormData(form).get("name")) });
    onCreated(shelf);
    form.reset();
    field.current?.focus();
  });
  return (
    <form {...submit.form} className="flex w-full flex-col gap-2 @min-[48rem]/shelves:w-96">
      <Field data-invalid={submit.invalid === "name" || undefined}>
        <FieldLabel htmlFor={id}>New shelf</FieldLabel>
        <div className="flex gap-2">
          <Input ref={field} id={id} placeholder="Such as Work or Bootcamp" autoComplete="off" className="min-w-0 flex-1" {...submit.field("name")} />
          <Button type="submit" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Add shelf
          </Button>
        </div>
      </Field>
      {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
    </form>
  );
}
