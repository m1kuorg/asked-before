// Profile: the name, the email, and "Your password", needed only to change
// the email (the SDK derives the keys it sends from the password and both
// emails, ADR 0006). Only a changed email sends the password. A save resets
// the fields to what was saved, says so, and tells the shell, so the
// sidebar shows the new name.

import type { Account } from "@asked-before/sdk";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { ScreenProps } from "@/app/router";
import { useShell } from "@/app/shell";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { FormFooter, Section } from "@/components/section";

/** The SDK's refusal of a new email without the password. It names both fields, so the hook marks neither; this form marks the password. */
const EMAIL_NEEDS_PASSWORD = "Changing the email needs your password.";

export function Profile({ client, account, setAccount }: Pick<ScreenProps, "client" | "account" | "setAccount">) {
  const { refreshShell } = useShell();
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const ids = { name: useId(), email: useId(), password: useId(), hint: useId() };

  const submit = useSafeSubmit(async () => {
    setSaved(false);
    const moved = email.trim().toLowerCase() !== account.email;
    const updated: Account = await client.account.update(moved ? { name, email, password } : { name });
    setName(updated.name);
    setEmail(updated.email);
    setPassword("");
    setAccount(updated);
    refreshShell();
    setSaved(true);
  });

  const needsPassword = submit.error === EMAIL_NEEDS_PASSWORD;
  const passwordInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (needsPassword) passwordInput.current?.focus();
  }, [needsPassword, submit.error]);
  const passwordField = submit.field("password", ids.hint);
  const edit = (set: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    set(event.target.value);
    setSaved(false);
  };

  return (
    <Section id="profile" title="Profile" description={
        <>
          <p>Your name shows in the navigation, and your email is how you log in.</p>
          <p>A new email logs out every other browser, as a new password does.</p>
        </>
      }>
      <form {...submit.form} className="flex flex-col gap-4">
        <FieldGroup className="grid items-start @lg/panel:grid-cols-2">
          <Field data-invalid={submit.invalid === "name" || undefined}>
            <FieldLabel htmlFor={ids.name}>Name</FieldLabel>
            <Input id={ids.name} autoComplete="name" value={name} onChange={edit(setName)} {...submit.field("name")} />
          </Field>
          <Field data-invalid={submit.invalid === "email" || undefined}>
            <FieldLabel htmlFor={ids.email}>Email</FieldLabel>
            <Input id={ids.email} type="email" autoComplete="email" spellCheck={false} value={email} onChange={edit(setEmail)} {...submit.field("email")} />
          </Field>
          <Field data-invalid={submit.invalid === "password" || needsPassword || undefined}>
            <FieldLabel htmlFor={ids.password}>Your password</FieldLabel>
            <Input
              id={ids.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={edit(setPassword)}
              {...passwordField}
              aria-invalid={passwordField["aria-invalid"] || needsPassword || undefined}
              aria-describedby={needsPassword ? `${ids.hint} ${submit.errorId}` : passwordField["aria-describedby"]}
              ref={passwordInput}
            />
            <FieldDescription id={ids.hint}>Only to change your email.</FieldDescription>
          </Field>
        </FieldGroup>
        {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
        <FormFooter status={saved ? "Your profile is saved." : ""}>
          <Button type="submit" variant="secondary" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Save profile
          </Button>
        </FormFooter>
      </form>
    </Section>
  );
}
