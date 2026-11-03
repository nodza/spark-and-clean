"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { passwordChangePathForRole } from "@/lib/accessControl";
import { AdminChangePasswordScreen } from "@/components/auth/AdminChangePasswordScreen";

/**
 * Sends technicians and admins with a temporary password to their
 * change-password screen before the rest of the app.
 */
export function MustChangePasswordGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";
  const target =
    ready && user?.mustChangePassword === true
      ? passwordChangePathForRole(user.role)
      : null;
  const blocked = Boolean(target && pathname !== target);

  useEffect(() => {
    if (!blocked || !target) return;
    router.replace(target);
  }, [blocked, target, router]);

  if (blocked && target === "/admin/change-password") {
    return <AdminChangePasswordScreen />;
  }

  if (blocked) return null;

  return <>{children}</>;
}
