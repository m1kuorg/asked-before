// shadcn's Textarea: the Input's look, growing with its content. A read-only
// textarea (an answer being checked) takes the panel fill and stays readable.
import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base transition-colors placeholder:text-faint disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground read-only:bg-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
