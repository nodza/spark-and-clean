"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideGlobalChrome =
    pathname === "/book" || pathname.startsWith("/book/");

  return (
    <AuthProvider>
      {!hideGlobalChrome && <Header />}
      <main className="flex-1">{children}</main>
      {!hideGlobalChrome && <Footer />}
    </AuthProvider>
  );
}
