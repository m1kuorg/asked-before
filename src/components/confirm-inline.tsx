// A delete confirmation in place, never a modal (docs/DESIGN.md, "Do's and
// Don'ts"): role="group" labelled by its question, the body naming everything
// that goes and that it can't be undone, the action ("Delete Work") and "Keep
// it". Focus starts on Keep it; Escape keeps it; both lock while the delete
// runs; a failure shows inside and unlocks. Keeping it returns focus to
// `returnFocus` (the button that opened it), or to whatever had focus when it
// opened. Render it where it belongs, such as a detail row under the table
// row. It takes the width it's given and asks for none (width 0, at least all
// of it), so in a table cell it never widens the table: a long name wraps in
// the question and is cut in the action.
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { messageOf } from "@/lib/client";
import { cn } from "cn";

type ConfirmInlineProps = {
  /** The question, such as "Delete Work?". */
  title: string;
  /** Everything that goes, and that it can't be undone. */
  body: string;
  /** The action's words, such as "Delete Work". */
  action: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
};

export function ConfirmInline({ title, body, action, onConfirm, onCancel, returnFocus, className }: ConfirmInlineProps) {
  const headingId = useId();
  const keep = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    keep.current?.focus();
  }, []);

  function cancel() {
    if (busy) return;
    onCancel();
    const back = returnFocus?.current ?? opener.current;
    if (back instanceof HTMLElement && back.isConnected) back.focus();
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (thrown) {
      setError(thrown);
      setBusy(false);
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
      className={cn("flex w-0 min-w-full flex-col gap-3 rounded-xl border border-border bg-background p-4", className)}
    >
      <p id={headingId} className="text-sm font-semibold break-words">
        {title}
      </p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {error !== null && (
        <Alert variant="negative">
          <AlertDescription>{messageOf(error)}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" className="max-w-full" disabled={busy} onClick={confirm}>
          {busy && <Spinner data-icon="inline-start" />}
          <span className="truncate">{action}</span>
        </Button>
        <Button ref={keep} variant="secondary" size="sm" disabled={busy} onClick={cancel}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
