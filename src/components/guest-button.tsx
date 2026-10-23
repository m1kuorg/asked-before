// "Try it as a guest" on the public pages: the shared Guest account, with no
// password, then `next` or Home. It sets the signed-in hint. A failure (such
// as the throttle's 429) shows under it until it's pressed again.
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { messageOf, nextPath, publicClient } from "@/lib/client";
import { markSignedIn } from "@/lib/signed-in";

export function GuestButton({ className, variant = "secondary" }: { className?: string; variant?: "default" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Back to this page from the back-forward cache, the button would still be busy from the sign-in that left it.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => event.persisted && setBusy(false);
    addEventListener("pageshow", reset);
    return () => removeEventListener("pageshow", reset);
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const session = await publicClient.auth.signInAsGuest({ next: nextPath() });
      markSignedIn();
      location.assign(session.next);
    } catch (thrown) {
      setError(thrown);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} className={cn("w-full", className)} disabled={busy} onClick={signIn}>
        {busy && <Spinner data-icon="inline-start" />}
        Try it as a guest
      </Button>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {messageOf(error)}
        </p>
      )}
    </div>
  );
}
