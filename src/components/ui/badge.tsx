import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Base: pill, 10.5px, weight 800, letter-spacing .04em
  "inline-flex items-center justify-center rounded-full border px-[11px] py-[5px] text-[10.5px] font-extrabold tracking-[0.04em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Generic / shadcn-compat
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",

        // ─── Booking status badges (design spec exact values) ───────────────
        // New — yellow
        "status-new":
          "bg-[#fff7d1] text-[#8a6d00] border-[#ffe98a]",
        // Collected — blue
        "status-collected":
          "bg-[#eef2ff] text-[#2c4fa6] border-[#cbd7ff]",
        // In cleaning — green
        "status-cleaning":
          "bg-[#eafaf5] text-[#0a7a63] border-[#bfe9dc]",
        // Out for delivery — deep green
        "status-delivering":
          "bg-[#e6fbf6] text-[#046b57] border-[#a9ecdc]",
        // Completed — grey
        "status-completed":
          "bg-[#f0f2f6] text-[#6b7280] border-[#e3e7ed]",
        // Overdue — red
        "status-overdue":
          "bg-[#fdecec] text-[#b33232] border-[#f6c9c9]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

