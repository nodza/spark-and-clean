"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SupportFab } from "@/components/support/SupportFab";

function shouldShowSupportFab(pathname: string) {
  if (pathname === "/book" || pathname.startsWith("/book/")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/tech")) return false;
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/forgot-password")) return false;
  if (pathname.startsWith("/reset-password")) return false;
  if (pathname.startsWith("/booking")) return false;
  return true;
}

// Paths where the global marketing header + footer should NOT appear.
// Portal layouts (PortalLayout, TechLayout, AuthLayout) manage their own chrome.
const PORTAL_PATHS = [
  "/admin",
  "/dashboard",
  "/tech",
  "/book",
  "/booking",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = PORTAL_PATHS.some((p) => pathname.startsWith(p));

  if (isPortal) {
    // Render bare — no header, no footer, no wrapping <main>.
    // The layout shell (PortalLayout / AuthLayout / TechLayout) fills the viewport itself.
    return <AuthProvider>{children}</AuthProvider>;
  }

  return (
    <AuthProvider>
      <Header />
      <main className="flex-1">{children}</main>
      {shouldShowSupportFab(pathname) && <SupportFab />}
      <Footer />
    </AuthProvider>
  );
}
