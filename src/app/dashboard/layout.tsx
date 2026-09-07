import { requirePageSession } from "@/lib/requirePageSession";

/** Stable reference — avoids AuthGuard effect churn */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession({
    roles: ["client"],
    loginPath: "/login",
    nextPath: "/portal",
    allowGuest: true,
  });

  return <>{children}</>;
}
