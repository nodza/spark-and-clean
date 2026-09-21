"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ASSIGNMENT_SLOT_CAPACITY } from "@/config/assignmentBoard";
import {
  ASSIGNMENT_SLOTS,
  buildAssignmentBoard,
  collectionsForAssignmentDay,
  customerSurname,
  type AssignmentBoardDriver,
  type AssignmentBoardJob,
  type AssignmentSlot,
} from "@/lib/assignmentBoard";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  isValidCalendarDate,
  johannesburgCalendarDate,
} from "@/lib/johannesburgDate";
import { useBookingStore } from "@/store/useBookingStore";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

function statusDisplay(status: BookingStatus): {
  label: string;
  variant: React.ComponentProps<typeof Badge>["variant"];
} {
  switch (status) {
    case "BOOKED":
    case "SCHEDULED":
      return { label: "NEW", variant: "status-new" };
    case "COLLECTED":
      return { label: "COLLECTED", variant: "status-collected" };
    default:
      return { label: status, variant: "outline" };
  }
}

function paymentDisplay(status: PaymentStatus): {
  label: string;
  variant: React.ComponentProps<typeof Badge>["variant"];
} {
  if (status === "UNPAID") return { label: "UNPAID", variant: "status-overdue" };
  if (status === "DEPOSIT") return { label: "DEPOSIT", variant: "status-new" };
  return { label: "PAID", variant: "status-cleaning" };
}

function slotLabel(slot: AssignmentSlot) {
  return slot === "MORNING" ? "Morning" : "Afternoon";
}

