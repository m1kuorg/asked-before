// A card's status as one pill: To prove, Proven, or Asked since proven. One
// status mark per row.
import type { CardStatus } from "@asked-before/sdk";
import { Badge } from "@/components/ui/badge";
import { STATUS } from "@/lib/status";

export function StatusPill({ status, className }: { status: CardStatus; className?: string }) {
  return (
    <Badge variant={STATUS[status].pill} className={className}>
      {STATUS[status].word}
    </Badge>
  );
}
