import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Design spec: 10px radius, 1.5px border #dfe2e7, 14.5px, 13px padding
        "file:text-foreground placeholder:text-[#b3b9c2] w-full min-w-0 rounded-[10px] border-[1.5px] border-[#dfe2e7] bg-white px-[13px] py-[13px] text-[14.5px] text-[#32373c] shadow-none transition-[border-color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Focus: teal border + teal glow ring
        "focus:border-[#6cf3d5] focus:shadow-[0_0_0_3px_rgba(108,243,213,0.25)]",
        // Error state via aria-invalid
        "aria-invalid:border-[#d64545] aria-invalid:shadow-[0_0_0_3px_rgba(214,69,69,0.15)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }

