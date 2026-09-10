"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBookingStore } from "@/store/useBookingStore";
import { Badge } from "@/components/ui/badge";
import { AccessDeniedBanner } from "@/components/auth/AccessDeniedBanner";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { format } from "date-fns";
import type { OpsAlert } from "@/types/opsAlert";

const HIGH_VOLUME_THRESHOLD = 5;
const ALERT_POLL_MS = 12_000;

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

function isUnassigned(assignedDriverId?: string) {
  return !assignedDriverId;
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { bookings, fetchBookings } = useBookingStore();
  const [opsAlerts, setOpsAlerts] = useState<OpsAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const knownAlertIdsRef = useRef<Set<string> | null>(null);

  const loadAlerts = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setAlertsLoading(true);
    try {
      const res = await fetch("/api/admin/alerts", { credentials: "include" });
      if (!res.ok) {
        if (!silent) setOpsAlerts([]);
        return;
      }
      const data = await res.json();
      const next: OpsAlert[] = Array.isArray(data.alerts) ? data.alerts : [];

      // First load: seed known ids quietly (no toast flood for backlog).
      // Later polls: toast only for newly appeared NEW_BOOKING alerts.
      if (knownAlertIdsRef.current === null) {
        knownAlertIdsRef.current = new Set(next.map((a) => a.id));
      } else {
        for (const alert of next) {
          if (!knownAlertIdsRef.current.has(alert.id)) {
            knownAlertIdsRef.current.add(alert.id);
            toast.message(alert.title, {
              description: `${alert.meta} — see Needs Attention`,
            });
          }
        }
        // Drop ids that were dismissed so re-creates can toast again if ever needed
        const live = new Set(next.map((a) => a.id));
        for (const id of [...knownAlertIdsRef.current]) {
          if (!live.has(id)) knownAlertIdsRef.current.delete(id);
        }
      }

      setOpsAlerts(next);
    } catch {
      if (!silent) setOpsAlerts([]);
    } finally {
      if (!silent) setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBookings();
    void loadAlerts();
  }, [fetchBookings, loadAlerts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadAlerts({ silent: true });
      void fetchBookings({ silent: true });
    }, ALERT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadAlerts, fetchBookings]);

  const today = new Date().toISOString().split("T")[0];
  const todaysPickups = bookings.filter(
    (b) => b.collectionDate.startsWith(today) && b.status === "SCHEDULED"
  ).length;
  const activeJobs = bookings.filter((b) =>
    ["COLLECTED", "CLEANING", "DRYING", "READY"].includes(b.status)
  ).length;
  const unpaidCount = bookings.filter((b) => b.paymentStatus === "UNPAID").length;
  const unassignedTodayCount = bookings.filter(
    (b) =>
      b.collectionDate.startsWith(today) &&
      isUnassigned(b.assignedDriverId) &&
      b.status !== "CANCELLED" &&
      b.status !== "DELIVERED"
  ).length;
  const revenue = bookings.reduce(
    (acc, b) => acc + (b.estimatedPriceMin + b.estimatedPriceMax) / 2,
    0
  );
  const lateCount = 2; // placeholder until LATE/OVERDUE statuses are added to the type
  const showHighVolume = activeJobs > HIGH_VOLUME_THRESHOLD;
  const hasActionable =
    unpaidCount > 0 || unassignedTodayCount > 0 || opsAlerts.length > 0;
  const showEmpty = !alertsLoading && !hasActionable && !showHighVolume;

  const dismissAlert = async (alertId: string) => {
    const prev = opsAlerts;
    setOpsAlerts((list) => list.filter((a) => a.id !== alertId));
    try {
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      if (!res.ok) setOpsAlerts(prev);
    } catch {
      setOpsAlerts(prev);
    }
  };

  // ─── Static schedule (replace with real data when API ready) ─────────────
  const schedule = [
    { time: "08:00", client: "Nomsa Khumalo", detail: "Sandton · 3 rugs · delivery", tag: "Delivery", variant: "status-delivering" as const, tech: "T. Mokoena", accent: "#2c4fa6" },
    { time: "09:30", client: "Ridwaan Patel", detail: "Fourways · 2 rugs · collection", tag: "Collect", variant: "status-new" as const, tech: "T. Mokoena", accent: "#ffdc39" },
    { time: "11:00", client: "Anke van Wyk", detail: "Randburg · couch + 1 rug", tag: "Collect", variant: "status-new" as const, tech: "S. Dube", accent: "#ffdc39" },
    { time: "13:15", client: "Sipho Ndlovu", detail: "Midrand · 4 rugs · delivery", tag: "Delivery", variant: "status-delivering" as const, tech: "S. Dube", accent: "#2c4fa6" },
    { time: "15:00", client: "Claire Bester", detail: "Bryanston · 1 Persian rug", tag: "Late", variant: "status-overdue" as const, tech: "Unassigned", accent: "#b3261e" },
  ];

  const capacityTotal = 48;
  const capacityFilled = 34;
  const capacityOpen = capacityTotal - capacityFilled;
  const capacityPct = Math.round((capacityFilled / capacityTotal) * 100);

  return (
    <AdminPortalShell
      pageTitle="Overview"
      active="overview"
      bookingsBadge={bookings.length || undefined}
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <Suspense fallback={null}>
          <AccessDeniedBanner />
        </Suspense>

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
                    <div className="w-[44px] flex-none">
                      <div className="tabular text-[14px] font-extrabold" style={{ color: "#000b49" }}>
                        {stop.time}
                      </div>
                    </div>
                    <div
                      className="w-[3px] min-h-[36px] flex-none self-stretch rounded-full"
                      style={{ background: stop.accent }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-body truncate" style={{ color: "#000b49" }}>{stop.client}</div>
                      <div className="text-meta mt-[3px] truncate" style={{ color: "#9aa0a6" }}>{stop.detail}</div>
                    </div>
                    <Badge variant={stop.variant} className="flex-none">{stop.tag}</Badge>
                    <div className="w-[90px] flex-none text-right text-meta" style={{ color: "#9aa0a6" }}>
                      {stop.tech}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bookings */}
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
                  <div key={h || "actions"} className="text-th">{h}</div>
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

          {/* Right: alerts + capacity */}
          <div className="flex w-[280px] flex-none flex-col gap-[14px]">

            <div className="ds-card p-0 overflow-hidden">
              <div className="px-[20px] py-[16px]" style={{ borderBottom: "1px solid #f0f2f6" }}>
                <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>NEEDS ATTENTION</div>
              </div>
              <div className="flex flex-col">
                {showEmpty ? (
                  <div className="px-[20px] py-[18px]">
                    <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                      You&apos;re clear
                    </div>
                    <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                      No unpaid or unassigned work
                    </div>
                  </div>
                ) : null}

                {unpaidCount > 0 ? (
                  <div
                    className="flex items-start gap-[12px] px-[20px] py-[14px]"
                    style={{ borderBottom: "1px solid #f0f2f6" }}
                  >
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: "#b3261e" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        {unpaidCount} unpaid booking{unpaidCount === 1 ? "" : "s"}
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                        Follow up on payment
                      </div>
                    </div>
                    <Link
                      href="/admin/bookings?payment=UNPAID"
                      className="ds-text-action flex-none self-center"
                    >
                      View
                    </Link>
                  </div>
                ) : null}

                {unassignedTodayCount > 0 ? (
                  <div
                    className="flex items-start gap-[12px] px-[20px] py-[14px]"
                    style={{ borderBottom: "1px solid #f0f2f6" }}
                  >
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: "#ffdc39" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        {unassignedTodayCount} unassigned today
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                        Collections need a driver
                      </div>
                    </div>
                    {/* F4.4 board not shipped — agreed unassigned-today list */}
                    <Link
                      href="/admin/bookings?date=today&assigned=0"
                      className="ds-text-action flex-none self-center"
                    >
                      Assign
                    </Link>
                  </div>
                ) : null}

                {opsAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-[12px] px-[20px] py-[14px]"
                    style={{ borderBottom: "1px solid #f0f2f6" }}
                  >
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: "#2c4fa6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        {alert.title}
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                        {alert.meta}
                      </div>
                      <div className="mt-[8px] flex flex-wrap gap-[10px]">
                        <Link
                          href={`/admin/bookings/${alert.bookingId}`}
                          className="ds-text-action"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="ds-text-action"
                          onClick={() => void dismissAlert(alert.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {showHighVolume ? (
                  <div className="flex items-start gap-[12px] px-[20px] py-[14px]">
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: "#0a7a63" }}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        High volume
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                        {activeJobs} active jobs — consider capacity
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ds-panel-navy">
              <div className="text-eyebrow" style={{ color: "#6cf3d5" }}>CAPACITY TODAY</div>
              <div
                className="tabular mt-[10px]"
                style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}
              >
                {capacityFilled} / {capacityTotal} slots
              </div>
              <div
                className="mt-[12px] h-[6px] w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,.12)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${capacityPct}%`, background: "#6cf3d5" }}
                />
              </div>
              <div className="text-meta mt-[10px]" style={{ color: "rgba(255,255,255,.55)" }}>
                {capacityOpen} open · {capacityPct}% filled
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
