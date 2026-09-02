"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * Shared portal entry: logged-out customers → /login,
 * logged-in customers → /dashboard. Keeps homepage + header consistent.
 */
export function usePortalEntry() {
  const { user, ready } = useAuth();
  const isClient = user?.role === "client";

  if (!ready) {
    return {
      ready: false as const,
      href: "/login" as const,
      label: "View My Booking" as const,
      show: true as const,
    };
  }

  if (isClient) {
    return {
      ready: true as const,
      href: "/dashboard" as const,
      label: "My Bookings" as const,
      show: true as const,
    };
  }

  if (user) {
    // Admin / technician: client portal link is not shown
    return {
      ready: true as const,
      href: "/login" as const,
      label: "View My Booking" as const,
      show: false as const,
    };
  }

  return {
    ready: true as const,
    href: "/login" as const,
    label: "View My Booking" as const,
    show: true as const,
  };
}

type PortalEntryLinkProps = {
  className?: string;
  label?: string;
};

export function PortalEntryLink({ className, label }: PortalEntryLinkProps) {
  const entry = usePortalEntry();
  if (!entry.show) return null;

  return (
    <Link href={entry.href} className={cn(className)}>
      {label ?? entry.label}
    </Link>
  );
}
