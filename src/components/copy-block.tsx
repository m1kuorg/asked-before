// Code to copy (a setup snippet, a new API key): the caption, then the code
// in the monospace with a copy button. The button says "Copied"; if the
// clipboard refuses, it selects the code for the learner to copy and says
// "Selected"; then "Copy" again after 2 s. It's named "Copy the <caption>
// snippet" unless `copyLabel` names it otherwise ("Copy Laptop's key"), so
// what happened is said in a status line of its own. `autoFocus` puts focus
// on the button, as the new key's does.
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const SAID = { Copy: "", Copied: "Copied.", Selected: "The clipboard refused, so the code is selected for you to copy." };

type CopyBlockProps = { caption: string; code: string; copyLabel?: string; autoFocus?: boolean; className?: string };

export function CopyBlock({ caption, code, copyLabel, autoFocus = false, className }: CopyBlockProps) {
  const [said, setSaid] = useState<keyof typeof SAID>("Copy");
  const button = useRef<HTMLButtonElement>(null);
  const shown = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (autoFocus) button.current?.focus();
    return () => clearTimeout(timer.current);
  }, [autoFocus]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setSaid("Copied");
    } catch {
      const selection = getSelection();
      if (selection && shown.current) selection.selectAllChildren(shown.current);
      setSaid("Selected");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid("Copy"), 2000);
  }

  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      <figcaption className="flex items-center justify-between gap-3 text-sm font-medium">
        <span>{caption}</span>
        <Button ref={button} variant="secondary" size="xs" aria-label={copyLabel ?? `Copy the ${caption} snippet`} onClick={copy}>
          {said}
        </Button>
        <span role="status" className="sr-only">
          {SAID[said]}
        </span>
      </figcaption>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-5">
        <code ref={shown}>{code}</code>
      </pre>
    </figure>
  );
}
