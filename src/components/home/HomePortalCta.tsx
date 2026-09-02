"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePortalEntry } from "@/components/auth/PortalEntryLink";

/**
 * Homepage portal entry — same destinations as header / hero:
 * logged out → /login, logged-in customer → /dashboard.
 * Provisional copy — Noel to confirm before launch.
 */
export function HomePortalCta() {
  const entry = usePortalEntry();
  if (!entry.show) return null;

  return (
    <section
      className="border-y bg-secondary/20"
      aria-labelledby="portal-entry-heading"
    >
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:text-left">
        <div>
          <h2
            id="portal-entry-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Already booked?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your booking email to track collection, cleaning, and
            delivery. Guest access uses email only.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="shrink-0">
          <Link href={entry.href}>{entry.label}</Link>
        </Button>
      </div>
    </section>
  );
}
