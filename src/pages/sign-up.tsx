// The sign-up page (/signup): brief section 5, inventory "Sign up". The
// password goes only through auth.signUp, which refuses a weak one before
// anything is sent and derives its key in the page (ADR 0006); the form never
// submits itself, and the submit stays locked while scrypt runs and the next
// page loads. A message that names one field ("A name is needed.", "That
// email already has an account. Log in instead.") shows on that field. A
// sign up sets the signed-in hint and goes to `next`, or Home. The
// cross-link and the guest sign-in carry `next` along. The fine print under
// the button links to the privacy page.
import { useId } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { nextPath, publicClient, withNext } from "@/lib/client";
import { SESSION_SIGN_UP } from "@/lib/copy";
import { markSignedIn } from "@/lib/signed-in";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { AccountLayout, focusFirstField, GuestSignIn } from "./account/account-layout";

function SignUp() {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const hintId = useId();
  const submit = useSafeSubmit(async (form) => {
    const data = new FormData(form);
    const session = await publicClient.auth.signUp({
      name: String(data.get("name")),
      email: String(data.get("email")),
      password: String(data.get("password")),
      next: nextPath(),
    });
    markSignedIn();
    location.assign(session.next);
    // Stay locked while the next page loads.
    await new Promise(() => {});
  });
  const error = (name: string) => submit.invalid === name && <FieldError id={submit.errorId}>{submit.error}</FieldError>;

  return (
    <AccountLayout title="Sign up" line="An account keeps your shelves, their cards, and every cold rep you pass, from one visit to the next.">
      <form {...submit.form} className="flex flex-col gap-6">
        <FieldGroup className="gap-5">
          <Field data-invalid={submit.invalid === "name" || undefined}>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input id={nameId} autoComplete="name" autoFocus={focusFirstField} {...submit.field("name")} />
            {error("name")}
          </Field>
          <Field data-invalid={submit.invalid === "email" || undefined}>
            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
            <Input id={emailId} type="email" autoComplete="email" {...submit.field("email")} />
            {error("email")}
          </Field>
          <Field data-invalid={submit.invalid === "password" || undefined}>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <Input id={passwordId} type="password" autoComplete="new-password" {...submit.field("password", hintId)} />
            <FieldDescription id={hintId}>At least 10 characters.</FieldDescription>
            {error("password")}
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-3">
          {submit.error && submit.invalid === null && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
          <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Sign up
          </Button>
          <p className="text-muted-foreground">
            {SESSION_SIGN_UP}{" "}
            <a className="underline decoration-input underline-offset-4 hover:decoration-foreground" href="/privacy">
              Privacy
            </a>{" "}
            says what happens to your words.
          </p>
        </div>
      </form>
      <p>
        <span className="font-semibold">Already signed up?</span>{" "}
        <a className="font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground" href={withNext("/login")}>
          Log in
        </a>{" "}
        with your email and your password.
      </p>
      <GuestSignIn />
    </AccountLayout>
  );
}

createRoot(document.getElementById("app")!).render(<SignUp />);
