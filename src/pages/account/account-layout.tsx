// The frame the log-in and sign-up pages share (docs/DESIGN.md, "Layout"): on
// the left, the plum field with the wordmark, the h1 at display size, and one
// line; on the right, the white panel with the form, its cross-link, and the
// guest sign-in. The landing's palette, type, and square corners.
import { useEffect, type ReactNode } from "react";
import { GuestButton } from "@/components/guest-button";
import { GUEST_NOTE } from "@/lib/copy";

/** Whether the first field takes focus as the page opens: only with a fine pointer, since on a phone it would open the keyboard over the heading and the guest option. */
export const focusFirstField = matchMedia("(pointer: fine)").matches;

export function AccountLayout({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  // A page brought back from the back-forward cache would still show the
  // busy lock it left with; start it afresh instead.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => event.persisted && location.reload();
    addEventListener("pageshow", restored);
    return () => removeEventListener("pageshow", restored);
  }, []);

  return (
    <div className="relative grid min-h-svh text-base tracking-[-0.01em] [--radius:0px] lg:grid-cols-2">
      {/* Across the top, on the page's two margins: the wordmark on the plum field, and Docs at the far right, on white from 1024px. */}
      <nav aria-label="Asked Before" className="absolute inset-x-0 top-0 flex items-center justify-between gap-6 px-6 pt-5 font-semibold sm:px-12 lg:pt-8">
        <a href="/" className="text-lg font-extrabold tracking-tight text-white underline-offset-4 [--ring:var(--ring-on-dark)] hover:underline">
          Asked Before
        </a>
        <a href="/docs" className="text-white underline-offset-4 [--ring:var(--ring-on-dark)] hover:underline lg:text-foreground lg:[--ring:var(--plum-black)]">
          Docs
        </a>
      </nav>
      <header className="flex flex-col gap-8 bg-plum-field px-6 pt-24 pb-12 text-white sm:px-12 lg:justify-center lg:gap-10 lg:py-32">
        <h1 className="text-[clamp(4rem,20vw,6.5rem)] font-extrabold tracking-display leading-display lg:text-[min(10.5vw,10rem)]">{title}</h1>
        <p className="max-w-[30ch] text-xl leading-snug">{line}</p>
      </header>
      {/* The form's one primary action takes the landing's pink with plum-black ink, through the button's own colour variables. */}
      <main className="flex justify-center px-6 py-12 [--primary-foreground:var(--plum-black)] [--primary:var(--pink)] sm:px-12 lg:items-center lg:pt-24 lg:pb-12">
        <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}

/** Under each form: the shared guest workspace, with the guest note word for word. */
export function GuestSignIn() {
  return (
    <section aria-labelledby="guest-title" className="flex flex-col gap-4 bg-muted p-6">
      <h2 id="guest-title" className="text-base font-semibold">
        Just looking?
      </h2>
      <GuestButton className="h-11 text-base font-semibold" />
      <p className="leading-relaxed text-muted-foreground">{GUEST_NOTE}</p>
    </section>
  );
}
