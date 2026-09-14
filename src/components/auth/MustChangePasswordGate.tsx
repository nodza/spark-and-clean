"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

/** Redirects technicians with mustChangePassword to /tech/change-password. */
export function MustChangePasswordGate({ children }: { children: ReactNode }) {
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
