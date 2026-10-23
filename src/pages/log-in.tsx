// The log-in page (/login): brief section 5, inventory "Log in". The
// password goes only through auth.logIn, which derives its key in the page
// (ADR 0006); the form never submits itself, and the submit stays locked
// while scrypt runs and the next page loads. A message that names one field
// shows on that field; "Wrong email or password." names neither, so it shows
// above the button. A log in sets the signed-in hint and goes to `next`, or
// Home. The cross-link and the guest sign-in carry `next` along.
import { useId } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { nextPath, publicClient, withNext } from "@/lib/client";
import { SESSION_LOG_IN } from "@/lib/copy";
import { markSignedIn } from "@/lib/signed-in";
import { useSafeSubmit } from "@/lib/use-safe-submit";
import { AccountLayout, focusFirstField, GuestSignIn } from "./account/account-layout";

function LogIn() {
  const emailId = useId();
  const passwordId = useId();
  const submit = useSafeSubmit(async (form) => {
    const data = new FormData(form);
    const session = await publicClient.auth.logIn({ email: String(data.get("email")), password: String(data.get("password")), next: nextPath() });
    markSignedIn();
    location.assign(session.next);
    // Stay locked while the next page loads.
    await new Promise(() => {});
  });
  const error = (name: string) => submit.invalid === name && <FieldError id={submit.errorId}>{submit.error}</FieldError>;

  return (
    <AccountLayout title="Log in" line="Your shelves and their cards are where you left them.">
      <form {...submit.form} className="flex flex-col gap-6">
        <FieldGroup className="gap-5">
          <Field data-invalid={submit.invalid === "email" || undefined}>
            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
            <Input id={emailId} type="email" autoComplete="email" autoFocus={focusFirstField} {...submit.field("email")} />
            {error("email")}
          </Field>
          <Field data-invalid={submit.invalid === "password" || undefined}>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <Input id={passwordId} type="password" autoComplete="current-password" {...submit.field("password")} />
            {error("password")}
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-3">
          {submit.error && submit.invalid === null && <FieldError id={submit.errorId}>{submit.error}</FieldError>}
          <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={submit.busy}>
            {submit.busy && <Spinner data-icon="inline-start" />}
            Log in
          </Button>
          <p className="text-muted-foreground">{SESSION_LOG_IN}</p>
        </div>
      </form>
      <p>
        <span className="font-semibold">New to Asked Before?</span>{" "}
        <a className="font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground" href={withNext("/signup")}>
          Sign up
        </a>{" "}
        with your name, your email, and a password.
      </p>
      <GuestSignIn />
    </AccountLayout>
  );
}

createRoot(document.getElementById("app")!).render(<LogIn />);