function matchesAssignmentSearch(
  job: AssignmentBoardJob,
  query: string,
  drivers: AssignmentBoardDriver[]
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const driverLabel = isUnassignedDriver(job.assignedDriverId)
    ? "unassigned"
    : drivers.find((driver) => driver.id === job.assignedDriverId)?.name ??
      job.assignedDriverId ??
      "";
  const haystack = [
    job.id,
    job.customer.name,
    customerSurname(job.customer.name),
    job.customer.phone,
    job.customer.email,
    job.suburb,
    job.status,
    job.paymentStatus,
    driverLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function AssignmentBoardBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bookings, fetchBookings, isLoading, assignDriver } = useBookingStore();
  const [drivers, setDrivers] = useState<AssignmentBoardDriver[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const today = johannesburgCalendarDate();
  const dateParam = searchParams.get("date");
  const selectedDay =
    dateParam && isValidCalendarDate(dateParam) ? dateParam : today;

  const activeDriverIds = useMemo(
    () => new Set(drivers.map((driver) => driver.id)),
    [drivers]
  );

  useEffect(() => {
    void fetchBookings();
    void fetch("/api/drivers", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setDrivers([]);
          return;
        }
        const list: AssignmentBoardDriver[] = data
          .filter(
            (row): row is AssignmentBoardDriver =>
              row &&
              typeof row.id === "string" &&
              row.id.length > 0 &&
              typeof row.name === "string"
          )
          .map((row) => ({ id: row.id, name: row.name.trim() || row.id }));
        list.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setDrivers(list);
      })
      .catch(() => setDrivers([]));
  }, [fetchBookings]);

  const dayJobs = useMemo(
    () => collectionsForAssignmentDay(bookings, selectedDay),
    [bookings, selectedDay]
  );

  const filteredJobs = useMemo(
    () =>
      dayJobs.filter((job) => matchesAssignmentSearch(job, search, drivers)),
    [dayJobs, search, drivers]
  );

  const columns = useMemo(
    () => buildAssignmentBoard(filteredJobs, drivers),
    [filteredJobs, drivers]
  );

  const setDay = (next: string) => {
    if (!isValidCalendarDate(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === today) params.delete("date");
    else params.set("date", next);
    const query = params.toString();
    router.replace(query ? `/admin/assignments?${query}` : "/admin/assignments");
  };

  const handleAssign = async (
    bookingId: string,
    currentDriverId: string | undefined,
    value: string
  ) => {
    const current = currentDriverId || "unassigned";
    if (value === current) return;
    if (assigningId === bookingId) return;
    if (value !== "unassigned" && !drivers.some((driver) => driver.id === value)) {
      return;
    }
    setAssigningId(bookingId);
    try {
      const error = await assignDriver(
        bookingId,
        value === "unassigned" ? null : value
      );
      if (error) toast.error(error);
    } finally {
      setAssigningId(null);
    }
  };

  const showEmpty = !isLoading && dayJobs.length === 0;
  const showNoMatches =
    !isLoading && dayJobs.length > 0 && filteredJobs.length === 0;

  return (
    <AdminPortalShell
      pageTitle="Assignments"
      active="assignments"
      topbarActions={
        <AdminSearchTopbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search id, client, suburb, or driver"
        />
      }
    >
      <div className="portal-page">
        <div className="mb-[18px] flex flex-wrap items-end justify-between gap-[14px]">
          <p className="text-body max-w-[520px]" style={{ color: "#6b7280" }}>
            Collections by driver for the selected date. Assign a job from the
            card without opening the booking.
          </p>
          <label className="flex flex-col gap-[7px]">
            <span className="text-eyebrow" style={{ color: "#6b7280" }}>
              DATE
            </span>
            <Input
              type="date"
              value={selectedDay}
              onChange={(event) => setDay(event.target.value)}
              aria-label="Collection date"
              className="w-[200px] py-[10px]"
            />
          </label>
        </div>

        {isLoading && bookings.length === 0 ? (
          <div className="text-meta" style={{ color: "#9aa0a6" }} role="status">
            Loading assignments…
          </div>
        ) : showEmpty ? (
          <div className="ds-card">
            <p className="text-card-title" style={{ color: "#000b49" }}>
              No collections on this day
            </p>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              BOOKED and SCHEDULED pickups for this date will appear here.
            </p>
          </div>
        ) : showNoMatches ? (
          <div className="ds-card">
            <p className="text-card-title" style={{ color: "#000b49" }}>
              No matches
            </p>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              No collections on this day match “{search.trim()}”.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-[8px]">
            <div className="flex min-w-max items-start gap-[14px]">
              {columns.map((column) => {
                const total =
                  column.slots.MORNING.length + column.slots.AFTERNOON.length;
                const unassigned = column.driverId === null;
                return (
                  <section
                    key={column.key}
                    className="ds-card w-[280px] flex-none p-0"
                    aria-label={column.title}
                  >
                    <div className="ds-card-header">
                      <span
                        className="text-card-title truncate"
                        style={{ color: unassigned ? "#b3261e" : "#000b49" }}
                      >
                        {column.title}
                      </span>
                      <span
                        className="tabular ml-[8px] rounded-full px-[8px] py-[2px] text-[10.5px] font-extrabold"
                        style={{
                          background: unassigned ? "#ffdc39" : "#f0f2f6",
                          color: "#000b49",
                        }}
                      >
                        {total}
                      </span>
                    </div>
                    <div className="flex flex-col gap-[16px] p-[16px]">
                      {ASSIGNMENT_SLOTS.map((slot) => {
                        const jobs = column.slots[slot];
                        const over = column.overCapacity[slot];
                        return (
                          <div key={slot}>
                            <div className="mb-[8px] flex items-center justify-between gap-[8px]">
                              <div
                                className="text-eyebrow"
                                style={{ color: "#9aa0a6" }}
                              >
                                {slotLabel(slot).toUpperCase()}
                              </div>
                              <div
                                className="text-meta tabular"
                                style={{ color: "#9aa0a6" }}
                              >
                                {jobs.length}
                              </div>
                            </div>
                            {over ? (
                              <p
                                className="mb-[8px] text-[12px] font-semibold"
                                style={{ color: "#d64545" }}
                                role="status"
                              >
                                Over capacity ({jobs.length}/{ASSIGNMENT_SLOT_CAPACITY})
                              </p>
                            ) : null}
                            {jobs.length === 0 ? (
                              <p
                                className="text-meta"
                                style={{ color: "#9aa0a6" }}
                              >
                                None
                              </p>
                            ) : (
                              <div className="flex flex-col gap-[10px]">
                                {jobs.map((item) => {
                                  const status = statusDisplay(item.status);
                                  const payment = paymentDisplay(
                                    item.paymentStatus
                                  );
                                  const knownDriver =
                                    !!item.assignedDriverId &&
                                    activeDriverIds.has(item.assignedDriverId);
                                  const inactiveAssignee =
                                    !isUnassignedDriver(item.assignedDriverId) &&
                                    !knownDriver;
                                  const assignValue = knownDriver
                                    ? item.assignedDriverId!
                                    : "unassigned";
                                  return (
                                    <article
                                      key={item.id}
                                      className="rounded-[10px] border border-[#e3e7ed] bg-white p-[14px]"
                                    >
                                      <Link
                                        href={`/admin/bookings/${item.id}`}
                                        className="ds-text-action text-[13px] font-extrabold"
                                      >
                                        {item.id}
                                      </Link>
                                      <p
                                        className="text-card-title mt-[6px]"
                                        style={{ color: "#000b49" }}
                                      >
                                        {customerSurname(item.customer.name)}
                                      </p>
                                      <p
                                        className="text-meta mt-[3px]"
                                        style={{ color: "#9aa0a6" }}
                                      >
                                        {item.suburb}
                                      </p>
                                      <div className="mt-[10px] flex flex-wrap gap-[6px]">
                                        <Badge variant={status.variant}>
                                          {status.label}
                                        </Badge>
                                        <Badge variant={payment.variant}>
                                          {payment.label}
                                        </Badge>
                                        {inactiveAssignee ? (
                                          <Badge
                                            variant="status-overdue"
                                            title="Assigned driver is inactive — reassign or clear"
                                          >
                                            <AlertTriangle
                                              className="size-3"
                                              strokeWidth={2.4}
                                              aria-hidden
                                            />
                                            Inactive
                                          </Badge>
                                        ) : null}
                                      </div>
                                      {inactiveAssignee ? (
                                        <p
                                          className="text-meta mt-[8px]"
                                          style={{ color: "#b33232" }}
                                        >
                                          Still assigned to an inactive driver.
                                          Pick an active driver or Unassigned.
                                        </p>
                                      ) : null}
                                      <label className="mt-[12px] flex flex-col gap-[6px]">
                                        <span
                                          className="text-eyebrow"
                                          style={{ color: "#6b7280" }}
                                        >
                                          ASSIGN
                                        </span>
                                        <Select
                                          value={assignValue}
                                          disabled={assigningId === item.id}
                                          onValueChange={(value) =>
                                            void handleAssign(
                                              item.id,
                                              item.assignedDriverId,
                                              value
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            size="sm"
                                            className="h-9 w-full rounded-[10px] border-[#e3e7ed] bg-white text-[13px] font-semibold text-[#000b49] shadow-none"
                                          >
                                            <SelectValue placeholder="Select driver" />
                                          </SelectTrigger>
                                          <SelectContent className="max-h-72 overflow-y-auto">
                                            <SelectItem value="unassigned">
                                              Unassigned
                                            </SelectItem>
                                            {drivers.map((driver) => (
                                              <SelectItem
                                                key={driver.id}
                                                value={driver.id}
                                              >
                                                {driver.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </label>
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AdminPortalShell>
  );
}

export default function AdminAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <AdminPortalShell pageTitle="Assignments" active="assignments">
          <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
            Loading…
          </div>
        </AdminPortalShell>
      }
    >
      <AssignmentBoardBody />
    </Suspense>
  );
}
