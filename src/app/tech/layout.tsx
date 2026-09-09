import { headers } from "next/headers";
import { requirePageSession } from "@/lib/requirePageSession";
import { isTechLoginPath } from "@/lib/accessControl";
import { MustChangePasswordGate } from "@/components/auth/MustChangePasswordGate";

/**
 * Tech segment layout.
 * /tech and /tech/login stay public; app routes require a technician session.
 * Temporary-password accounts are gated to /tech/change-password.
 */
export default async function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "";

  if (isTechLoginPath(pathname)) {
    return <>{children}</>;
  }

  await requirePageSession({
    roles: ["technician"],
    loginPath: "/tech/login",
    nextPath: pathname.startsWith("/tech/") ? pathname : "/tech/dashboard",
    allowGuest: false,
  });

  return <MustChangePasswordGate>{children}</MustChangePasswordGate>;
}
