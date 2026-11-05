// shadcn's Badge, as the app's pills: 20px, 12px/500, fully rounded, a pale
// tint with dark ink of the same hue. neutral is To prove, positive is
// Proven, notice is Asked again, negative is Not yet; outline is the quiet
// chip (Demo data). One status mark per row; StatusPill picks the variant.
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit flex-none shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs font-medium whitespace-nowrap has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "bg-active text-active-foreground",
        positive: "bg-positive text-positive-foreground",
        notice: "border-notice-border bg-notice text-notice-foreground",
        negative: "bg-negative text-negative-foreground",
        outline: "border-edge bg-background text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
