"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, Home, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 1).toUpperCase();
}

function isBookingsPath(pathname: string) {
  return (
    pathname === "/portal" ||
    pathname === "/portal/" ||
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname.startsWith("/booking/")
  );
}

function isPaymentsPath(pathname: string) {
  return (
    pathname.startsWith("/portal/payments") ||
    pathname.startsWith("/dashboard/payments")
  );
}

function ClientUserFooter() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const displayName = user?.name?.trim() || user?.email || "Account";
  const secondary = user?.email && user?.name?.trim() ? user.email : "Client";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-[11px]">
      <div
        className="flex size-[38px] flex-none items-center justify-center rounded-full text-[15px] font-extrabold"
        style={{ background: "#ffdc39", color: "#000b49" }}
        aria-hidden
      >
        {initials(user?.name, user?.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold text-white">
          {displayName}
        </div>
        <div className="mt-[3px] truncate text-[11.5px] text-white/50">
          {secondary}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex size-10 flex-none items-center justify-center rounded-[9px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6cf3d5] disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-1 flex items-center gap-[11px] rounded-[9px] px-[13px] py-[11px] text-[14px] font-semibold no-underline transition-all duration-150",
        active
          ? "bg-[rgba(108,243,213,0.14)] text-white shadow-[inset_3px_0_0_#6cf3d5]"
          : "bg-transparent text-white/70 shadow-[inset_3px_0_0_transparent] hover:bg-white/[0.06] hover:text-white"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex size-[18px] flex-none items-center justify-center">
        {icon}
      </span>
      {children}
    </Link>
  );
}

function SidebarBody({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex-none border-b border-white/[0.09] px-[22px] pb-[20px] pt-[24px]">
        <div className="flex items-start justify-between gap-3">
          <Image
            src="/uploads/spark-and-clean-22.png"
            alt="Spark & Clean"
            width={160}
            height={56}
            className="h-[56px] w-auto object-contain"
            priority
          />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden -mr-1 -mt-1 flex size-11 flex-none items-center justify-center rounded-[9px] text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6cf3d5]"
              aria-label="Close navigation"
            >
              <X size={20} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <div className="mt-[12px] text-[10px] font-extrabold tracking-[0.2em] text-[#6cf3d5]">
          CLIENT PORTAL
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-[14px] py-5" aria-label="Client portal">
        <div className="px-3 pb-[11px] text-[10px] font-extrabold tracking-[0.18em] text-white/40">
          MY ACCOUNT
        </div>
        <NavLink
          href="/portal"
          active={isBookingsPath(pathname)}
          icon={<Home size={18} strokeWidth={1.8} />}
        >
          My Bookings
        </NavLink>
        <NavLink
          href="/portal/payments"
          active={isPaymentsPath(pathname)}
          icon={<CreditCard size={18} strokeWidth={1.8} />}
        >
          Payment history
        </NavLink>
        <div className="mx-3 mt-[22px]">
          <Link
            href="/book/rug"
            className="block rounded-full bg-[#6cf3d5] py-3 text-center text-[13px] font-extrabold text-[#000b49] no-underline transition-colors hover:bg-[#4fe4c4]"
          >
            Book a collection
          </Link>
        </div>
      </nav>

      <div className="flex-none border-t border-white/[0.09] px-5 py-4">
        <ClientUserFooter />
      </div>
    </>
  );
}

/**
 * Client portal chrome from Client Portal.dc.html — navy sidebar, no ops topbar.
 */
export function ClientPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/portal";
  const [navOpen, setNavOpen] = React.useState(false);
  const closeNav = React.useCallback(() => setNavOpen(false), []);

  React.useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen, closeNav]);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const pageTitle = isPaymentsPath(pathname)
    ? "Payments"
    : pathname.startsWith("/booking/")
      ? "Booking"
      : "Bookings";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f7fa] text-[#32373c]">
      <aside
        className="hidden h-full w-[258px] flex-none flex-col overflow-hidden lg:flex"
        style={{ background: "#000b49" }}
        aria-label="Primary"
      >
        <SidebarBody pathname={pathname} />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          navOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!navOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-[#000b49]/40 transition-opacity duration-200",
            navOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Dismiss navigation"
          tabIndex={navOpen ? 0 : -1}
          onClick={closeNav}
        />
        <aside
          id="client-portal-nav"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(258px,88vw)] flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out",
            navOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ background: "#000b49" }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          {...(!navOpen ? { inert: true } : {})}
        >
          <SidebarBody pathname={pathname} onClose={closeNav} />
        </aside>
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 flex-none items-center gap-2 border-b border-[#e3e7ed] bg-white px-3 py-2 sm:gap-3 sm:px-4 lg:hidden">
          <button
            type="button"
            className="flex size-11 flex-none items-center justify-center rounded-[9px] text-[#000b49] hover:bg-[#f5f7fa]"
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="client-portal-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
          <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#000b49]">
            {pageTitle}
          </span>
          <Link
            href="/book/rug"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#000b49] px-3.5 py-2 text-[12.5px] font-extrabold text-white no-underline hover:bg-[#0a1a6b]"
          >
            New collection
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
