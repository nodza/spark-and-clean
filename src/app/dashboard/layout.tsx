import { requirePageSession } from "@/lib/requirePageSession";

/**
 * Client portal UI lives under /dashboard and is rewritten from /portal.
 * Guests / leftover guest JWTs are treated as logged out.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession({
    roles: ["client"],
    loginPath: "/login",
    nextPath: "/portal",
    allowGuest: false,
  });

  return <>{children}</>;
}
