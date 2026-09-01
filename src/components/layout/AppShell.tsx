"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Paths where the global marketing header + footer should NOT appear.
// Portal layouts (PortalLayout, TechLayout, AuthLayout) manage their own chrome.
const PORTAL_PATHS = ["/admin", "/dashboard", "/tech", "/book", "/booking", "/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = PORTAL_PATHS.some((p) => pathname.startsWith(p));

  if (isPortal) {
    // Render bare — no header, no footer, no wrapping <main>.
    // The layout shell (PortalLayout / AuthLayout / TechLayout) fills the viewport itself.
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
