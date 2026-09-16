"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { isFullAccount, isPersistedClient } from "@/types/user";
import { homeForRole } from "@/lib/accessControl";
import { cn } from "@/lib/utils";

/**
 * Shared workspace / portal entry from marketing surfaces (Home, hero, etc.):
 * - logged out → /login
 * - client → /portal (My Bookings)
 * - admin → /admin
 * - technician → /tech/dashboard
 * Guest checkout JWTs are treated as logged out.
 */
export function usePortalEntry() {
  const { user, ready } = useAuth();

  if (!ready) {
    return {
      ready: false as const,
      href: "/login" as const,
      label: "View My Booking" as const,
      show: true as const,
    };
  }

  if (isPersistedClient(user)) {
    return {
      ready: true as const,
      href: homeForRole("client"),
      label: "My Bookings" as const,
      show: true as const,
    };
  }

  if (isFullAccount(user) && user.role === "admin") {
    return {
      ready: true as const,
      href: homeForRole("admin"),
      label: "Go to Dashboard" as const,
      show: true as const,
    };
  }

  if (isFullAccount(user) && user.role === "technician") {
    return {
      ready: true as const,
      href: homeForRole("technician"),
      label: "Go to Dashboard" as const,
      show: true as const,
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
