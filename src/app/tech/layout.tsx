"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserRole } from "@/types/user";

const TECHNICIAN_ROLES: UserRole[] = ["technician"];

function MustChangePasswordGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || !user) return;
    if (user.mustChangePassword && pathname !== "/tech/change-password") {
      router.replace("/tech/change-password");
    }
  }, [ready, user, pathname, router]);

  if (user?.mustChangePassword && pathname !== "/tech/change-password") {
    return null;
  }

  return <>{children}</>;
}

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
      <MustChangePasswordGate>{children}</MustChangePasswordGate>
    </AuthGuard>
  );
}
