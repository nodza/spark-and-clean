"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserRole } from "@/types/user";

type AuthGuardProps = {
  children: ReactNode;
  roles?: UserRole[];
  loginPath?: string;
  /** When false, guest checkout sessions cannot access this route */
  allowGuest?: boolean;
};

/**
 * Cookie-session guard using shared AuthProvider (no extra /api/auth/me spam).
 */
export function AuthGuard({
  children,
  roles = ["client"],
  loginPath = "/login",
  allowGuest = true,
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

    const roleOk = !!user && allowed.includes(user.role);
    const guestOk = allowGuest || !user?.guest;
    const ok = roleOk && guestOk;

    if (!ok) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace(loginPath);
      }
      return;
    }
    redirected.current = false;
  }, [ready, user, allowed, allowGuest, loginPath, router]);

  if (!ready) return null;

  const roleOk = !!user && allowed.includes(user.role);
  const guestOk = allowGuest || !user?.guest;
  if (!roleOk || !guestOk) return null;

  return <>{children}</>;
}
