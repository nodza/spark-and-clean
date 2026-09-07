"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_PREFILL, whatsappHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

type WhatsAppSupportLinkProps = {
  phone: string;
  label: string;
  variant?: "button" | "text";
  className?: string;
};

export function WhatsAppSupportLink({
  phone,
  label,
  variant = "button",
  className,
}: WhatsAppSupportLinkProps) {
  const href = whatsappHref(phone, SUPPORT_WHATSAPP_PREFILL);

  if (variant === "text") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
          className
        )}
      >
        <WhatsAppIcon className="size-4" />
        {label}
      </a>
    );
  }

  return (
    <Button asChild variant="outline" className={cn("min-h-12 w-full justify-start", className)}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className="size-5" />
        {label}
        <ArrowRight className="ml-auto size-4 opacity-60" aria-hidden="true" />
      </a>
    </Button>
  );
}
