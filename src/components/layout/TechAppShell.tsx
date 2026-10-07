"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  LogOut,
  Map as MapIcon,
  MessageSquare,
} from "lucide-react";
import { TechLayout, type TechTab } from "@/components/layout/TechLayout";
import { Button } from "@/components/ui/button";
import { TECH_BOTTOM_NAV, techNavKeyForPath } from "@/config/techNav";
import { useAuth, useRequireAuth } from "@/hooks/useRequireClientAuth";
import { FIELD_INBOX_POLL_MS } from "@/lib/fieldMessages";
import { cn } from "@/lib/utils";

export type TechAppTab =
  | "today"
  | "map"
  | "messages"
  | "completed"
  | "profile";

const TAB_ICONS = {
  today: CalendarDays,
  map: MapIcon,
  messages: MessageSquare,
} as const;

const headerIconBtn =
  "relative size-11 shrink-0 rounded-full text-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy";

type TechAppShellProps = {
  activeTab: TechAppTab | "job";
  children: ReactNode;
  contentClassName?: string;
  padded?: boolean;
  className?: string;
  /** Pinned above the tab bar. Used by the job Collect / Deliver action. */
  actionBar?: ReactNode;
};

function TechBootScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-30 mx-auto flex h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-3 bg-[#f5f7fa] px-6"
      role="status"
      aria-live="polite"
    >
      <div
        className="size-9 animate-pulse rounded-full bg-navy/15"
        aria-hidden
      />
      <p className="text-sm font-medium text-[#9aa0a6]">{message}</p>
    </div>
  );
}

/**
 * Session-gated technician shell (design: Technician Portal.dc.html).
 * Identity = cookie session `driverProfileId` — never localStorage.
 */
export function TechAppShell({
  activeTab,
  children,
  contentClassName,
  padded = true,
  className,
  actionBar,
}: TechAppShellProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { ready: authReady, logout } = useAuth();
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/tech/messages", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );
    } catch {
      // Badge is best-effort; job APIs still enforce access.
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    void refreshUnread();
    const timer = window.setInterval(
      () => void refreshUnread(),
      FIELD_INBOX_POLL_MS
    );
    const onRead = () => void refreshUnread();
    window.addEventListener("tech-field-messages-read", onRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("tech-field-messages-read", onRead);
    };
  }, [ready, user, refreshUnread]);

  const tabs: TechTab[] = useMemo(
    () =>
      TECH_BOTTOM_NAV.map((tab) => {
        const Icon = TAB_ICONS[tab.key];
        return {
          key: tab.key,
          label: tab.label,
          href: tab.href,
          icon: <Icon strokeWidth={1.8} />,
          badgeCount: tab.key === "messages" ? unreadCount : undefined,
        };
      }),
    [unreadCount]
  );

  const highlighted =
    techNavKeyForPath(pathname) ??
    (activeTab === "job" || activeTab === "today"
      ? "today"
      : activeTab === "map" || activeTab === "messages"
        ? activeTab
        : "");

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/tech/login");
  }, [logout, router]);

  const handleNotifications = useCallback(() => {
    router.push("/tech/messages");
  }, [router]);

  if (!authReady) return <TechBootScreen />;
  if (!ready || !user) {
    return <TechBootScreen message="Checking session…" />;
  }

  const displayName = user.name?.trim() || user.email;
  const onProfile =
    pathname === "/tech/profile" || pathname.startsWith("/tech/profile/");

  return (
    <TechLayout
      className={className}
      driverName={displayName}
      driverSubtitle={onProfile ? "Account" : "Profile"}
      profileHref="/tech/profile"
      profileActive={onProfile}
      activeTab={highlighted}
      tabs={tabs}
      actionBar={actionBar}
      contentClassName={cn(actionBar && "flex flex-col overflow-hidden", contentClassName)}
      headerAction={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={headerIconBtn}
            onClick={handleNotifications}
            aria-label={
              unreadCount > 0
                ? `Messages, ${unreadCount} unread`
                : "Notifications"
            }
          >
            <Bell className="size-[17px]" strokeWidth={1.85} />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d64545] px-1 text-[9px] font-extrabold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={headerIconBtn}
            onClick={() => void handleLogout()}
            aria-label="Log out"
          >
            <LogOut className="size-[17px]" strokeWidth={1.85} />
          </Button>
        </>
      }
    >
      <div
        className={cn(
          actionBar
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] py-5"
            : padded && "px-[18px] py-5 pb-7",
          !actionBar && !padded && "h-full min-h-0"
        )}
        style={
          actionBar ? { WebkitOverflowScrolling: "touch" } : undefined
        }
      >
        {children}
      </div>
    </TechLayout>
  );
}

export { TechBootScreen };
