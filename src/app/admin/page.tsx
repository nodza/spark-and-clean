"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AccessDeniedBanner } from "@/components/auth/AccessDeniedBanner";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import type { OpsAlert } from "@/types/opsAlert";
import { formatBookingCollection } from "@/lib/localCalendarDate";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import { formatAssignedDriverLine } from "@/lib/vehicle";
import type { Driver } from "@/types/booking";

const ALERT_POLL_MS = 12_000;

// ─── KPI stat tile ───────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
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
    </div>
  );
}

type AdminMetrics = {
  totalBookings: number;
  scheduledToday: number;
  activeJobs: number;
  unpaidBookings: number;
  unassignedToday: number;
  revenueThisWeekCents: number;
  revenueByDay: { date: string; amountCents: number }[];
  todayJobs: TodayJob[];
  recentBookings: {
    id: string;
    customer: { name: string };
    suburb: string;
    collectionDate: string;
    collectionSlot: "MORNING" | "AFTERNOON";
    status: string;
  }[];
  readyNeedingDeliveryScheduleCount: number;
  readyNeedingDeliverySchedule: {
    id: string;
    customer: { name: string };
  }[];
};

type TodayJob = {
  id: string;
  collectionDate: string;
  collectionSlot: "MORNING" | "AFTERNOON";
  status: string;
  customer: { name: string };
  suburb: string;
  rug: { type: string };
  assignedDriverId?: string;
};

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
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [opsAlerts, setOpsAlerts] = useState<OpsAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversStatus, setDriversStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const knownAlertIdsRef = useRef<Set<string> | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/metrics", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not load admin metrics");
      const data = (await response.json()) as AdminMetrics;
      setMetrics(data);
      setMetricsError(false);
    } catch {
      setMetrics(null);
      setMetricsError(true);
    }
  }, []);

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
    void loadMetrics();
    void loadAlerts();
    void fetch("/api/drivers", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          setDrivers([]);
          setDriversStatus("unavailable");
          return;
        }
        if (!r.ok) {
          setDrivers([]);
          setDriversStatus("unavailable");
          return;
        }
        const data = await r.json().catch(() => null);
        if (Array.isArray(data)) {
          setDrivers(data);
          setDriversStatus("ready");
          return;
        }
        setDrivers([]);
        setDriversStatus("unavailable");
      })
      .catch(() => {
        setDrivers([]);
        setDriversStatus("unavailable");
      });
  }, [loadAlerts, loadMetrics]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadAlerts({ silent: true });
      void loadMetrics();
    }, ALERT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadAlerts, loadMetrics]);

  const activeJobs = metrics?.activeJobs ?? 0;
  const unpaidCount = metrics?.unpaidBookings ?? 0;
  const unassignedTodayCount = metrics?.unassignedToday ?? 0;
  const todayJobs = metrics?.todayJobs ?? [];
  const recentBookings = metrics?.recentBookings ?? [];
  const toScheduleCount = metrics?.readyNeedingDeliveryScheduleCount ?? 0;
  const toScheduleDeliveries = metrics?.readyNeedingDeliverySchedule ?? [];

  const driverLine = (job: TodayJob) => {
    if (isUnassignedDriver(job.assignedDriverId)) return "Unassigned";
    if (driversStatus === "unavailable") return "Driver details unavailable";
    const driver = drivers.find((d) => d.id === job.assignedDriverId);
    if (!driver) return "Assigned driver";
    return formatAssignedDriverLine(driver.name, driver.vehicle);
  };

  const jobTag = (status: string) => {
    const s = status.toUpperCase();
    if (s === "COLLECTED") return { tag: "Collected", variant: "status-collected" as const, accent: "#2c4fa6" };
    if (s === "DELIVERED") return { tag: "Delivery", variant: "status-delivering" as const, accent: "#2c4fa6" };
    if (s === "CLEANING" || s === "DRYING" || s === "READY") {
      return { tag: "Cleaning", variant: "status-cleaning" as const, accent: "#0a7a63" };
    }
    return { tag: "Collect", variant: "status-new" as const, accent: "#ffdc39" };
  };

  const hasActionable =
    unpaidCount > 0 ||
    unassignedTodayCount > 0 ||
    toScheduleCount > 0 ||
    opsAlerts.length > 0;
  const attentionReady = !alertsLoading && metrics !== null;
  const showAttentionLoading =
    !metricsError && !attentionReady && !hasActionable;
  const showEmpty = attentionReady && !hasActionable;

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
      if (!res.ok) {
        setOpsAlerts(prev);
        toast.error("Could not dismiss alert");
        return;
      }
    } catch {
      setOpsAlerts(prev);
      toast.error("Could not dismiss alert");
    }
  };

  return (
    <AdminPortalShell
      pageTitle="Overview"
      active="overview"
      bookingsBadge={metrics?.totalBookings || undefined}
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <Suspense fallback={null}>
          <AccessDeniedBanner />
        </Suspense>

        {/* ── KPI row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-3">
          <StatTile
            label="BOOKINGS TODAY"
            value={metrics ? metrics.scheduledToday : "—"}
          />
          <StatTile label="IN CLEANING" value={metrics ? activeJobs : "—"} />
          <StatTile
            label="REVENUE THIS WEEK"
            value={
              metrics
                ? `R${(metrics.revenueThisWeekCents / 100).toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "—"
            }
          />
        </div>
        {metricsError ? (
          <p role="status" className="text-sm text-red-700">
            Dashboard metrics are currently unavailable.
          </p>
        ) : null}

        {/* ── Main 2-col layout ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-[18px] items-stretch xl:flex-row xl:items-start">

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
                {metrics === null && !metricsError ? (
                  <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
                    Loading today&apos;s schedule…
                  </div>
                ) : metricsError ? (
                  <div role="status" className="px-[22px] py-[40px] text-center text-meta text-red-700">
                    Today&apos;s schedule is currently unavailable.
                  </div>
                ) : todayJobs.length === 0 ? (
                  <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
                    No jobs scheduled today.
                  </div>
                ) : (
                  todayJobs.map((job, i) => {
                    const meta = jobTag(job.status);
                    const period = job.collectionSlot === "MORNING" ? "AM" : "PM";
                    const tech = driverLine(job);
                    return (
                      <Link
                        key={job.id}
                        href={`/admin/bookings/${job.id}`}
                        className="flex items-center gap-[14px] px-[22px] py-[14px] no-underline hover:bg-[#f7f9fb]"
                        style={{ borderBottom: i < todayJobs.length - 1 ? "1px solid #f0f2f6" : undefined }}
                      >
                        <div className="w-[44px] flex-none">
                          <div className="tabular text-[14px] font-extrabold" style={{ color: "#000b49" }}>
                            {period}
                          </div>
                        </div>
                        <div
                          className="w-[3px] min-h-[36px] flex-none self-stretch rounded-full"
                          style={{ background: meta.accent }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-body truncate" style={{ color: "#000b49" }}>
                            {job.customer.name}
                          </div>
                          <div className="text-meta mt-[3px] truncate" style={{ color: "#9aa0a6" }}>
                            {job.suburb} · {job.rug.type}
                          </div>
                        </div>
                        <Badge variant={meta.variant} className="flex-none">{meta.tag}</Badge>
                        <div
                          className="w-[168px] flex-none truncate text-right text-meta"
                          style={{ color: "#9aa0a6" }}
                          title={tech}
                        >
                          {tech}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="ds-card p-0 overflow-hidden">
              <div className="ds-card-header">
                <span className="text-card-title" style={{ color: "#000b49" }}>Recent Bookings</span>
                <Link href="/admin/bookings" className="ds-text-action">
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div
                    className="grid px-[22px] py-[14px]"
                    style={{
                      gridTemplateColumns: "110px 1fr 120px 100px",
                      background: "#f7f9fb",
                      borderBottom: "1px solid #f0f2f6",
                    }}
                  >
                    {["ID", "Customer", "Date", "Status"].map((h) => (
                      <div key={h} className="text-th">{h}</div>
                    ))}
                  </div>
                  {recentBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/admin/bookings/${booking.id}`}
                      className="group grid px-[22px] py-[14px] no-underline transition-colors duration-150 hover:bg-[#f7f9fb]"
                      style={{
                        gridTemplateColumns: "110px 1fr 120px 100px",
                        borderBottom: "1px solid #f0f2f6",
                        alignItems: "center",
                      }}
                    >
                      <div
                        className="text-body tabular underline-offset-2 group-hover:underline"
                        style={{ color: "#0a7a63" }}
                        title={booking.id}
                      >
                        {booking.id}
                      </div>
                      <div>
                        <div className="text-body truncate" style={{ color: "#000b49" }}>{booking.customer.name}</div>
                        <div className="text-meta mt-[2px]" style={{ color: "#9aa0a6" }}>{booking.suburb}</div>
                      </div>
                      <div>
                        <div className="text-body" style={{ color: "#32373c" }}>
                          {formatBookingCollection(booking.collectionDate, "MMM d")}
                        </div>
                        <div className="text-meta" style={{ color: "#9aa0a6" }}>
                          {booking.collectionSlot === "MORNING" ? "AM" : "PM"}
                        </div>
                      </div>
                      <div><Badge variant={statusVariant(booking.status)}>{booking.status}</Badge></div>
                    </Link>
                  ))}
                </div>
              </div>
              {metrics === null && !metricsError ? (
                <div className="px-[22px] py-[30px] text-center text-meta" style={{ color: "#9aa0a6" }}>
                  Loading bookings…
                </div>
              ) : metrics !== null && recentBookings.length === 0 ? (
                <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
                  No bookings yet.
                </div>
              ) : null}
            </div>

          </div>

          {/* Right: alerts */}
          <div className="flex w-full flex-none flex-col gap-[14px] xl:w-[280px]">

            <div className="ds-card p-0 overflow-hidden">
              <div className="px-[20px] py-[16px]" style={{ borderBottom: "1px solid #f0f2f6" }}>
                <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>NEEDS ATTENTION</div>
              </div>
              <div className="flex flex-col">
                {showAttentionLoading ? (
                  <div className="px-[20px] py-[18px]">
                    <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                      Checking…
                    </div>
                    <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                      Loading unpaid, unassigned, and delivery work
                    </div>
                  </div>
                ) : null}

                {showEmpty ? (
                  <div className="px-[20px] py-[18px]">
                    <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                      You&apos;re clear
                    </div>
                    <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                      No unpaid, unassigned, or unscheduled delivery work
                    </div>
                  </div>
                ) : null}

                {metricsError ? (
                  <div className="px-[20px] py-[18px]">
                    <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                      Metrics unavailable
                    </div>
                    <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                      Could not load unpaid, unassigned, or delivery work
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
                    <Link
                      href="/admin/assignments"
                      className="ds-text-action flex-none self-center"
                    >
                      Assign
                    </Link>
                  </div>
                ) : null}

                {toScheduleCount > 0 ? (
                  <div
                    className="flex items-start gap-[12px] px-[20px] py-[14px]"
                    style={{ borderBottom: "1px solid #f0f2f6" }}
                  >
                    <div
                      className="mt-[5px] size-[8px] flex-none rounded-full"
                      style={{ background: "#2c4fa6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-[1.35]" style={{ color: "#000b49" }}>
                        {toScheduleCount} ready to schedule
                      </div>
                      <div className="text-meta mt-[3px]" style={{ color: "#9aa0a6" }}>
                        READY rugs need a delivery date
                      </div>
                      <ul className="mt-[8px] flex flex-col gap-[6px]">
                        {toScheduleDeliveries.slice(0, 5).map((booking) => (
                          <li key={booking.id}>
                            <Link
                              href={`/admin/bookings/${booking.id}`}
                              className="ds-text-action text-[12.5px]"
                            >
                              {booking.id} · {booking.customer.name}
                            </Link>
                          </li>
                        ))}
                        {toScheduleCount > 5 ? (
                          <li className="text-meta" style={{ color: "#9aa0a6" }}>
                            +{toScheduleCount - 5} more
                          </li>
                        ) : null}
                      </ul>
                    </div>
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

              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
