// A failure inside the block that failed: role="alert" with its message (the
// API's own, or the connection line), an optional `title` naming what failed
// ("Your cards didn't load."), and "Try again" when a retry can help (a
// network failure, a 5xx, or a 429). The retry takes focus when it appears,
// unless `focus` is false (for a second notice on the same screen).
import { useEffect, useRef } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canRetry, messageOf } from "@/lib/client";

type ErrorNoticeProps = { error: unknown; title?: string; onRetry?: () => void; focus?: boolean; className?: string };

export function ErrorNotice({ error, title, onRetry, focus = true, className }: ErrorNoticeProps) {
  const retry = useRef<HTMLButtonElement>(null);
  const offered = onRetry !== undefined && canRetry(error);
  useEffect(() => {
    if (focus && offered) retry.current?.focus();
  }, [error, focus, offered]);

  return (
    <Alert variant="negative" className={className}>
      <CircleAlertIcon aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{messageOf(error)}</AlertDescription>
      {offered && (
        <div className="col-start-2 mt-2">
          <Button ref={retry} variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </Alert>
  );
}
