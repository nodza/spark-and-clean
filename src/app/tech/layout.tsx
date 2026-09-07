import { headers } from "next/headers";
import { requirePageSession } from "@/lib/requirePageSession";
import { isTechLoginPath } from "@/lib/accessControl";

/**
 * Tech segment layout.
 * /tech and /tech/login stay public; app routes require a technician session.
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

  return <>{children}</>;
}
