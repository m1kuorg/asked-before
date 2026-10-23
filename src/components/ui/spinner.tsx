// shadcn's Spinner: only while a request is in flight, beside words that say
// what's happening (a WaitLine or the busy button's label), so it's hidden
// from assistive technology. Under reduced motion it stands still.
import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" aria-hidden="true" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
