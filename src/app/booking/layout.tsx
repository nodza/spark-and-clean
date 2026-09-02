"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import type { UserRole } from "@/types/user";

const CLIENT_ROLES: UserRole[] = ["client"];

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard roles={CLIENT_ROLES}>{children}</AuthGuard>;
}
