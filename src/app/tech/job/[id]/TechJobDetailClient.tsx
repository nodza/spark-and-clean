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
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import {
  bookingAddOnLabels,
  formatBadgeDate,
  paymentBadgeClass,
  rugDimensionLabel,
  slotTimeLabel,
  slotWindowLabel,
  techStopKind,
  techTagClass,
} from "@/lib/techUi";
import { useBookingStore } from "@/store/useBookingStore";
import { useBookingLiveTracking } from "@/hooks/useBookingLiveTracking";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/phone";
import { FieldMessagesPanel } from "@/components/booking/FieldMessagesPanel";
import {
  bothDimensionsEmpty,
  isVanCollectStatus,
  isVanDeliverStatus,
  parseOptionalCollectDimensions,
  type CollectDimensions,
} from "@/lib/fieldStatus";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const fieldUpdateLock = useRef(false);
  const [trackedId, setTrackedId] = useState(id);
  if (id !== trackedId) {
    setTrackedId(id);
    setLoadState({ kind: id ? "loading" : "not_found" });
    setPendingStatus(null);
    setActionError(null);
    fieldUpdateLock.current = false;
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
  }, [fetchBookingById, id, ready, user]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  // A 403 from the live poll means this stop was reassigned — hide the address.
  useEffect(() => {
    if (!tracking.forbidden) return;
    setLoadState({ kind: "forbidden" });
  }, [tracking.forbidden]);

  // Reflect live store updates (poll / saved PATCH) into the detail UI.
  // Skip while a van update is in flight so a failed save cannot flash a new status.
  useEffect(() => {
    if (fieldUpdateLock.current) return;
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

  const handleStatusUpdate = async (
    newStatus: "COLLECTED" | "DELIVERED",
    dimensions?: CollectDimensions | null
  ) => {
    if (loadState.kind !== "ready" || pendingStatus || fieldUpdateLock.current) {
      return;
    }
    const bookingId = loadState.booking.id;
    const previous = loadState.booking;

    fieldUpdateLock.current = true;
    setActionError(null);
    setPendingStatus(newStatus);

    const error = await updateBookingStatus(
      bookingId,
      newStatus,
      dimensions ?? undefined
    );

    if (error) {
      fieldUpdateLock.current = false;
      setPendingStatus(null);
      setActionError(error);
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
        disabled={pendingStatus !== null}
        className="mb-3.5 inline-block text-[13px] font-bold text-[#0a7a63] hover:text-navy disabled:opacity-40"
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
          actionError={actionError}
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

function PhotoRow({ label, photos }: { label: string; photos: string[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold text-[#6b7280]">{label}</div>
      <ul className="flex gap-2 overflow-x-auto">
        {photos.map((photo, i) => (
          <li key={`${label}-${photo}-${i}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`${label} photo ${i + 1}`}
              className="size-20 rounded-[9px] object-cover"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobContent({
  booking,
  pendingStatus,
  actionError,
  onStatusUpdate,
}: {
  booking: Booking;
  pendingStatus: "COLLECTED" | "DELIVERED" | null;
  actionError: string | null;
  onStatusUpdate: (
    status: "COLLECTED" | "DELIVERED",
    dimensions?: CollectDimensions | null
  ) => void;
}) {
  const phone = booking.customer.phone?.trim() ?? "";
  const phoneHref = phone ? telHref(phone) : null;
  const busy = pendingStatus !== null;
  const kind = techStopKind(booking.status);
  const canCollect =
    isVanCollectStatus(booking.status) || pendingStatus === "COLLECTED";
  const canDeliver =
    isVanDeliverStatus(booking.status) || pendingStatus === "DELIVERED";
  const showSize =
    canCollect && bothDimensionsEmpty(booking.rug.widthM, booking.rug.lengthM);
  const [widthRaw, setWidthRaw] = useState("");
  const [lengthRaw, setLengthRaw] = useState("");
  const [widthError, setWidthError] = useState<string | undefined>();
  const [lengthError, setLengthError] = useState<string | undefined>();

  function submitCollect() {
    if (busy) return;
    if (showSize) {
      const parsed = parseOptionalCollectDimensions(widthRaw, lengthRaw);
      if (!parsed.ok) {
        setWidthError(parsed.widthError);
        setLengthError(parsed.lengthError);
        return;
      }
      setWidthError(undefined);
      setLengthError(undefined);
      onStatusUpdate("COLLECTED", parsed.dimensions);
      return;
    }
    onStatusUpdate("COLLECTED");
  }
  const addOns = bookingAddOnLabels(booking.addOns);
  const conditionPhotos = (booking.rug.photos ?? []).filter(Boolean);
  const labelPhotos = (booking.rug.labelPhotos ?? []).filter(Boolean);
  const hasPhotos = conditionPhotos.length > 0 || labelPhotos.length > 0;

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
          {hasPhotos ? (
            <div className="mt-2 space-y-3">
              {conditionPhotos.length > 0 ? (
                <PhotoRow label="Condition" photos={conditionPhotos} />
              ) : null}
              {labelPhotos.length > 0 ? (
                <PhotoRow label="Label" photos={labelPhotos} />
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#9aa0a6]">No photos uploaded</p>
          )}
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
        {showSize ? (
          <div className="mb-3 rounded-xl border border-[#e3e7ed] bg-white px-[15px] py-3.5">
            <p className="text-[10px] font-extrabold tracking-[0.12em] text-[#9aa0a6]">
              SIZE ON PICKUP
            </p>
            <p className="mt-1 text-xs text-[#6b7280]">
              Optional. Leave both blank to measure on pickup.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="collect-width"
                  className="mb-1 block text-[11px] font-bold text-navy"
                >
                  Width (m)
                </label>
                <Input
                  id="collect-width"
                  inputMode="decimal"
                  autoComplete="off"
                  value={widthRaw}
                  disabled={busy}
                  aria-invalid={Boolean(widthError)}
                  aria-describedby={
                    widthError ? "collect-width-error" : undefined
                  }
                  placeholder="e.g. 2"
                  className="py-2 text-sm"
                  onChange={(event) => {
                    setWidthRaw(event.target.value);
                    setWidthError(undefined);
                  }}
                />
                {widthError ? (
                  <p
                    id="collect-width-error"
                    className="mt-1 text-[11px] font-semibold text-[#b33232]"
                    role="alert"
                  >
                    {widthError}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="collect-length"
                  className="mb-1 block text-[11px] font-bold text-navy"
                >
                  Length (m)
                </label>
                <Input
                  id="collect-length"
                  inputMode="decimal"
                  autoComplete="off"
                  value={lengthRaw}
                  disabled={busy}
                  aria-invalid={Boolean(lengthError)}
                  aria-describedby={
                    lengthError ? "collect-length-error" : undefined
                  }
                  placeholder="e.g. 3"
                  className="py-2 text-sm"
                  onChange={(event) => {
                    setLengthRaw(event.target.value);
                    setLengthError(undefined);
                  }}
                />
                {lengthError ? (
                  <p
                    id="collect-length-error"
                    className="mt-1 text-[11px] font-semibold text-[#b33232]"
                    role="alert"
                  >
                    {lengthError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <p
            className="mb-3 rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-3 py-2 text-sm font-semibold text-[#b33232]"
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        {canCollect ? (
          <button
            type="button"
            disabled={busy}
            onClick={submitCollect}
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

        {!pendingStatus && booking.status === "COLLECTED" ? (
          <div className="rounded-full border border-[#e3e7ed] bg-white py-3.5 text-center text-sm font-bold text-[#9aa0a6]">
            Collected
          </div>
        ) : null}

        {!pendingStatus &&
        (booking.status === "CLEANING" || booking.status === "DRYING") ? (
          <div className="rounded-full border border-[#e3e7ed] bg-white py-3.5 text-center text-sm font-bold text-[#9aa0a6]">
            In progress at depot
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
