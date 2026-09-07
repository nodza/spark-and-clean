"use client";

import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { openSupportChat } from "@/components/support/supportChat";
import { cn } from "@/lib/utils";

type ChatWithSupportLinkProps = {
  className?: string;
  variant?: "inline" | "button";
};

/** Visible “Chat with support” control — not a WhatsApp booking float. */
export function ChatWithSupportLink({
  className,
  variant = "inline",
}: ChatWithSupportLinkProps) {
  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={cn("min-h-12 w-full px-8 font-semibold sm:w-auto", className)}
        onClick={openSupportChat}
      >
        <WhatsAppIcon className="size-4" />
        Chat with support
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSupportChat}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
        className
      )}
    >
      <WhatsAppIcon className="size-4" />
      Chat with support
    </button>
  );
}
