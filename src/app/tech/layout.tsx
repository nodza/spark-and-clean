"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/user";

const TECHNICIAN_ROLES: UserRole[] = ["technician"];

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
    <AuthGuard roles={TECHNICIAN_ROLES} loginPath="/tech">
      {children}
    </AuthGuard>
  );
}
