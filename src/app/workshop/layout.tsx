import { headers } from "next/headers";
import { requirePageSession } from "@/lib/requirePageSession";
import { isWorkshopLoginPath } from "@/lib/accessControl";
import { MustChangePasswordGate } from "@/components/auth/MustChangePasswordGate";

export default async function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "";
  if (isWorkshopLoginPath(pathname)) return <>{children}</>;

  await requirePageSession({
    roles: ["workshop"],
    loginPath: "/workshop/login",
    nextPath: pathname.startsWith("/workshop/")
      ? pathname
      : "/workshop/dashboard",
    allowGuest: false,
  });

  return <MustChangePasswordGate>{children}</MustChangePasswordGate>;
}
