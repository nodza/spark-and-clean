"use client";

import { Loader2 } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import { useMemo } from "react";

/** Own completed stops only — live-polled session-scoped bookings. */
export default function TechCompletedPage() {
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const { bookings, loading: isLoading } = useBookingsLiveList(!!ready);

  const driverId = user?.driverProfileId;
  const completed = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!driverId || b.assignedDriverId === driverId) &&
          b.status === "DELIVERED"
      ),
    [bookings, driverId]
  );

  return (
    <TechAppShell activeTab="completed">
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy">
        Completed
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[#6b7280]">
        Delivered jobs on your route.
      </p>

      {isLoading && completed.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-[#9aa0a6]"
          role="status"
        >
          <Loader2 className="size-7 animate-spin text-navy" aria-hidden />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      ) : null}

      {!isLoading && completed.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-12 text-center">
          <p className="font-bold text-navy">No completed stops yet</p>
          <p className="mt-1 text-sm text-[#9aa0a6]">
            Finished deliveries will show here.
          </p>
        </div>
      ) : null}

      {completed.length > 0 ? (
        <ul className="mt-[18px] space-y-2.5">
          {completed.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 rounded-xl border border-[#e3e7ed] bg-white px-[15px] py-3.5"
            >
              <div
                className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#eafaf5] text-[13px] font-extrabold text-[#0a7a63]"
                aria-hidden
              >
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-navy">
                  {job.customer.name}
                </div>
                <div className="mt-1 truncate text-xs text-[#9aa0a6]">
                  {job.id} · {job.suburb} · {job.rug.type}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </TechAppShell>
  );
}
