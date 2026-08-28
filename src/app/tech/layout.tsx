"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/user";

const DRIVER_ROLES: UserRole[] = ["DRIVER"];

export default function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/tech") {
    return <>{children}</>;
  }

  return (
    <AuthGuard roles={DRIVER_ROLES} loginPath="/tech">
      {children}
    </AuthGuard>
  );
}
