"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import type { UserRole } from "@/types/user";

/** Stable reference — avoids AuthGuard effect churn */
const CUSTOMER_ROLES: UserRole[] = ["CUSTOMER"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard roles={CUSTOMER_ROLES}>{children}</AuthGuard>;
}
