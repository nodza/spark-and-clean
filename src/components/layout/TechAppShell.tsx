"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Check,
  LogOut,
  User,
} from "lucide-react";
import { TechLayout, type TechTab } from "@/components/layout/TechLayout";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/hooks/useRequireClientAuth";
import { FIELD_INBOX_POLL_MS } from "@/lib/fieldMessages";
import { cn } from "@/lib/utils";

export type TechAppTab = "today" | "completed" | "profile" | "messages";

const TAB_HREF: Record<Exclude<TechAppTab, "messages">, string> = {
  today: "/tech/dashboard",
  completed: "/tech/completed",
  profile: "/tech/profile",
};

const headerIconBtn =
  "relative size-9 shrink-0 rounded-full text-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy";

type TechAppShellProps = {
  activeTab: TechAppTab | "job";
  children: ReactNode;
  contentClassName?: string;
  padded?: boolean;
  className?: string;
};

function TechBootScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col items-center justify-center gap-3 bg-[#f5f7fa] px-6"
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
}: TechAppShellProps) {
  const router = useRouter();
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
    () => [
      {
        key: "today",
        label: "Today",
        icon: <CalendarDays strokeWidth={1.8} />,
      },
      {
        key: "completed",
        label: "Completed",
        icon: <Check strokeWidth={1.8} />,
      },
      {
        key: "profile",
        label: "Profile",
        icon: <User strokeWidth={1.8} />,
      },
    ],
    []
  );

  const handleTabChange = useCallback(
    (key: string) => {
      const href = TAB_HREF[key as keyof typeof TAB_HREF];
      if (href) router.push(href);
    },
    [router]
  );

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

  return (
    <TechLayout
      className={className}
      driverName={displayName}
      driverSubtitle="Your assigned route"
      activeTab={activeTab === "job" ? "today" : activeTab}
      onTabChange={handleTabChange}
      tabs={tabs}
      contentClassName={contentClassName}
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
          padded && "px-[18px] py-5 pb-7",
          !padded && "h-full min-h-0"
        )}
      >
        {children}
      </div>
    </TechLayout>
  );
}

export { TechBootScreen };
