// The "Demo data" chip, beside a demo shelf's name and on demo content,
// wherever it shows.
import { Badge } from "@/components/ui/badge";
import { DEMO_DATA } from "@/lib/copy";

export function DemoChip({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      {DEMO_DATA}
    </Badge>
  );
}
