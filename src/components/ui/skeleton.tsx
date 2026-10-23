// shadcn's Skeleton, flat: a grey bar at the real size of what's loading,
// with no pulse or shimmer (nothing on the app animates forever).
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md bg-border", className)}
      {...props}
    />
  )
}

export { Skeleton }
