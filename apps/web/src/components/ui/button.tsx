// shadcn's Button (base-nova, Base UI), restyled for the app: primary is the
// near-black plum fill (one per screen), secondary is white with a 1px
// border, ghost has no edge until hovered, destructive is an outlined
// negative, link is ink text. Busy: pass `disabled` and put a
// <Spinner data-icon="inline-start" /> before the words. A link that looks
// like a button is <ButtonLink href="...">: a real <a>, so it's announced as
// a link (Base UI's render={<a />} would give it role="button"). The small
// sizes grow to 44px under 1024px or on a coarse pointer, so a finger finds them.

import type * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-edge bg-secondary text-secondary-foreground hover:border-input hover:bg-muted aria-expanded:bg-muted",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "border-destructive/60 bg-background text-destructive hover:border-destructive hover:bg-negative",
        link: "h-auto! border-0 px-0! text-foreground underline underline-offset-4 decoration-input hover:decoration-foreground",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-8 max-lg:h-11 pointer-coarse:h-11 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 max-lg:h-11 pointer-coarse:h-11 gap-1 rounded-md px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-sm": "size-8 max-lg:size-11 pointer-coarse:size-11",
        "icon-xs": "size-7 max-lg:size-11 pointer-coarse:size-11 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/** A link in a button's clothes: a real <a>, announced as a link, with the same variants and sizes. */
function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
  return <a data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, ButtonLink, buttonVariants }
