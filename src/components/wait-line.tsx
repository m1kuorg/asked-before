// A line that says what the screen is waiting for, ending in an ellipsis
// ("Finding your cards…"), as role="status". Pass `spinner` for a model wait,
// which runs only while the request is in flight; under reduced motion it
// stands still.
import type { ReactNode } from "react";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";

export function WaitLine({ children, spinner = false, className }: { children: ReactNode; spinner?: boolean; className?: string }) {
  return (
    <p role="status" className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      {spinner && <Spinner />}
      {children}
    </p>
  );
}
