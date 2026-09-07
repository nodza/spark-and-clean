"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import type { UserRole } from "@/types/user";

const ADMIN_ROLES: UserRole[] = ["admin"];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard roles={ADMIN_ROLES} loginPath="/login">
      {children}
    </AuthGuard>
  );
}
