"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TechTab {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  /** Unread count shown as a badge on the tab icon */
  badgeCount?: number;
}

interface TechLayoutProps {
  /** Driver name shown in the navy header */
  driverName: string;
  /** Subtitle below the driver name (e.g. "Your assigned jobs") */
  driverSubtitle?: string;
  /** Optional notification / logout slot (top-right of header) */
  headerAction?: React.ReactNode;
  /** Bottom tab definitions */
  tabs: TechTab[];
  /** Currently active tab key */
  activeTab: string;
  /** Called when a tab is pressed */
  onTabChange?: (key: string) => void;
  /**
   * Pinned above the tab bar (job Collect / Deliver).
   * The tab bar keeps the home-indicator inset, so this control stays clear of both.
   */
  actionBar?: React.ReactNode;
  /** Tapping the driver name opens this route (profile). */
  profileHref?: string;
  profileActive?: boolean;
  /** Scrollable page content */
  children: React.ReactNode;
  /** Extra classes on the scrollable content region */
  contentClassName?: string;
  hideTabs?: boolean;
  className?: string;
}

/**
 * TechLayout — Mobile-first app shell for the Technician Portal.
 */
export function TechLayout({
  driverName,
  driverSubtitle,
  headerAction,
  tabs,
  activeTab,
  onTabChange,
  actionBar,
  profileHref,
  profileActive = false,
  children,
  contentClassName,
  hideTabs = false,
  className,
}: TechLayoutProps) {
  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
    };
  }, []);

  const identity = (
    <>
      <div className="truncate text-sm font-extrabold text-white">
        {driverName}
      </div>
      {driverSubtitle ? (
        <div className="mt-0.5 truncate text-[11.5px] text-teal">
          {driverSubtitle}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-30 mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden overscroll-none bg-[#f5f7fa]",
        className
      )}
    >
      <header className="flex-none bg-navy px-5 pb-4 pt-[max(1.125rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <div className="flex-none">
            <Image
              src="/uploads/spark-and-clean-22.png"
              alt="Spark & Clean"
              width={96}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>

          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={`${driverName}, profile`}
              aria-current={profileActive ? "page" : undefined}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-teal">
                <User className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">{identity}</span>
            </Link>
          ) : (
            <div className="min-w-0 flex-1">{identity}</div>
          )}

          {headerAction ? (
            <div className="flex flex-none items-center gap-1.5">
              {headerAction}
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1",
          actionBar
            ? "flex flex-col overflow-hidden"
            : "overflow-y-auto overscroll-contain",
          contentClassName
        )}
        style={
          actionBar ? undefined : { WebkitOverflowScrolling: "touch" }
        }
      >
        {children}
      </div>

      {actionBar ? (
        <div
          className={cn(
            "relative z-20 flex-none border-t border-[#e3e7ed] bg-white px-[18px] pt-2.5 shadow-[0_-8px_24px_rgba(0,11,73,0.06)]",
            hideTabs
              ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              : "pb-2.5"
          )}
        >
          {actionBar}
        </div>
      ) : null}

      {!hideTabs ? (
        <nav
          className="relative z-20 flex flex-none border-t border-[#e3e7ed] bg-white px-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5"
          aria-label="Technician navigation"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const unread =
              typeof tab.badgeCount === "number" && tab.badgeCount > 0
                ? tab.badgeCount
                : 0;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  unread > 0 ? `${tab.label}, ${unread} unread` : undefined
                }
                onClick={() => onTabChange?.(tab.key)}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                  isActive
                    ? "text-navy"
                    : "text-[#6b7280] hover:bg-[#f5f7fa] hover:text-navy active:bg-[#eef1f5]"
                )}
              >
                <span aria-hidden className="relative [&_svg]:size-[21px]">
                  {tab.icon}
                  {unread > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d64545] px-1 text-[9px] font-extrabold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate text-[10.5px] font-bold">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
