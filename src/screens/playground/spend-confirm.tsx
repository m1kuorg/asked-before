// The second click a model-spending endpoint needs, in place under the
// address, as ConfirmInline is for a delete: role="group" labelled by its
// question, the cost in words, the action ("Start it") and "Don't send".
// Focus starts on Don't send, so a double click on Send or a second ⌘Enter
// spends nothing; Escape doesn't send either. The action is outlined, not
// filled: Send stays the screen's one filled button.

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SpendConfirmProps = { title: string; cost: string; action: string; onConfirm: () => Promise<void>; onCancel: () => void; returnFocus: RefObject<HTMLElement | null> };

export function SpendConfirm({ title, cost, action, onConfirm, onCancel, returnFocus }: SpendConfirmProps) {
  const headingId = useId();
  const keep = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => keep.current?.focus(), []);

  function cancel() {
    if (busy) return;
    onCancel();
    returnFocus.current?.focus();
  }

  async function confirm() {
    setBusy(true);
    await onConfirm();
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
      className="flex flex-col gap-3 rounded-xl border border-notice-border bg-notice p-4 text-notice-foreground"
    >
      <p id={headingId} className="text-sm font-semibold">
        {title}
      </p>
      <p className="text-sm">{cost}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={confirm}>
          {busy && <Spinner data-icon="inline-start" />}
          {action}
        </Button>
        <Button ref={keep} variant="ghost" size="sm" disabled={busy} onClick={cancel} className="text-notice-foreground hover:bg-background">
          Don't send
        </Button>
      </div>
    </div>
  );
}
