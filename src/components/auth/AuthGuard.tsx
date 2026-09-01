"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserRole } from "@/types/user";

type AuthGuardProps = {
  children: ReactNode;
  roles?: UserRole[];
  loginPath?: string;
};

/**
 * Cookie-session guard using shared AuthProvider (no extra /api/auth/me spam).
 */
export function AuthGuard({
  children,
  roles = ["CUSTOMER"],
  loginPath = "/login",
}: AuthGuardProps) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const redirected = useRef(false);

  const rolesKey = roles.join("|");
  const allowed = useMemo(
    () => rolesKey.split("|") as UserRole[],
    [rolesKey]
  );

  useEffect(() => {
    if (!ready) return;

    const ok = !!user && allowed.includes(user.role);
    if (!ok) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace(loginPath);
      }
      return;
    }
    redirected.current = false;
  }, [ready, user, allowed, loginPath, router]);

  if (!ready) return null;
  if (!user || !allowed.includes(user.role)) return null;

  return <>{children}</>;
}
