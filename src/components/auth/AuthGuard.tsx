"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isFullAccount, type UserRole } from "@/types/user";

type AuthGuardProps = {
  children: ReactNode;
  roles?: UserRole[];
  loginPath?: string;
  /** Leftover guest JWTs are never a full account. Default: reject guests. */
  allowGuest?: boolean;
};

/**
 * Cookie-session guard using shared AuthProvider (no extra /api/auth/me spam).
 */
export function AuthGuard({
  children,
  roles = ["client"],
  loginPath = "/login",
  allowGuest = false,
}: AuthGuardProps) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const redirected = useRef(false);

  const rolesKey = roles.join("|");
  const allowed = useMemo(
    () => rolesKey.split("|") as UserRole[],
    [rolesKey]
  );

  const ok =
    !!user &&
    allowed.includes(user.role) &&
    (isFullAccount(user) || allowGuest);

  useEffect(() => {
    if (!ready) return;

    if (!ok) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace(loginPath);
      }
      return;
    }
    redirected.current = false;
  }, [ready, ok, loginPath, router]);

  if (!ready) return null;
  if (!ok) return null;

  return <>{children}</>;
}
