"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { Badge } from "@/components/ui/badge";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavItem, SidebarNavGroup } from "@/components/ui/sidebar-nav";
import { format } from "date-fns";
import {
  LayoutGrid,
  CalendarDays,
  Users,
  UserCog,
  Tag,
  Search,
} from "lucide-react";

// ─── Sidebar user footer ─────────────────────────────────────────────────────
function AdminUserFooter() {
  return (
    <div className="flex items-center gap-[11px]">
      <div
        className="flex size-[36px] flex-none items-center justify-center rounded-full text-[14px] font-extrabold"
        style={{ background: "#6cf3d5", color: "#000b49" }}
      >
        LM
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-bold text-white">Lerato Mabaso</div>
        <div className="mt-[3px] text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
          Operations manager
        </div>
      </div>
    </div>
  );
}

// ─── KPI stat tile ───────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  delta,
  deltaColor = "#0a7a63",
}: {
  label: string;
  value: string | number;
  delta: string;
  deltaColor?: string;
}) {
  return (
    <div className="ds-card">
      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>{label}</div>
      <div
        className="tabular mt-[10px]"
        style={{ fontSize: 29, fontWeight: 800, color: "#000b49", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      <div className="text-meta mt-[7px]" style={{ color: deltaColor }}>{delta}</div>
    </div>
  );
}

// ─── Status badge mapping ────────────────────────────────────────────────────
function statusVariant(status: string): React.ComponentProps<typeof Badge>["variant"] {
  const s = status.toUpperCase();
  if (s === "BOOKED" || s === "SCHEDULED") return "status-new";
  if (s === "COLLECTED") return "status-collected";
  if (s === "CLEANING" || s === "DRYING" || s === "READY") return "status-cleaning";
  if (s === "DELIVERED") return "status-completed";
  return "outline";
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { bookings, fetchBookings } = useBookingStore();

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const today = new Date().toISOString().split("T")[0];
  const todaysPickups = bookings.filter(
    (b) => b.collectionDate.startsWith(today) && b.status === "SCHEDULED"
  ).length;
  const activeJobs = bookings.filter((b) =>
    ["COLLECTED", "CLEANING", "DRYING", "READY"].includes(b.status)
  ).length;
  const revenue = bookings.reduce(
    (acc, b) => acc + (b.estimatedPriceMin + b.estimatedPriceMax) / 2,
    0
  );
  const lateCount = 2; // placeholder until LATE/OVERDUE statuses are added to the type

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  const sidebar = (
    <SidebarNavGroup>
      <SidebarNavItem
        icon={<LayoutGrid size={17} strokeWidth={1.8} />}
        label="Overview"
        active
      />
      <SidebarNavItem
        icon={<CalendarDays size={17} strokeWidth={1.8} />}
        label="Bookings"
        badge={bookings.length || 12}
        onClick={() => router.push("/admin/bookings")}
      />
      <SidebarNavItem
        icon={<UserCog size={17} strokeWidth={1.8} />}
        label="Technicians"
      />
      <SidebarNavItem
        icon={<Users size={17} strokeWidth={1.8} />}
        label="Clients"
      />
      <SidebarNavItem
        icon={<Tag size={17} strokeWidth={1.8} />}
        label="Pricing & coupons"
      />
    </SidebarNavGroup>
  );

  // ─── Topbar ───────────────────────────────────────────────────────────────
  const topbarActions = (
    <div className="flex items-center gap-[10px]">
      <div className="ds-search w-[260px]">
        <Search size={13} className="flex-none" style={{ color: "#9aa0a6" }} />
        <input
          placeholder="Search bookings, clients"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9aa0a6]"
        />
      </div>
      <Link href="/book/rug">
        <button
          className="flex items-center gap-[8px] rounded-full px-[16px] py-[9px] text-[13px] font-extrabold text-white transition-colors duration-150 hover:bg-[#0a1a6b]"
          style={{ background: "#000b49" }}
        >
          + New booking
        </button>
      </Link>
    </div>
  );

  // ─── Static schedule (replace with real data when API ready) ─────────────
  const schedule = [
    { time: "08:00", client: "Nomsa Khumalo", detail: "Sandton · 3 rugs · delivery", tag: "Delivery", variant: "status-delivering" as const, tech: "T. Mokoena", accent: "#2c4fa6" },
    { time: "09:30", client: "Ridwaan Patel", detail: "Fourways · 2 rugs · collection", tag: "Collect", variant: "status-new" as const, tech: "T. Mokoena", accent: "#ffdc39" },
    { time: "11:00", client: "Anke van Wyk", detail: "Randburg · couch + 1 rug", tag: "Collect", variant: "status-new" as const, tech: "S. Dube", accent: "#ffdc39" },
    { time: "13:15", client: "Sipho Ndlovu", detail: "Midrand · 4 rugs · delivery", tag: "Delivery", variant: "status-delivering" as const, tech: "S. Dube", accent: "#2c4fa6" },
    { time: "15:00", client: "Claire Bester", detail: "Bryanston · 1 Persian rug", tag: "Late", variant: "status-overdue" as const, tech: "Unassigned", accent: "#b3261e" },
  ];

  const alerts = [
    { title: "SC-2390 delivery missed twice", meta: "Bryanston · client unreachable", dot: "#b3261e" },
    { title: "Cape Town van service due", meta: "CA 442-118 · 2 Sep", dot: "#ffdc39" },
    { title: "3 bookings unassigned tomorrow", meta: "Gauteng morning slots", dot: "#ffdc39" },
  ];

  const capacityTotal = 48;
  const capacityFilled = 34;
  const capacityOpen = capacityTotal - capacityFilled;
  const capacityPct = Math.round((capacityFilled / capacityTotal) * 100);

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={sidebar}
      sidebarFooter={<AdminUserFooter />}
      pageTitle="Overview"
      topbarActions={topbarActions}
    >
      <div className="portal-page flex flex-col gap-[18px]">

        {/* ── KPI row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
          <StatTile label="BOOKINGS TODAY" value={todaysPickups || 18} delta="+4 vs yesterday" />
          <StatTile label="IN CLEANING" value={activeJobs || 41} delta="across 2 facilities" deltaColor="#9aa0a6" />
          <StatTile
            label="REVENUE THIS WEEK"
            value={revenue > 0 ? `R${revenue.toLocaleString()}` : "R84 200"}
            delta="+12% vs last week"
          />
          <StatTile
            label="LATE DELIVERIES"
            value={lateCount || 2}
            delta="needs rescheduling"
            deltaColor="#b3261e"
          />
        </div>

        {/* ── Main 2-col layout ─────────────────────────────────────────── */}
        <div className="flex gap-[18px] items-start">

          {/* Left: map + schedule ─────────────────────────────────────── */}
          <div className="flex flex-1 flex-col gap-[18px] min-w-0">

            {/* Live route map */}
            <div className="ds-card p-0 overflow-hidden">
              <div className="ds-card-header">
                <span className="text-card-title" style={{ color: "#000b49" }}>Live route map</span>
                <button className="ds-text-action">Open dispatch</button>
              </div>
              {/* Map placeholder — replace iframe src with real map provider */}
              <div
                className="relative w-full"
                style={{ height: 340, background: "#eef1f5" }}
              >
                <iframe
                  src="/map-admin.html"
                  title="Live route map"
                  className="absolute inset-0 size-full border-0"
                />
              </div>
            </div>

            {/* Today's schedule */}
            <div className="ds-card p-0 overflow-hidden">
              <div className="ds-card-header">
                <span className="text-card-title" style={{ color: "#000b49" }}>Today&apos;s schedule</span>
                <button className="ds-text-action">Full calendar</button>
              </div>
              <div>
                {schedule.map((stop, i) => (
                  <div
                    key={stop.time}
                    className="flex items-center gap-[14px] px-[22px] py-[14px]"
                    style={{ borderBottom: i < schedule.length - 1 ? "1px solid #f0f2f6" : undefined }}
                  >
                    {/* Time */}
                    <div className="w-[44px] flex-none">
                      <div className="tabular text-[14px] font-extrabold" style={{ color: "#000b49" }}>
                        {stop.time}
                      </div>
                    </div>
                    {/* Colour bar */}
                    <div
                      className="w-[3px] min-h-[36px] flex-none self-stretch rounded-full"
                      style={{ background: stop.accent }}
                    />
                    {/* Client + detail */}
                    <div className="flex-1 min-w-0">
                      <div className="text-body truncate" style={{ color: "#000b49" }}>{stop.client}</div>
                      <div className="text-meta mt-[3px] truncate" style={{ color: "#9aa0a6" }}>{stop.detail}</div>
                    </div>
                    {/* Tag */}
                    <Badge variant={stop.variant} className="flex-none">{stop.tag}</Badge>
                    {/* Tech */}
                    <div className="w-[90px] flex-none text-right text-meta" style={{ color: "#9aa0a6" }}>
                      {stop.tech}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bookings — inside left column */}
            <div className="ds-card p-0 overflow-hidden">
              <div className="ds-card-header">
                <span className="text-card-title" style={{ color: "#000b49" }}>Recent Bookings</span>
                <Link href="/admin/bookings"><button className="ds-text-action">View all</button></Link>
              </div>
              <div
                className="grid px-[22px] py-[14px]"
                style={{
                  gridTemplateColumns: "110px 1fr 120px 100px 70px",
                  background: "#f7f9fb",
                  borderBottom: "1px solid #f0f2f6",
                }}
              >
                {["ID", "Customer", "Date", "Status", ""].map((h) => (
                  <div key={h} className="text-th">{h}</div>
                ))}
              </div>
              {bookings.slice(0, 5).map((booking) => (
                <div
                  key={booking.id}
                  className="grid cursor-pointer px-[22px] py-[14px] transition-colors duration-150 hover:bg-[#f7f9fb]"
                  style={{
                    gridTemplateColumns: "110px 1fr 120px 100px 70px",
                    borderBottom: "1px solid #f0f2f6",
                    alignItems: "center",
                  }}
                  onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                >
                  <div className="text-body tabular" style={{ color: "#000b49" }}>{booking.id}</div>
                  <div>
                    <div className="text-body truncate" style={{ color: "#000b49" }}>{booking.customer.name}</div>
                    <div className="text-meta mt-[2px]" style={{ color: "#9aa0a6" }}>{booking.suburb}</div>
                  </div>
                  <div>
                    <div className="text-body" style={{ color: "#32373c" }}>
                      {format(new Date(booking.collectionDate), "MMM d")}
                    </div>
                    <div className="text-meta" style={{ color: "#9aa0a6" }}>
                      {booking.collectionSlot === "MORNING" ? "AM" : "PM"}
                    </div>
                  </div>
                  <div><Badge variant={statusVariant(booking.status)}>{booking.status}</Badge></div>
                  <div className="flex justify-end">
                    <button className="ds-text-action">View →</button>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
                  No bookings yet.
                </div>
              )}
            </div>

          </div>

          {/* Right: alerts + capacity ─────────────────────────────────── */}
          <div className="flex w-[248px] flex-none flex-col gap-[14px]">

            {/* Needs attention */}
            <div className="ds-card p-0 overflow-hidden">
              <div className="px-[20px] py-[16px]" style={{ borderBottom: "1px solid #f0f2f6" }}>
                <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>NEEDS ATTENTION</div>
              </div>
              <div className="flex flex-col">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-[12px] px-[20px] py-[14px]"
                    style={{ borderBottom: i < alerts.length - 1 ? "1px solid #f0f2f6" : undefined }}
                  >
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: alert.dot }}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        {alert.title}
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>{alert.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Capacity today — navy panel */}
            <div className="ds-panel-navy">
              <div className="text-eyebrow" style={{ color: "#6cf3d5" }}>CAPACITY TODAY</div>
              <div
                className="tabular mt-[10px]"
                style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}
              >
                {capacityFilled} / {capacityTotal} slots
              </div>
              {/* Progress bar */}
              <div className="mt-[14px] h-[7px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.15)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${capacityPct}%`, background: "#6cf3d5" }}
                />
              </div>
              <div className="text-meta mt-[10px]" style={{ color: "rgba(255,255,255,.55)" }}>
                {capacityOpen} slots open across Gauteng
              </div>
            </div>

          </div>
        </div>


      </div>
    </PortalLayout>
  );
}
