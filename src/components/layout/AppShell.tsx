"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SupportFab } from "@/components/support/SupportFab";
import {
  hidesMarketingFooter,
  hidesMarketingHeader,
} from "@/lib/marketingChrome";

function shouldShowSupportFab(pathname: string) {
  if (pathname === "/book" || pathname.startsWith("/book/")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/tech")) return false;
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/portal")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/register")) return false;
  if (pathname.startsWith("/signup")) return false;
  if (pathname.startsWith("/forgot-password")) return false;
  if (pathname.startsWith("/reset-password")) return false;
  if (pathname.startsWith("/booking")) return false;
  return true;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const showHeader = !hidesMarketingHeader(pathname);
  const showFooter = !hidesMarketingFooter(pathname);

  // Immersive routes (portals, technician app, booking status) fill the viewport themselves.
  return (
    <AuthProvider>
      {showHeader ? (
        <>
          <Header />
          <main className="flex-1">{children}</main>
          {shouldShowSupportFab(pathname) && <SupportFab />}
          {showFooter ? <Footer /> : null}
        </>
      ) : (
        children
      )}
      <Toaster richColors position="top-right" closeButton />
    </AuthProvider>
  );
}
