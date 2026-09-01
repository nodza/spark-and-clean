"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface TechTab {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface TechLayoutProps {
  /** Driver name shown in the navy header */
  driverName: string;
  /** Subtitle below the driver name (e.g. "Gauteng · Sandton route") */
  driverSubtitle?: string;
  /** Optional notification bell slot (top-right of header) */
  headerAction?: React.ReactNode;
  /** Bottom tab definitions */
  tabs: TechTab[];
  /** Currently active tab key */
  activeTab: string;
  /** Called when a tab is pressed */
  onTabChange: (key: string) => void;
  /** Scrollable page content */
  children: React.ReactNode;
  className?: string;
}

/**
 * TechLayout — Mobile-first app shell for the Technician Portal.
 *
 * Spec (Technician Portal.dc.html):
 *   Container  392px max-w, 812px height (phone frame in designs)
 *   Header     background #000b49, padding 18px 20px 16px
 *   Tab bar    white, 1px #e3e7ed border-top, padding 10px 8px 18px
 *   Content    flex-1, overflow-y-auto, background #f5f7fa
 *
 * In production the page fills full viewport height; the phone frame shown
 * in the mockups is a design-tool preview aid only.
 */
export function TechLayout({
  driverName,
  driverSubtitle,
  headerAction,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: TechLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-col w-full max-w-[430px] mx-auto",
        // Fill viewport on real device, cap at screen height
        "h-screen overflow-hidden",
        className
      )}
      style={{ background: "#f5f7fa" }}
    >
      {/* ─── App Header ─────────────────────────────────────────────────── */}
      <div
        className="flex-none px-[20px] pb-[16px] pt-[18px]"
        style={{ background: "#000b49" }}
      >
        <div className="flex items-center gap-[12px]">
          {/* Logo chip */}
          <div className="flex-none rounded-[8px] bg-white px-[9px] py-[6px]">
            <Image
              src="/uploads/spark-and-clean-22.png"
              alt="Spark & Clean"
              width={60}
              height={20}
              className="h-[20px] w-auto object-contain"
              priority
            />
          </div>

          {/* Driver info */}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold text-white truncate">{driverName}</div>
            {driverSubtitle && (
              <div className="mt-[2px] text-[11.5px] text-[#6cf3d5]">{driverSubtitle}</div>
            )}
          </div>

          {/* Optional bell / action */}
          {headerAction && (
            <div className="flex-none">{headerAction}</div>
          )}
        </div>
      </div>

      {/* ─── Scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {children}
      </div>

      {/* ─── Bottom Tab Bar ──────────────────────────────────────────────── */}
      <div
        className="flex-none flex bg-white px-[8px] pb-[18px] pt-[10px]"
        style={{ borderTop: "1px solid #e3e7ed" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className="flex flex-1 flex-col items-center gap-[5px] py-[8px] cursor-pointer transition-colors duration-150"
              style={{ color: isActive ? "#000b49" : "#b3b9c2" }}
            >
              {tab.icon}
              <span className="text-[10.5px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
