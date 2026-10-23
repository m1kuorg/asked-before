// Every form's submit, as src/parts/fields.ts did it: the browser's own
// submission and validation are off (no password ever goes out as form data
// or in a URL), the submit locks while `send` runs (scrypt takes a moment),
// and a thrown error becomes the form's message. When the message names
// exactly one of the form's fields, by its name or its label as a whole word
// ("A password needs at least 10 characters."), that field is marked invalid,
// described by the message, and focused.
//
//   const submit = useSafeSubmit(async (form) => { await client.auth.logIn(...) });
//   <form {...submit.form}>
//     <Field data-invalid={submit.invalid === "email" || undefined}>
//       <FieldLabel htmlFor={id}>Email</FieldLabel>
//       <Input id={id} {...submit.field("email")} type="email" autoComplete="email" />
//     </Field>
//     {submit.error && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
//     <Button type="submit" disabled={submit.busy}>Log in</Button>
//   </form>

import { useId, useRef, useState, type FormEvent } from "react";
import { messageOf } from "@/lib/client";

export function useSafeSubmit(send: (form: HTMLFormElement) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const errorId = useId();
  const locked = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    setInvalid(null);
    try {
      await send(form);
    } catch (thrown) {
      const message = messageOf(thrown);
      const named = namedField(form, message);
      setError(message);
      setInvalid(named?.name ?? null);
      named?.focus();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return {
    busy,
    /** The failure's message, or null. Show it in an element with id `errorId`. */
    error,
    errorId,
    /** The `name` of the one field the message names, or null. */
    invalid,
    /** Spread on the <form>. */
    form: { onSubmit, noValidate: true },
    /** Spread on a control: its name, and aria-invalid and aria-describedby (its hint, then the message) when it's the one named. */
    field: (name: string, hintId?: string) => ({
      name,
      "aria-invalid": invalid === name || undefined,
      "aria-describedby": [hintId, invalid === name ? errorId : undefined].filter(Boolean).join(" ") || undefined,
    }),
    /** Clears the message and the mark, such as when a confirmation is cancelled. */
    reset: () => {
      setError(null);
      setInvalid(null);
    },
  };
}

/** The one control a message names, by its name or its label as a whole word; none when it names several, as "Wrong email or password." does. */
function namedField(form: HTMLFormElement, message: string): HTMLInputElement | HTMLTextAreaElement | undefined {
  const said = (word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message);
  const named = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].filter((control) =>
    [control.name, control.labels?.[0]?.textContent ?? ""].filter(Boolean).some(said),
  );
  return named.length === 1 ? named[0] : undefined;
}
