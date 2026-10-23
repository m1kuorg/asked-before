// The side column: how to get an export from ChatGPT and from Claude
// (inventory.md, "Upload"), on the one tonal panel of the screen.

import { useId } from "react";
import { cn } from "cn";

export function HowTo({ className }: { className?: string }) {
  const id = useId();
  return (
    <aside aria-labelledby={id} className={cn("flex flex-col gap-4 rounded-2xl bg-panel p-5 text-sm", className)}>
      <h2 id={id} className="font-semibold">
        Getting your export
      </h2>
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">From ChatGPT</h3>
        <p className="text-muted-foreground">
          Open Settings, then Data controls, and choose Export data. ChatGPT emails you a link to a zip, sometimes days later, and the link works for 24 hours.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">From Claude</h3>
        <p className="text-muted-foreground">
          On the web or in the desktop app, open Settings, then Privacy, and choose Export data. Claude emails you a link to a zip that works for 24 hours.
        </p>
      </div>
      <p className="text-muted-foreground">Drop the zip here as it came. There's no need to unzip it.</p>
    </aside>
  );
}
