// The "Proven <date>" stamp: the card page's one authored moment. It's set
// like an ink stamp on a library card, in the Proven pair, a little off
// square. When a cold rep has just passed (`press`), it fades in from a touch
// larger and settles, easing out with no overshoot: a short feedback motion
// that doesn't loop, and doesn't run at all for those who ask for less motion.
import { cn } from "cn";
import { Time } from "@/components/time";

export function Stamp({ at, press = false, className }: { at: string; press?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex -rotate-2 flex-col gap-1 rounded-xl border-2 border-positive-foreground/70 bg-positive px-4 pt-2.5 pb-2 text-positive-foreground",
        press && "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-105 motion-safe:duration-300 motion-safe:ease-out",
        className,
      )}
    >
      <span className="text-2xl leading-none font-semibold">Proven</span>{" "}
      <Time iso={at} className="text-sm font-medium" />
    </span>
  );
}
