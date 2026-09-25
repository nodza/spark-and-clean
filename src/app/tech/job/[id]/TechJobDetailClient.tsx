"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  bookingAddOnLabels,
  formatBadgeDate,
  isDisplayablePhotoUrl,
  paymentBadgeClass,
  rugDimensionLabel,
  slotTimeLabel,
  slotWindowLabel,
  techStopKind,
  techTagClass,
  techTagLabel,
} from "@/lib/techUi";
import { useBookingStore } from "@/store/useBookingStore";
import { useBookingLiveTracking } from "@/hooks/useBookingLiveTracking";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/phone";
import { FieldMessagesPanel } from "@/components/booking/FieldMessagesPanel";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; booking: Booking }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

function mapsUrl(booking: Booking): string {
  if (
    booking.coordinates &&
    Number.isFinite(booking.coordinates.lat) &&
    Number.isFinite(booking.coordinates.lng)
  ) {
    const query = `${booking.coordinates.lat},${booking.coordinates.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  const query = encodeURIComponent(
    [booking.addressLine1, booking.suburb, booking.city].filter(Boolean).join(", ")
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function TechJobDetailClient() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "";
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const { fetchBookingById, updateBookingStatus } = useBookingStore();
  const storeBooking = useBookingStore((s) =>
    s.bookings.find((b) => b.id === id)
  );

  const [loadState, setLoadState] = useState<LoadState>({ kind: "idle" });
  const [pendingStatus, setPendingStatus] = useState<
    "COLLECTED" | "DELIVERED" | null
  >(null);
  const [trackedId, setTrackedId] = useState(id);
  const loadSeq = useRef(0);
  if (id !== trackedId) {
    loadSeq.current += 1;
    setTrackedId(id);
    setLoadState({ kind: id ? "loading" : "not_found" });
  }

  // Poll API so status stays live without a hard refresh
  const tracking = useBookingLiveTracking(
    id,
    ready && !!user?.driverProfileId && !!id
  );

  const loadJob = useCallback(async () => {
    if (!ready || !user) return;

    if (!id) {
      setLoadState({ kind: "not_found" });
      return;
    }

    if (!user.driverProfileId) {
      setLoadState({ kind: "forbidden" });
      return;
    }

    const seq = ++loadSeq.current;
    const stillCurrent = () => seq === loadSeq.current;

    setLoadState({ kind: "loading" });
    try {
      const booking = await fetchBookingById(id);
      if (!stillCurrent()) return;
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
      if (!stillCurrent()) return;
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
  }, [fetchBookingById, id, ready, user]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  // A 403 for this id hides the address. A later successful fetch of the same
  // id brings the job back (reassigned away, then assigned again).
  useEffect(() => {
    if (tracking.forbidden) {
      loadSeq.current += 1;
      setLoadState({ kind: "forbidden" });
      return;
    }

    const confirmed = tracking.booking;
    if (!confirmed || confirmed.id !== id || !user?.driverProfileId) return;
    if (confirmed.assignedDriverId !== user.driverProfileId) return;

    setLoadState((prev) => {
      if (prev.kind !== "forbidden") return prev;
      return { kind: "ready", booking: confirmed };
    });
  }, [tracking.forbidden, tracking.booking, id, user?.driverProfileId]);

  // Reflect live store updates (poll / optimistic PATCH) into the detail UI.
  // Only replace a job we already confirmed is ours — never paint from cache first.
  useEffect(() => {
    if (!storeBooking || !user?.driverProfileId) return;
    if (storeBooking.assignedDriverId !== user.driverProfileId) {
      setLoadState((prev) =>
        prev.kind === "ready" && prev.booking.id === storeBooking.id
          ? { kind: "forbidden" }
          : prev
      );
      return;
    }
    setLoadState((prev) => {
      if (prev.kind === "ready" && prev.booking.id === storeBooking.id) {
        if (prev.booking === storeBooking) return prev;
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
          title="Job not assigned to you"
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

function PhotoRow({
  label,
  photos,
  onError,
}: {
  label: string;
  photos: string[];
  onError: (url: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold text-[#6b7280]">{label}</div>
      <ul className="flex gap-2 overflow-x-auto">
        {photos.map((photo, i) => (
          <li key={`${label}-${i}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`${label} photo ${i + 1}`}
              className="size-20 rounded-[9px] object-cover"
              onError={() => onError(photo)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobPhotos({
  conditionPhotos,
  labelPhotos,
}: {
  conditionPhotos: string[];
  labelPhotos: string[];
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const hide = (url: string) =>
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));
  const visibleCondition = conditionPhotos.filter((url) => !failed.includes(url));
  const visibleLabel = labelPhotos.filter((url) => !failed.includes(url));

  if (visibleCondition.length === 0 && visibleLabel.length === 0) {
    return <p className="mt-1 text-xs text-[#9aa0a6]">No photos uploaded</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      {visibleCondition.length > 0 ? (
        <PhotoRow label="Condition" photos={visibleCondition} onError={hide} />
      ) : null}
      {visibleLabel.length > 0 ? (
        <PhotoRow label="Label" photos={visibleLabel} onError={hide} />
      ) : null}
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
  const phone = booking.customer.phone?.trim() ?? "";
  const phoneHref = phone ? telHref(phone) : null;
  const busy = pendingStatus !== null;
  const kind = techStopKind(booking.status);
  const canCollect =
    booking.status === "SCHEDULED" || pendingStatus === "COLLECTED";
  const canDeliver =
    booking.status === "READY" || pendingStatus === "DELIVERED";
  const addOns = bookingAddOnLabels(booking.addOns);
  const conditionPhotos = (booking.rug.photos ?? []).filter(isDisplayablePhotoUrl);
  const labelPhotos = (booking.rug.labelPhotos ?? []).filter(isDisplayablePhotoUrl);

  return (
    <div className="pb-2">
      <section className="overflow-hidden rounded-[14px] border border-[#e3e7ed] bg-white">
        <div className="p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="break-words text-[10px] font-extrabold tracking-[0.12em] text-[#9aa0a6]">
                {booking.id} ·{" "}
                {booking.status === "READY" ? "DELIVERY" : "COLLECTION"}
              </div>
              <h1 className="mt-1.5 text-xl font-extrabold text-navy">
                {booking.customer.name}
              </h1>
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="mt-1 inline-block text-sm font-semibold text-[#0a7a63] underline-offset-2 hover:underline"
                >
                  {phone}
                </a>
              ) : (
                <p className="mt-1 text-sm text-[#9aa0a6]">No phone number</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-[#6b7280]">
                <span className="sr-only">Collection date </span>
                {formatBadgeDate(booking.collectionDate)}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-extrabold",
                  techTagClass(kind)
                )}
              >
                <span className="sr-only">Slot </span>
                {slotWindowLabel(booking.collectionSlot)} ·{" "}
                {slotTimeLabel(booking.collectionSlot)}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-extrabold",
                  paymentBadgeClass(booking.paymentStatus)
                )}
              >
                <span className="sr-only">Payment status </span>
                {booking.paymentStatus}
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
              <button
                type="button"
                disabled
                className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[#e3e7ed] text-[12.5px] font-bold text-[#9aa0a6] disabled:cursor-not-allowed"
              >
                No number
              </button>
            )}
          </div>
        </div>
      </section>

      <p className="mb-2.5 mt-[22px] text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
        ITEMS TO COLLECT
      </p>
      <div className="rounded-xl border border-[#e3e7ed] bg-white px-[15px] py-3.5">
        <div className="text-sm font-bold text-navy">{booking.rug.type}</div>
        <div className="mt-1 text-xs text-[#6b7280]">
          {rugDimensionLabel(booking.rug)}
        </div>

        <div className="mt-3">
          <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#9aa0a6]">
            ADD-ONS
          </div>
          {addOns.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {addOns.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-[#e3e7ed] bg-[#f5f7fa] px-2.5 py-1 text-[11px] font-bold text-navy"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[#9aa0a6]">None</p>
          )}
        </div>

        <div className="mt-3">
          <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#9aa0a6]">
            PHOTOS
          </div>
          <JobPhotos
            key={booking.id}
            conditionPhotos={conditionPhotos}
            labelPhotos={labelPhotos}
          />
        </div>
      </div>

      <p className="mb-2.5 mt-[22px] text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
        FIELD MESSAGES
      </p>
      <div className="rounded-xl border border-[#e3e7ed] bg-white px-[15px] py-3.5">
        <p className="mb-3 text-xs text-[#9aa0a6]">
          Tell dispatch what happened at the door. Ops replies show here.
        </p>
        <FieldMessagesPanel
          bookingId={booking.id}
          variant="tech"
          placeholder="No one home, gate on the left…"
          emptyLabel="No messages yet."
        />
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
