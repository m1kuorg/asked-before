// A date in a <time datetime>, in the learner's own time zone: "Oct 23,
// 2026" by default, "2026-10-23" for compared columns, or "October 23, 2026".
import { isoDate, longDate, shortDate } from "@/lib/format";

const FORMATS = { short: shortDate, iso: isoDate, long: longDate };

export function Time({ iso, format = "short", className }: { iso: string; format?: keyof typeof FORMATS; className?: string }) {
  return (
    <time dateTime={iso} className={className}>
      {FORMATS[format](iso)}
    </time>
  );
}
