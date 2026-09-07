"use client";

import { cn } from "@/lib/utils";

type FieldErrorProps = {
  id?: string;
  message?: string | null;
  className?: string;
};

/** Inline field error — design-system friendly, accessible. */
export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-[12px] font-semibold text-[#d64545]", className)}
    >
      {message}
    </p>
  );
}
