"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideGlobalChrome = pathname.startsWith("/book") || pathname.startsWith("/booking");
  const hideFooter = hideGlobalChrome || pathname === "/dashboard";

  return (
    <>
      {!hideGlobalChrome && <Header />}
      <main className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
    </>
  );
}
