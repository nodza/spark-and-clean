import type { AdminTier, UserRole } from "@/types/user";
import type { SessionUser } from "@/lib/sessionJwt";

/** Canonical homes per role (client portal URL is /portal; /dashboard rewrites there). */
export function homeForRole(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "technician") return "/tech/dashboard";
  return "/portal";
}

export function loginPathForTarget(pathname: string): string {
  if (pathname === "/tech" || pathname.startsWith("/tech/")) return "/tech/login";
  if (pathname.startsWith("/admin")) return "/admin/login";
  return "/login";
}

export function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

export function isTechLoginPath(pathname: string): boolean {
  return (
    pathname === "/tech" ||
    pathname === "/tech/login" ||
    pathname.startsWith("/tech/login/")
  );
}

/** Admin operations routes — full tier only (marketing-only denied). */
export function isAdminFullOnlyPath(pathname: string): boolean {
  if (pathname.startsWith("/admin/analytics")) return true;
  if (pathname.startsWith("/admin/bookings")) return true;
  if (pathname.startsWith("/admin/technicians")) return true;
  if (pathname.startsWith("/admin/assignments")) return true;
  if (pathname.startsWith("/admin/vehicles")) return true;
  return false;
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/book")) return true;
  if (pathname.startsWith("/booking")) return true;
  if (pathname.startsWith("/contact")) return true;
  if (pathname.startsWith("/services")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/login")) return true;
  if (isAdminLoginPath(pathname)) return true;
  if (isTechLoginPath(pathname)) return true;
  // Auth APIs are public endpoints (they enforce their own rules)
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export function isClientPortalPath(pathname: string): boolean {
  return (
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}

export function isAdminPath(pathname: string): boolean {
  if (isAdminLoginPath(pathname)) return false;
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isTechAppPath(pathname: string): boolean {
  if (isTechLoginPath(pathname)) return false;
  return pathname.startsWith("/tech/");
}

/**
 * After login, only honor next= if the user's role (and admin tier) may open it.
 */
export function resolvePostLoginPath(
  role: UserRole,
  next: string | null | undefined,
  adminTier?: AdminTier | null
): string {
  const fallback = homeForRole(role);
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;

  const path = next.split("?")[0] || next;

  if (isClientPortalPath(path)) {
    return role === "client" ? next.replace(/^\/dashboard/, "/portal") : fallback;
  }
  if (isAdminLoginPath(path)) {
    return role === "admin" ? fallback : homeForRole(role);
  }
  if (isAdminPath(path)) {
    if (role !== "admin") return fallback;
    if (isAdminFullOnlyPath(path) && adminTier === "marketing-only") {
      return "/admin?access=denied";
    }
    return next;
  }
  if (isTechLoginPath(path)) {
    return role === "technician" ? "/tech/dashboard" : fallback;
  }
  if (isTechAppPath(path)) {
    return role === "technician" ? next : fallback;
  }

  // Unknown gated/public mix — only allow clearly public next targets
  if (isPublicPath(path)) return next;
  return fallback;
}

export function canAccessPath(
  session: SessionUser | null,
  pathname: string
): { ok: true } | { ok: false; redirectTo: string } {
  if (isPublicPath(pathname)) return { ok: true };

  // Canonical client URL
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const suffix = pathname.slice("/dashboard".length);
    const dest = `/portal${suffix}` || "/portal";
    return { ok: false, redirectTo: dest };
  }

  if (isClientPortalPath(pathname)) {
    if (!session) {
      return {
        ok: false,
        redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role !== "client") {
      return {
        ok: false,
        redirectTo: `${homeForRole(session.role)}?access=denied`,
      };
    }
    return { ok: true };
  }

  if (isAdminPath(pathname)) {
    if (!session) {
      return {
        ok: false,
        redirectTo: `/admin/login?next=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role !== "admin") {
      return {
        ok: false,
        redirectTo: `${homeForRole(session.role)}?access=denied`,
      };
    }
    if (
      isAdminFullOnlyPath(pathname) &&
      session.adminTier === "marketing-only"
    ) {
      return { ok: false, redirectTo: "/admin?access=denied" };
    }
    return { ok: true };
  }

  if (isTechAppPath(pathname)) {
    if (!session) {
      return {
        ok: false,
        redirectTo: `/tech/login?next=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role !== "technician") {
      return {
        ok: false,
        redirectTo: `${homeForRole(session.role)}?access=denied`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

/** Operations APIs that require a full admin (not marketing-only). */
export function requireFullAdmin(session: SessionUser | null): {
  ok: boolean;
  status?: number;
  error?: string;
} {
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };
  if (session.role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (session.adminTier === "marketing-only") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}
