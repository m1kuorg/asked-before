// Delete your account, last, in a section of its own: the password, then
// a confirmation in place after the form, which stays locked while it asks.
// Keep it (or Escape) closes it and focuses the password; a refusal closes
// it and shows on the form, marking the password. A delete clears the
// signed-in hint and goes to the landing page.

import { ApiError } from "@asked-before/sdk";
import { useId, useRef, useState } from "react";
import type { ScreenProps } from "@/app/router";
import { ConfirmInline } from "@/components/confirm-inline";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BACKUPS_DELETING } from "@/lib/copy";
import { clearSignedIn } from "@/lib/signed-in";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { FormFooter, Section } from "@/components/section";

export function DeleteAccount({ client }: Pick<ScreenProps, "client">) {
  const [password, setPassword] = useState("");
  const [asking, setAsking] = useState(false);
  /** Settles the form's submit: kept, it resolves; refused, it rejects with the refusal, which the form shows. */
  const answer = useRef<{ keep: () => void; refuse: (error: unknown) => void }>(undefined);
  const passwordId = useId();
  const passwordInput = useRef<HTMLInputElement>(null);

  const submit = useSafeSubmit(async () => {
    // The SDK's own words for an empty password, said before asking rather than after.
    if (!password) throw new ApiError(400, "Your password is needed.");
    await new Promise<void>((keep, refuse) => {
      answer.current = { keep, refuse };
      setAsking(true);
    });
  });

  return (
    <Section id="delete-your-account" title="Delete your account" description={<p>{BACKUPS_DELETING}</p>}>
      <form {...submit.form} className="flex flex-col gap-4">
        <FieldGroup className="grid @lg/panel:grid-cols-2">
          <Field data-invalid={submit.invalid === "password" || undefined}>
            <FieldLabel htmlFor={passwordId}>Your password</FieldLabel>
            <Input
              ref={passwordInput}
              id={passwordId}
              type="password"
              autoComplete="current-password"
              readOnly={asking}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              {...submit.field("password")}
            />
          </Field>
        </FieldGroup>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
        <FormFooter>
          <Button type="submit" variant="destructive" disabled={submit.busy}>
            Delete your account
          </Button>
        </FormFooter>
      </form>
      {asking && (
        <ConfirmInline
          title="Delete your account and everything in it?"
          body="Your shelves, their uploads and messages, your cards with their lessons and cold reps, and your API keys all go, and every browser is logged out. It can't be undone."
          action="Delete everything"
          returnFocus={passwordInput}
          onCancel={() => {
            setAsking(false);
            answer.current?.keep();
          }}
          onConfirm={async () => {
            try {
              await client.account.delete({ password });
            } catch (refusal) {
              setAsking(false);
              answer.current?.refuse(refusal);
              return;
            }
            clearSignedIn();
            location.assign("/");
          }}
        />
      )}
    </Section>
  );
}
