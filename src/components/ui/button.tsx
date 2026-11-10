import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Buttons: one primary per screen (navy-black, inverted in dark), quiet
 * outline and ghost for everything else, solid red only for destruction.
 * 36px on desktop; 44px+ wherever the pointer is coarse (phones, tablets).
 * Press feedback is a 2% scale, never a bounce.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/35 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/88 [a]:hover:bg-primary/88",
        outline:
          "border-input bg-background text-foreground hover:bg-accent aria-expanded:bg-accent dark:bg-transparent dark:hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",
        link: "h-auto! px-0! text-brand underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 pointer-coarse:h-11 pointer-coarse:px-5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-full px-2.5 text-xs pointer-coarse:h-9 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px] pointer-coarse:h-10 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-[15px] pointer-coarse:h-12",
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs": "size-7 rounded-full pointer-coarse:size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 pointer-coarse:size-10",
        "icon-lg": "size-10 pointer-coarse:size-12",
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

export { Button, buttonVariants }
