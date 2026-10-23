// "Try the demo shelf" (inventory.md, Flows 8): makes a shelf flagged demo,
// tells the shell a shelf was made, then goes to its upload page with
// ?export=demo, which loads the demo export there. The button locks while the
// shelf is made; a failure shows under it and unlocks it. Home's first visit
// and the empty shelves list both offer it.
import type { Client } from "@asked-before/sdk";
import { useState } from "react";
import { useShell } from "@/app/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { messageOf } from "@/lib/client";

type DemoShelfButtonProps = {
  client: Client;
  navigate: (path: string) => void;
  variant?: "default" | "secondary";
};

export function DemoShelfButton({ client, navigate, variant = "secondary" }: DemoShelfButtonProps) {
  const { refreshShell } = useShell();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const shelf = await client.shelves.create({ name: "Demo", demo: true });
      refreshShell();
      navigate(`/app/shelves/${encodeURIComponent(shelf.id)}/upload?export=demo`);
    } catch (thrown) {
      setError(thrown);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant={variant} disabled={busy} onClick={start}>
        {busy && <Spinner data-icon="inline-start" />}
        Try the demo shelf
      </Button>
      {error !== null && (
        <Alert variant="negative">
          <AlertDescription>{messageOf(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
