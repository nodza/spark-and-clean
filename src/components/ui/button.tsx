import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva( 
  // Base: pill shape, weight 800, 13.5px, .15s transition, disabled states
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Navy bg, white text — primary CTA
        default:
          "bg-[#000b49] text-white hover:bg-[#0a1a6b]",
        // Teal bg, navy text — accent CTA
        accent:
          "bg-[#6cf3d5] text-[#000b49] hover:bg-[#4fe4c4]",
        // White bg, navy text, line border — secondary
        secondary:
          "bg-white text-[#000b49] border border-[#e3e7ed] hover:border-[#9aa0a6]",
        // outline — alias for secondary (backwards-compat)
        outline:
          "bg-white text-[#000b49] border border-[#e3e7ed] hover:border-[#9aa0a6]",
        // Yellow bg, navy text — attention / highlight
        highlight:
          "bg-[#ffdc39] text-[#000b49] hover:bg-[#f5d000]",
        // Transparent, green text — inline text action
        ghost:
          "bg-transparent text-[#0a7a63] hover:text-[#000b49] hover:bg-transparent",
        // Red destructive
        destructive:
          "bg-[#d64545] text-white hover:bg-[#b33232]",
        link: "text-[#0a7a63] underline-offset-4 hover:underline hover:text-[#000b49]",
      },
      size: {
        // Design spec: 12px 26px padding
        default: "px-[26px] py-[12px]",
        // Design spec: 9px 16px, 13px font
        sm: "px-[16px] py-[9px] text-[13px]",
        lg: "px-[32px] py-[14px] text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

