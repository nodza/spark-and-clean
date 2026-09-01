import * as React from "react";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number | string;
  onClick?: () => void;
  className?: string;
}

/**
 * Sidebar navigation item — used in both Admin and Client portal shells.
 *
 * Spec (Design Reference.dc.html — Sidebar navigation):
 *   Item     padding 10px 13px, radius 9px, 13.5px, gap 3px between items
 *   Icon     17px, stroke 2, currentColor
 *   Active   background #6cf3d5, color #000b49, weight 800
 *   Inactive transparent, rgba(255,255,255,.72), weight 600
 *   Badge    #ffdc39 pill, #000b49 text, 10.5px / 800
 *   Dividers 1px rgba(255,255,255,.09) — add manually between groups
 */
function SidebarNavItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
  className,
}: SidebarNavItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      className={cn(
        "flex items-center gap-[11px] rounded-[9px] px-[13px] py-[10px] text-[13.5px] cursor-pointer transition-all duration-150 select-none",
        active
          ? "bg-[#6cf3d5] text-[#000b49] font-extrabold"
          : "bg-transparent text-white/[0.72] font-semibold hover:bg-white/[0.06]",
        className
      )}
    >
      {icon && (
        <span
          className="flex-none"
          style={{ width: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {badge !== undefined && badge !== null && (
        <span className="ml-auto rounded-full bg-[#ffdc39] text-[#000b49] text-[10.5px] font-extrabold px-[7px] py-[2px] leading-none">
          {badge}
        </span>
      )}
    </div>
  );
}

/** Thin divider between sidebar nav groups */
function SidebarNavDivider() {
  return <div className="mx-[12px] my-[8px] h-px bg-white/[0.09]" />;
}

/** Section label above a group of nav items */
function SidebarNavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <div className="px-[13px] pb-[11px] text-[10px] font-extrabold tracking-[0.18em] uppercase text-white/40">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-[3px]">{children}</div>
    </div>
  );
}

export { SidebarNavItem, SidebarNavDivider, SidebarNavGroup };
