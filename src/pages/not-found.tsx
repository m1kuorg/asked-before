// The not-found page outside the app (dist/404.html, HTTP 404): brief
// section 5. One plum field, like the landing's hero: the wordmark, the
// heading at display size over two lines, then the sentence and the way back
// to the start on one line at the foot. Square corners, the pink action.
import { createRoot } from "react-dom/client";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { NOT_FOUND_BODY, NOT_FOUND_TITLE } from "@/lib/copy";

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col gap-16 bg-plum-field px-6 pt-5 pb-10 text-base tracking-[-0.01em] text-white [--primary-foreground:var(--plum-black)] [--primary:var(--pink)] [--radius:0px] [--ring:var(--ring-on-dark)] sm:px-12 lg:pt-8 lg:pb-12">
      <nav aria-label="Asked Before" className="font-semibold">
        <a href="/" className="text-lg font-extrabold tracking-tight hover:underline hover:underline-offset-4">
          Asked Before
        </a>
      </nav>
      <main className="flex flex-1 flex-col justify-center gap-12 pb-[8svh] lg:justify-between lg:gap-16 lg:pb-0">
        <h1 className="text-[clamp(3rem,15vw,10rem)] font-extrabold text-balance tracking-display leading-display lg:mt-[6svh]">{NOT_FOUND_TITLE}</h1>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-xl leading-snug lg:max-w-[34ch] lg:text-2xl">{NOT_FOUND_BODY}</p>
          {/* A link styled as the primary button: Base UI's Button would give it role="button". */}
          <a href="/" className={cn(buttonVariants({ size: "lg" }), "self-start px-6 text-base font-semibold lg:self-auto")}>
            Go to the start of Asked Before
          </a>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<NotFound />);
