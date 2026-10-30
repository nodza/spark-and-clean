"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { passwordChangePathForRole } from "@/lib/accessControl";

/**
 * Sends technicians and admins with a temporary password to their
 * change-password screen before the rest of the app.
 */
export function MustChangePasswordGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";
  const target =
    user?.mustChangePassword === true
      ? passwordChangePathForRole(user.role)
      : null;
  const blocked = Boolean(target && pathname !== target);

  useEffect(() => {
    if (!ready || !blocked || !target) return;
    router.replace(target);
  }, [ready, blocked, target, router]);

  if (blocked) return null;

  return <>{children}</>;
}
