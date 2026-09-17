"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Navigation,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import {
  formatBadgeDate,
  rugSummary,
  slotTimeLabel,
  techStopKind,
  techTagClass,
  techTagLabel,
} from "@/lib/techUi";
import { useBookingStore } from "@/store/useBookingStore";
import { useBookingLiveTracking } from "@/hooks/useBookingLiveTracking";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; booking: Booking }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

function mapsUrl(booking: Booking): string {
  const query = encodeURIComponent(
    [booking.addressLine1, booking.suburb, booking.city].filter(Boolean).join(", ")
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function telHref(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function TechJobDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const { fetchBookingById, updateBookingStatus } = useBookingStore();
  const storeBooking = useBookingStore((s) =>
    s.bookings.find((b) => b.id === id)
  );

  const [loadState, setLoadState] = useState<LoadState>({ kind: "idle" });
  const [pendingStatus, setPendingStatus] = useState<
    "COLLECTED" | "DELIVERED" | null
  >(null);

  // Poll API so status stays live without a hard refresh
  useBookingLiveTracking(id, ready && !!user?.driverProfileId);

  const loadJob = useCallback(async () => {
    if (!ready || !user?.driverProfileId || !id) return;

    setLoadState({ kind: "loading" });
    try {
      const booking = await fetchBookingById(id);
      if (!booking) {
        setLoadState({ kind: "not_found" });
        return;
      }
      if (booking.assignedDriverId !== user.driverProfileId) {
        setLoadState({ kind: "forbidden" });
        return;
      }
      setLoadState({ kind: "ready", booking });
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: number }).status)
          : 0;
      if (status === 403 || status === 401) {
        setLoadState({ kind: "forbidden" });
        return;
      }
      setLoadState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not load this job",
      });
    }
  }, [fetchBookingById, id, ready, user?.driverProfileId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  // Reflect live store updates (poll / optimistic PATCH) into the detail UI
  useEffect(() => {
    if (!storeBooking || !user?.driverProfileId) return;
    if (storeBooking.assignedDriverId !== user.driverProfileId) {
      setLoadState({ kind: "forbidden" });
      return;
    }
    setLoadState((prev) => {
      if (prev.kind === "ready" && prev.booking.id === storeBooking.id) {
        if (
          prev.booking.status === storeBooking.status &&
          prev.booking === storeBooking
        ) {
          return prev;
        }
        return { kind: "ready", booking: storeBooking };
      }
      if (prev.kind === "loading" || prev.kind === "idle") {
        return { kind: "ready", booking: storeBooking };
      }
      return prev;
    });
  }, [storeBooking, user?.driverProfileId]);

  const handleStatusUpdate = async (newStatus: "COLLECTED" | "DELIVERED") => {
    if (loadState.kind !== "ready" || pendingStatus) return;
    const bookingId = loadState.booking.id;
    const previous = loadState.booking;

    setPendingStatus(newStatus);
    setLoadState({
      kind: "ready",
      booking: { ...previous, status: newStatus },
    });

    const error = await updateBookingStatus(bookingId, newStatus);
    setPendingStatus(null);

    if (error) {
      toast.error(error);
      setLoadState({ kind: "ready", booking: previous });
      return;
    }

    toast.success(
      newStatus === "COLLECTED"
        ? "Marked collected — status saved"
        : "Marked delivered — status saved"
    );
    router.push("/tech/dashboard");
  };

  const showJob = loadState.kind === "ready";

  return (
    <TechAppShell activeTab="job">
      <button
        type="button"
        onClick={() => router.push("/tech/dashboard")}
        className="mb-3.5 inline-block text-[13px] font-bold text-[#0a7a63] hover:text-navy"
      >
        ← Today
      </button>

      {loadState.kind === "idle" ||
      loadState.kind === "loading" ||
      !ready ||
      !user ? (
        <JobLoadingState />
      ) : null}

      {loadState.kind === "forbidden" ? (
        <JobBlockedState
          title="Not your job"
          description="This booking is assigned to another technician. You can only open jobs on your route."
          icon={<ShieldAlert className="size-6 text-destructive" />}
        />
      ) : null}

      {loadState.kind === "not_found" ? (
        <JobBlockedState
          title="Job not found"
          description="We couldn’t find this booking, or it is no longer on your list."
          icon={<AlertCircle className="size-6 text-[#9aa0a6]" />}
        />
      ) : null}

      {loadState.kind === "error" ? (
        <JobBlockedState
          title="Couldn’t load job"
          description={loadState.message}
          icon={<AlertCircle className="size-6 text-[#9aa0a6]" />}
          action={
            <Button type="button" onClick={() => void loadJob()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {showJob ? (
        <JobContent
          booking={loadState.booking}
          pendingStatus={pendingStatus}
          onStatusUpdate={handleStatusUpdate}
        />
      ) : null}
    </TechAppShell>
  );
}

function JobLoadingState() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <div className="h-[220px] animate-pulse rounded-[14px] bg-white" />
      <div className="h-24 animate-pulse rounded-xl bg-white" />
      <span className="sr-only">Loading job details</span>
    </div>
  );
}

function JobBlockedState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#f0f2f6]">
        {icon}
      </div>
      <h1 className="text-lg font-extrabold text-navy">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-[#6b7280]">{description}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {action}
        <Link
          href="/tech/dashboard"
          prefetch={false}
          className="inline-flex h-10 items-center justify-center rounded-md border border-[#e3e7ed] bg-white px-4 text-sm font-medium text-navy hover:bg-[#f5f7fa]"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}

function JobContent({
  booking,
  pendingStatus,
  onStatusUpdate,
}: {
  booking: Booking;
  pendingStatus: "COLLECTED" | "DELIVERED" | null;
  onStatusUpdate: (status: "COLLECTED" | "DELIVERED") => void;
}) {
  const phoneHref = telHref(booking.customer.phone);
  const busy = pendingStatus !== null;
  const kind = techStopKind(booking.status);
  const canCollect =
    booking.status === "SCHEDULED" || pendingStatus === "COLLECTED";
  const canDeliver =
    booking.status === "READY" || pendingStatus === "DELIVERED";

  return (
    <div className="pb-2">
      <section className="overflow-hidden rounded-[14px] border border-[#e3e7ed] bg-white">
        <div className="p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#9aa0a6]">
                {booking.id} ·{" "}
                {booking.status === "READY" ? "DELIVERY" : "COLLECTION"}
              </div>
              <h1 className="mt-1.5 text-xl font-extrabold text-navy">
                {booking.customer.name}
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-[#6b7280]">
                {formatBadgeDate(booking.collectionDate)}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-extrabold",
                  techTagClass(kind)
                )}
              >
                {slotTimeLabel(booking.collectionSlot)}
              </span>
            </div>
          </div>

          <div className="my-4 h-px bg-[#f0f2f6]" />

          <p className="text-sm leading-relaxed text-[#32373c]">
            {booking.addressLine1}
            <br />
            {booking.suburb}
            {booking.city ? `, ${booking.city}` : null}
          </p>

          <div className="mt-4 flex gap-2">
            <a
              href={mapsUrl(booking)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-navy text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <Navigation className="size-4" aria-hidden />
              Navigate
            </a>
            {phoneHref ? (
              <a
                href={phoneHref}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#0a7a63] text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                <Phone className="size-4" aria-hidden />
                Call
              </a>
            ) : (
              <span className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[#e3e7ed] text-[12.5px] font-bold text-[#9aa0a6]">
                No phone
              </span>
            )}
          </div>
        </div>
      </section>

      <p className="mb-2.5 mt-[22px] text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
        ITEMS TO COLLECT
      </p>
      <div className="rounded-xl border border-[#e3e7ed] bg-white px-[15px] py-3.5">
        <div className="text-sm font-bold text-navy">{booking.rug.type}</div>
        <div className="mt-1 text-xs text-[#9aa0a6]">{rugSummary(booking)}</div>
        {booking.rug.photos && booking.rug.photos.length > 0 ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto">
            {booking.rug.photos.map((photo, i) => (
              <li key={`${photo}-${i}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`Rug photo ${i + 1}`}
                  className="size-11 rounded-[9px] object-cover"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-[22px]">
        {canCollect ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUpdate("COLLECTED")}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-navy text-[14.5px] font-extrabold text-white transition-colors hover:bg-[#001a6e] active:bg-[#000833] disabled:pointer-events-none disabled:opacity-70"
          >
            {pendingStatus === "COLLECTED" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            {pendingStatus === "COLLECTED" ? "Saving…" : "Mark as collected"}
          </button>
        ) : null}

        {canDeliver ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUpdate("DELIVERED")}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#0a7a63] text-[14.5px] font-extrabold text-white transition-colors hover:bg-[#086b56] active:bg-[#065a48] disabled:pointer-events-none disabled:opacity-70"
          >
            {pendingStatus === "DELIVERED" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden />
            )}
            {pendingStatus === "DELIVERED" ? "Saving…" : "Mark as delivered"}
          </button>
        ) : null}

        {!pendingStatus &&
        ["COLLECTED", "CLEANING", "DRYING"].includes(booking.status) ? (
          <div className="rounded-full border border-[#e3e7ed] bg-white py-3.5 text-center text-sm font-bold text-[#9aa0a6]">
            In progress at depot · {techTagLabel(booking.status)}
          </div>
        ) : null}

        {!pendingStatus && booking.status === "DELIVERED" ? (
          <div className="rounded-full border border-[#bfe9dc] bg-[#eafaf5] py-3.5 text-center text-sm font-bold text-[#0a7a63]">
            Job completed
          </div>
        ) : null}
      </div>
    </div>
  );
}
