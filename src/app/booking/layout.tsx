"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import type { UserRole } from "@/types/user";

const CUSTOMER_ROLES: UserRole[] = ["CUSTOMER"];

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard roles={CUSTOMER_ROLES}>{children}</AuthGuard>;
}
