// Password: the current one, then the new one (10 to 200 characters). The
// SDK derives a key from each and sends only the keys (ADR 0006); the
// server ends every other session when it changes.

import { useId, useState } from "react";
import type { ScreenProps } from "@/app/router";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { FormFooter, Section } from "@/components/section";

export function Password({ client }: Pick<ScreenProps, "client">) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [changed, setChanged] = useState(false);
  const ids = { current: useId(), next: useId(), hint: useId() };

  const submit = useSafeSubmit(async () => {
    setChanged(false);
    await client.account.changePassword({ currentPassword, newPassword });
    setCurrent("");
    setNew("");
    setChanged(true);
  });

  return (
    <Section id="password" title="Password" description={<p>It never leaves this computer: the page sends Asked Before a key made from it instead.</p>}>
      <form {...submit.form} className="flex flex-col gap-4">
        <FieldGroup className="grid items-start @lg/panel:grid-cols-2">
          <Field data-invalid={submit.invalid === "currentPassword" || undefined}>
            <FieldLabel htmlFor={ids.current}>Current password</FieldLabel>
            <Input id={ids.current} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrent(event.target.value)} {...submit.field("currentPassword")} />
          </Field>
          <Field data-invalid={submit.invalid === "newPassword" || undefined}>
            <FieldLabel htmlFor={ids.next}>New password</FieldLabel>
            <Input id={ids.next} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNew(event.target.value)} {...submit.field("newPassword", ids.hint)} />
            <FieldDescription id={ids.hint}>10 to 200 characters. Changing it logs out every other browser.</FieldDescription>
          </Field>
        </FieldGroup>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
        <FormFooter status={changed ? "Your password is changed, and every other browser is logged out." : ""}>
          <Button type="submit" variant="secondary" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Change password
          </Button>
        </FormFooter>
      </form>
    </Section>
  );
}
