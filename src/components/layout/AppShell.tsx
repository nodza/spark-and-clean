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
  if (pathname.startsWith("/booking")) return false;
  return true;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideGlobalChrome =
    pathname === "/book" || pathname.startsWith("/book/");

  return (
    <AuthProvider>
      {!hideGlobalChrome && <Header />}
      <main className="flex-1">{children}</main>
      {!hideGlobalChrome && <Footer />}
      {shouldShowSupportFab(pathname) && <SupportFab />}
    </AuthProvider>
  );
}
