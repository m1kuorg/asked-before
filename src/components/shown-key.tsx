// A new API key, shown the one time an answer carries it whole (API keys,
// and Connect your AI's key step): the warning that it's shown only this
// once, the key to copy under "<name>'s key", broken anywhere so it never
// scrolls sideways, and a line under it, in each screen's words, on where
// it goes. API keys frames it in white under the key's row; Connect your
// AI sets it on its step's panel, with only the key on white.

import type { CreatedApiKey } from "@asked-before/sdk";
import type { ReactNode } from "react";
import { cn } from "cn";
import { CopyBlock } from "@/components/copy-block";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { API_KEY_SHOWN_ONCE } from "@/lib/copy";

type ShownKeyProps = {
  made: CreatedApiKey;
  /** Whether the copy button takes focus as the key is drawn. */
  autoFocus?: boolean;
  /** In a white box of its own, as under a row of API keys; without one, it sits on the panel. */
  framed?: boolean;
  /** The line under the key: where it goes. */
  children: ReactNode;
};

export function ShownKey({ made, autoFocus = false, framed = false, children }: ShownKeyProps) {
  return (
    <div className={cn("flex flex-col gap-3", framed && "rounded-xl border border-border bg-background p-4")}>
      <Alert variant="notice" role="note">
        <AlertDescription>{API_KEY_SHOWN_ONCE}</AlertDescription>
      </Alert>
      <CopyBlock
        caption={`${made.name}'s key`}
        code={made.key}
        copyLabel={`Copy ${made.name}'s key`}
        autoFocus={autoFocus}
        className={cn("[&_pre]:break-all [&_pre]:whitespace-pre-wrap", !framed && "[&_pre]:bg-background")}
      />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
