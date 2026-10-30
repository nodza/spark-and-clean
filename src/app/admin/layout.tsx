import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/requirePageSession";
import { MustChangePasswordGate } from "@/components/auth/MustChangePasswordGate";
import {
  isAdminFullOnlyPath,
  isAdminLoginPath,
} from "@/lib/accessControl";

/**
 * Admin segment layout.
 * /admin/login stays public; other /admin/* routes require an admin session.
 * Marketing-only admins are denied full-only ops routes (defense in depth with middleware).
 * Temporary-password accounts are gated to /admin/change-password.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "";

  // Public login — never run the ops guard here
  if (isAdminLoginPath(pathname)) {
    return <>{children}</>;
  }

  const session = await requirePageSession({
    roles: ["admin"],
    loginPath: "/admin/login",
    nextPath: pathname.startsWith("/admin") ? pathname : "/admin",
    allowGuest: false,
  });

  if (
    session.mustChangePassword &&
    pathname !== "/admin/change-password"
  ) {
    redirect("/admin/change-password");
  }

  if (
    isAdminFullOnlyPath(pathname) &&
    session.adminTier === "marketing-only"
  ) {
    redirect("/admin?access=denied");
  }

  return <MustChangePasswordGate>{children}</MustChangePasswordGate>;
}
