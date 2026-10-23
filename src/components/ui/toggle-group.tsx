// shadcn's ToggleGroup (Base UI), as the app's segmented control: a panel
// track holding segments, the pressed one white with a 1px edge. Single
// choice by default; value and defaultValue are arrays, as Base UI wants:
// value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0])}.
// Label it with aria-label or aria-labelledby.
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { toggleVariants } from "@/components/ui/toggle"

function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "group/toggle-group inline-flex w-fit max-w-full flex-row items-center gap-0.5 rounded-lg border border-input bg-muted p-0.5 data-vertical:flex-col data-vertical:items-stretch",
        className
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  size = "default",
  ...props
}: TogglePrimitive.Props & Pick<VariantProps<typeof toggleVariants>, "size">) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "shrink-0 rounded-md",
        toggleVariants({ variant: "segment", size }),
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
