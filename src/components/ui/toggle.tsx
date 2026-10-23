// shadcn's Toggle (Base UI): a pressable that stays pressed. On its own it's
// ghost-like; inside a ToggleGroup it's one segment of the segmented control.
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const toggleVariants = cva(
  "group/toggle inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-60 aria-pressed:bg-background aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent hover:bg-muted aria-pressed:bg-active",
        segment: "border border-transparent aria-pressed:border-border",
      },
      size: {
        default: "h-8 min-w-8 px-3 max-lg:h-11 pointer-coarse:h-11",
        sm: "h-7 min-w-7 rounded-md px-2.5 text-xs max-lg:h-11 pointer-coarse:h-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
