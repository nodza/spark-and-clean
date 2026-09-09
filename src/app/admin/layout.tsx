import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/requirePageSession";
import {
  isAdminFullOnlyPath,
  isAdminLoginPath,
} from "@/lib/accessControl";

/**
 * Admin segment layout.
 * /admin/login stays public; other /admin/* routes require an admin session.
 * Marketing-only admins are denied full-only ops routes (defense in depth with middleware).
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
    isAdminFullOnlyPath(pathname) &&
    session.adminTier === "marketing-only"
  ) {
    redirect("/admin?access=denied");
  }

  return <>{children}</>;
}
