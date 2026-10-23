// The landing's one action, "Try it as a guest" (brief sections 5 and 7):
// auth.signInAsGuest with `next`, the signed-in hint, then `session.next`.
// A refusal (the throttle's 429) shows its notice after the button, in the
// app's pale failure pair so it reads on every chapter's ground, until the
// button is pressed again. When the hint says this browser already has a
// session, it's "Open the app" instead, so a click can't replace a real
// session with the shared guest. The scaffold's GuestButton is the app's
// secondary button with red text under it, which doesn't read on the plum
// grounds; this is the same call in the landing's pink.
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { messageOf, nextPath, publicClient } from "@/lib/client";
import { markSignedIn, seemsSignedIn } from "@/lib/signed-in";

/** The landing's primary button: pink, plum-black words, square, 48px; at the body size unless it's the header's compact one. */
export const PINK = "press h-12 rounded-none px-6 font-semibold bg-pink text-plum-black hover:bg-pink-hover disabled:opacity-80";

const signedIn = seemsSignedIn();

/** "Try it as a guest", or "Open the app" for a browser that's signed in. `look="link"` sets it as a pink text link (the footer); `compact` is the header's. */
export function GuestAction({ className, look = "button", align = "end", compact = false }: { className?: string; look?: "button" | "link"; align?: "start" | "center" | "end"; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const linkLook = "ink-link h-auto cursor-pointer text-left text-pink";
  const buttonLook = cn(PINK, compact ? "t-small px-4 md:px-5" : "t-body", className);

  if (signedIn) {
    return look === "link" ? (
      <a href="/app/desk" className={cn(linkLook, className)}>
        Open the app
      </a>
    ) : (
      <a href="/app/desk" className={cn(buttonLook, "inline-flex items-center justify-center")}>
        Open the app
      </a>
    );
  }

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
    <div className={cn("relative flex flex-col gap-2", align === "start" ? "items-start" : align === "center" ? "items-center" : "items-end")}>
      {look === "link" ? (
        <button type="button" className={cn(linkLook, "disabled:opacity-80", className)} disabled={busy} onClick={signIn}>
          Try it as a guest
        </button>
      ) : (
        <Button className={buttonLook} disabled={busy} onClick={signIn}>
          {busy && <Spinner data-icon="inline-start" />}
          Try it as a guest
        </Button>
      )}
      {error !== null && (
        // The header's notice hangs under its button on its own pale ground, so the bar keeps its height.
        <p role="alert" className={cn("t-small max-w-[34ch] bg-negative px-3 py-2 text-left font-medium text-negative-foreground", compact && "absolute top-full right-0 mt-2 w-max max-w-[min(34ch,calc(100vw-2*var(--margin)))]")}>
          {messageOf(error)}
        </p>
      )}
    </div>
  );
}
