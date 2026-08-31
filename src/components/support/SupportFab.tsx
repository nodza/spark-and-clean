"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { branchContacts } from "@/data/branchContacts";
import { OPEN_SUPPORT_CHAT_EVENT } from "@/components/support/supportChat";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WhatsAppSupportLink } from "@/components/support/WhatsAppSupportLink";
import { useOverlapsDarkSurface } from "@/hooks/useOverlapsDarkSurface";
import { cn } from "@/lib/utils";

/**
 * Marketing-site support entry. Labelled “Chat with support” per the booking-
 * channel spike — not a WhatsApp floating booker.
 */
export function SupportFab() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onDark = useOverlapsDarkSurface(buttonRef);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpen);
  }, []);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-hidden={open || undefined}
        tabIndex={open ? -1 : 0}
        className={cn(
          "fixed z-40 h-10 min-h-10 rounded-full bg-transparent px-4 text-sm font-semibold shadow-none transition-colors duration-200 hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-6",
          open && "invisible pointer-events-none",
          onDark
            ? "border-primary-foreground/50 text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground"
            : "border-foreground/40 text-foreground hover:border-foreground/70 hover:text-foreground"
        )}
        onClick={() => setOpen(true)}
      >
        <WhatsAppIcon className="size-4" />
        Chat with support
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-0 right-0 flex max-h-[min(88dvh,36rem)] w-full max-w-[100vw] translate-x-0 translate-y-0 flex-col gap-0 overflow-x-hidden overflow-y-hidden rounded-t-2xl border-x-0 border-b-0 p-0 sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:right-auto sm:max-w-[26rem] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border"
        >
          <DialogHeader className="border-b bg-primary px-5 py-4 text-left sm:rounded-t-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold text-primary-foreground sm:text-lg">
                  Chat with support
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-primary-foreground/85">
                  Book collections online. WhatsApp is for questions and help with your booking.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close support</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
            <Button asChild size="lg" className="min-h-12 w-full text-base font-semibold">
              <Link href="/book/rug" onClick={() => setOpen(false)}>
                Book a collection
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Questions? Message a branch
            </p>
            <ul className="mt-3 space-y-2">
              {branchContacts.map((branch) => (
                <li key={branch.whatsapp}>
                  <WhatsAppSupportLink
                    phone={branch.whatsapp}
                    label={`WhatsApp ${branch.name.replace(" Branch", "")}`}
                  />
                </li>
              ))}
            </ul>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Prefer a call or email?{" "}
              <Link
                href="/contact"
                className="font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => setOpen(false)}
              >
                Contact us
              </Link>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
