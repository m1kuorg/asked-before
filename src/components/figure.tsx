// A count in tabular figures, for tables, tiles, and numbers that update:
// grouped ("1,204"), each digit one width, and the separators at their own
// narrow width. Schibsted Grotesk's tnum also widens "," and "." to a
// figure, so plain tabular-nums would set "1 , 204".
import { cn } from "cn";
import { count } from "@/lib/format";

export function Figure({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {count(n)
        .split(/([,.])/)
        .map((part, i) => (i % 2 ? <span key={i} className="[font-variant-numeric:proportional-nums]">{part}</span> : part))}
    </span>
  );
}
