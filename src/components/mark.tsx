// The product's mark, drawn from the ask strip: three asks on a track and
// the plum-black tick where it was proven. The one pink element outside the
// data (docs/DESIGN.md, "Do's and Don'ts"). Decorative: the name "Asked
// Before" sits beside it.
import { cn } from "cn";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <line x1="2" y1="12" x2="22" y2="12" className="stroke-track" strokeWidth={2} strokeLinecap="round" />
      <circle cx="5.5" cy="12" r="2.5" className="fill-ask" />
      <circle cx="10.5" cy="12" r="2.5" className="fill-ask" />
      <circle cx="15.5" cy="12" r="2.5" className="fill-ask" />
      <line x1="20.5" y1="5.5" x2="20.5" y2="18.5" className="stroke-primary" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
