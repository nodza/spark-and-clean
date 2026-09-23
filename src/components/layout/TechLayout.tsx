"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface TechTab {
  key: string;
  label: string;
  icon: React.ReactNode;
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
  onTabChange: (key: string) => void;
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
  children,
  contentClassName,
  hideTabs = false,
  className,
}: TechLayoutProps) {
  return (
    <div
      className={cn(
        "mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f5f7fa]",
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

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-white">
              {driverName}
            </div>
            {driverSubtitle ? (
              <div className="mt-0.5 truncate text-[11.5px] text-teal">
                {driverSubtitle}
              </div>
            ) : null}
          </div>

          {headerAction ? (
            <div className="flex flex-none items-center gap-1.5">
              {headerAction}
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          contentClassName
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {!hideTabs ? (
        <nav
          className="flex flex-none border-t border-[#e3e7ed] bg-white px-2 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2.5"
          aria-label="Technician navigation"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                  isActive ? "text-navy" : "text-[#b3b9c2]"
                )}
              >
                <span aria-hidden className="relative [&_svg]:size-[21px]">
                  {tab.icon}
                  {typeof tab.badgeCount === "number" && tab.badgeCount > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d64545] px-1 text-[9px] font-extrabold text-white">
                      {tab.badgeCount > 9 ? "9+" : tab.badgeCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10.5px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
