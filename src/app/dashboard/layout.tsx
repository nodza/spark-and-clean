"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import type { UserRole } from "@/types/user";

/** Stable reference — avoids AuthGuard effect churn */
const CLIENT_ROLES: UserRole[] = ["client"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard roles={CLIENT_ROLES}>{children}</AuthGuard>;
}
