"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useBookingStore } from "@/store/useBookingStore";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import { MAX_NOTE_LEN } from "@/lib/internalNotes";
import type { Booking, BookingStatus, InternalNote, PaymentStatus } from "@/types/booking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  CallAction,
  driverProfileHref,
} from "@/components/admin/CallAction";
import { InactiveDriverBadge } from "@/components/admin/InactiveDriverBadge";
import {
  AdminBackLink,
  AdminPortalShell,
} from "@/components/admin/AdminPortalShell";
import {
  bookingStatusVariant,
  paymentStatusVariant,
} from "@/components/admin/bookingBadges";

const STATUS_OPTIONS = BOOKING_STATUSES;

type DriverOption = {
  id: string;
  name: string;
  vehicle?: string;
  phone?: string;
  isActive?: boolean;
};

function addOnLabels(booking: Booking): string[] {
  const addOns = booking.addOns as Booking["addOns"] & {
    stainTreatment?: boolean;
    fabricProtection?: boolean;
  };
  const labels: string[] = [];
  if (addOns?.odourRemoval || addOns?.stainTreatment) {
    labels.push("Odour Removal & Hygiene Treatment");
  }
  if (addOns?.stainProtection || addOns?.fabricProtection) {
    labels.push("Stain Protection Treatment");
  }
  return labels;
}

function formatCollectionLong(value: string) {
  const day = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (day) return format(parseISO(day), "PPP");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "PPP");
}

function formatNoteTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : format(parsed, "PPp");
}

function AssignedDriverCall({
  assignedDriverId,
  drivers,
  inactiveAssigned,
}: {
  assignedDriverId?: string;
  drivers: DriverOption[];
  inactiveAssigned: DriverOption | null;
}) {
  const assignedDriver =
    drivers.find((driver) => driver.id === assignedDriverId) ??
    (inactiveAssigned?.id === assignedDriverId ? inactiveAssigned : null);
  const hasAssignment = Boolean(assignedDriverId);
  const isInactive =
    hasAssignment &&
    (assignedDriver?.isActive === false ||
      !drivers.some((driver) => driver.id === assignedDriverId));
  const phone = assignedDriver?.phone?.trim();

  if (!hasAssignment || isInactive) {
    return null;
  }

  return (
    <div className="mt-[14px] space-y-2">
      <Label>Driver contact</Label>
      <div
        className="flex flex-wrap items-center gap-2 text-[13px]"
        style={{ color: "#6b7280" }}
      >
        {phone ? <span>{phone}</span> : null}
        <CallAction
          appearance="inline"
          label="Call driver"
          phone={phone}
          disabledReason="No number on profile"
          profileHref={
            assignedDriver ? driverProfileHref(assignedDriver.id) : undefined
          }
        />
      </div>
    </div>
  );
}

function AssignedDriverSummary({
  assignedDriverId,
  assigned,
  drivers,
}: {
  assignedDriverId?: string;
  assigned: DriverOption | null;
  drivers: DriverOption[];
}) {
  if (!assignedDriverId) {
    return (
      <p className="text-body mt-[10px]" style={{ color: "#32373c" }}>
        Unassigned
      </p>
    );
  }

  const isInactive =
    assigned?.isActive === false ||
    !drivers.some((driver) => driver.id === assignedDriverId);
  const showName =
    assigned && assigned.name.trim() && assigned.name !== assigned.id
      ? assigned.vehicle
        ? `${assigned.name} · ${assigned.vehicle}`
        : assigned.name
      : null;

  if (isInactive) {
    return (
      <div className="mt-[10px] flex flex-wrap items-center gap-2">
        {showName ? (
          <span className="text-body" style={{ color: "#32373c" }}>
            {showName}
          </span>
        ) : null}
        <InactiveDriverBadge />
      </div>
    );
  }

  return (
    <p className="text-body mt-[10px]" style={{ color: "#32373c" }}>
      {showName ?? assigned?.name ?? "Assigned"}
    </p>
  );
}

export default function AdminBookingDetail() {
  const params = useParams();
  const id = String(params.id ?? "");
  const {
    bookings,
    fetchBookingById,
    updateBookingStatus,
    updatePaymentStatus,
    assignDriver,
  } = useBookingStore();
  const booking = bookings.find((candidate) => candidate.id === id);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [inactiveAssigned, setInactiveAssigned] = useState<DriverOption | null>(
    null
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">(
    booking ? "ready" : "loading"
  );
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/notes`, {
        credentials: "include",
      });
      if (!res.ok) {
        setNotesError("Could not load notes");
        return;
      }
      const data = await res.json();
      const list: InternalNote[] = Array.isArray(data.notes) ? data.notes : [];
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setNotes(list);
    } catch {
      setNotesError("Could not load notes");
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoadState(booking ? "ready" : "loading");

    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setDrivers(
            data.filter(
              (driver): driver is DriverOption => driver?.isActive !== false
            )
          );
        }
      })
      .catch(() => {
        if (!cancelled) setDrivers([]);
      });

    void fetchBookingById(id)
      .then((found) => {
        if (cancelled) return;
        setLoadState(found ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setLoadState("missing");
      });

    void loadNotes();

    return () => {
      cancelled = true;
    };
    // Show cached row immediately; refresh this id from S1 without refetching the full list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchBookingById, loadNotes]);

  useEffect(() => {
    const assignedId = booking?.assignedDriverId;
    if (!assignedId || drivers.some((driver) => driver.id === assignedId)) {
      setInactiveAssigned(null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/drivers/${assignedId}`, { credentials: "include" })
      .then(async (res) =>
        res.ok ? res.json() : { id: assignedId, name: assignedId }
      )
      .then((data) => {
        if (cancelled) return;
        setInactiveAssigned({
          id: String(data.id || assignedId),
          name: String(data.name || assignedId),
          vehicle: typeof data.vehicle === "string" ? data.vehicle : undefined,
          phone: typeof data.phone === "string" ? data.phone : undefined,
          isActive: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setInactiveAssigned({
            id: assignedId,
            name: assignedId,
            isActive: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [booking?.assignedDriverId, drivers]);

  const assigned = useMemo(
    () =>
      drivers.find((d) => d.id === booking?.assignedDriverId) ||
      inactiveAssigned,
    [drivers, inactiveAssigned, booking?.assignedDriverId]
  );

  const addNote = async () => {
    const body = noteDraft.trim();
    setNoteError(null);
    if (!body) return;
    if (body.length > MAX_NOTE_LEN) {
      setNoteError(`Note must be at most ${MAX_NOTE_LEN} characters`);
      return;
    }

    setNoteSaving(true);
    try {
      const res = await fetch(`/api/bookings/${id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteError(
          typeof data.error === "string" ? data.error : "Failed to add note"
        );
        return;
      }
      const created = data.note as InternalNote | undefined;
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setNotesError(null);
      } else {
        await loadNotes();
      }
      setNoteDraft("");
    } catch {
      setNoteError("Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleStatus = async (val: string) => {
    if (!booking || saving) return;
    setSaving(true);
    try {
      const error = await updateBookingStatus(booking.id, val as BookingStatus);
      if (error) toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (val: string) => {
    if (!booking || saving) return;
    if (val !== "unassigned" && !drivers.some((driver) => driver.id === val)) {
      return;
    }
    setSaving(true);
    try {
      const error = await assignDriver(
        booking.id,
        val === "unassigned" ? null : val
      );
      if (error) toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (val: string) => {
    if (!booking || saving) return;
    setSaving(true);
    try {
      const error = await updatePaymentStatus(booking.id, val as PaymentStatus);
      if (error) toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPortalShell
      pageTitle={booking ? booking.id : "Booking"}
      active="bookings"
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <AdminBackLink href="/admin/bookings" label="Back to bookings" />

        {loadState === "loading" && !booking && (
          <div className="ds-card text-meta" style={{ color: "#9aa0a6" }} role="status">
            Loading…
          </div>
        )}

        {loadState === "missing" && !booking && (
          <div className="ds-card">
            <div className="text-card-title" style={{ color: "#000b49" }}>
              Booking not found
            </div>
            <p className="text-body mt-[8px]" style={{ color: "#6b7280" }}>
              No booking exists for <span className="tabular">{id}</span>.
            </p>
            <Link href="/admin/bookings" className="ds-text-action mt-[14px] inline-block">
              Back to the bookings list
            </Link>
          </div>
        )}

        {booking && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-[16px]">
              <div>
                <div className="flex flex-wrap items-center gap-[10px]">
                  <h1 className="text-page-title" style={{ color: "#000b49" }}>
                    {booking.id}
                  </h1>
                  <Badge variant={bookingStatusVariant(booking.status)}>
                    {booking.status}
                  </Badge>
                  <Badge variant={paymentStatusVariant(booking.paymentStatus)}>
                    {booking.paymentStatus}
                  </Badge>
                </div>
                <div className="text-body mt-[8px]" style={{ color: "#32373c" }}>
                  {booking.customer.name}
                </div>
                <div
                  className="text-meta mt-[6px] flex flex-wrap items-center gap-x-[14px] gap-y-[4px]"
                  style={{ color: "#6b7280" }}
                >
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{booking.customer.phone}</span>
                    <CallAction
                      appearance="inline"
                      label="Call customer"
                      phone={booking.customer.phone}
                      disabledReason="No customer number"
                    />
                  </span>
                  <a className="ds-text-action" href={`mailto:${booking.customer.email}`}>
                    {booking.customer.email}
                  </a>
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-[22px] font-extrabold" style={{ color: "#000b49" }}>
                  R{booking.estimatedPriceMin} – R{booking.estimatedPriceMax}
                </div>
                <div className="text-meta" style={{ color: "#9aa0a6" }}>
                  Estimated total
                </div>
              </div>
            </div>

            <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-w-0 flex-col gap-[18px]">
                <div className="ds-card">
                  <div className="text-card-title" style={{ color: "#000b49" }}>
                    Job details
                  </div>
                  <div className="mt-[16px] grid grid-cols-2 gap-[14px]">
                    <div>
                      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                        RUG TYPE
                      </div>
                      <p className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                        {booking.rug.type}
                      </p>
                    </div>
                    <div>
                      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                        DIMENSIONS
                      </div>
                      <p className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                        {booking.rug.widthM}m × {booking.rug.lengthM}m ({booking.rug.areaSqM}m²)
                      </p>
                    </div>
                    <div>
                      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                        COLLECTION DATE
                      </div>
                      <p className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                        {formatCollectionLong(booking.collectionDate)}
                      </p>
                    </div>
                    <div>
                      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                        TIME SLOT
                      </div>
                      <p className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                        {booking.collectionSlot}
                      </p>
                    </div>
                  </div>
                  <div className="mt-[16px]">
                    <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                      ADDRESS
                    </div>
                    <p className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                      {booking.addressLine1}
                    </p>
                    <p className="text-meta mt-[2px]" style={{ color: "#9aa0a6" }}>
                      {booking.suburb}, {booking.city}
                    </p>
                  </div>
                  <div className="mt-[16px]">
                    <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                      ADD-ONS
                    </div>
                    <div className="mt-[8px] flex flex-wrap gap-[8px]">
                      {addOnLabels(booking).length === 0 ? (
                        <span className="text-meta" style={{ color: "#9aa0a6" }}>
                          None
                        </span>
                      ) : (
                        addOnLabels(booking).map((label) => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  {booking.couponCode ? (
                    <div className="mt-[16px]">
                      <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                        COUPON
                      </div>
                      <p className="text-body mt-[4px] tabular" style={{ color: "#32373c" }}>
                        {booking.couponCode}
                      </p>
                    </div>
                  ) : null}
                </div>

                {booking.rug.photos && booking.rug.photos.length > 0 && (
                  <div className="ds-card">
                    <div className="text-card-title" style={{ color: "#000b49" }}>
                      Photos
                    </div>
                    <div className="mt-[14px] grid grid-cols-3 gap-[10px]">
                      {booking.rug.photos.map((photo, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${photo}-${i}`}
                          src={photo}
                          alt={`Rug photo ${i + 1}`}
                          className="rounded-[10px] border border-[#f0f2f6]"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="ds-card">
                  <div className="text-card-title" style={{ color: "#000b49" }}>
                    Internal notes
                  </div>
                  <div className="mt-[14px] space-y-2">
                    <Label htmlFor="internal-note">Internal note</Label>
                    <Textarea
                      id="internal-note"
                      value={noteDraft}
                      onChange={(e) => {
                        setNoteDraft(e.target.value);
                        if (noteError) setNoteError(null);
                      }}
                      placeholder="Gate code, dog on site, customer will EFT after collection…"
                      maxLength={MAX_NOTE_LEN}
                      rows={3}
                      aria-invalid={noteError ? true : undefined}
                      aria-describedby={noteError ? "internal-note-error" : undefined}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-meta" style={{ color: "#9aa0a6" }}>
                        {noteDraft.trim().length}/{MAX_NOTE_LEN}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={noteSaving || !noteDraft.trim()}
                        onClick={() => void addNote()}
                      >
                        {noteSaving ? "Adding…" : "Add"}
                      </Button>
                    </div>
                    {noteError ? (
                      <p
                        id="internal-note-error"
                        role="alert"
                        className="text-sm"
                        style={{ color: "#b3261e" }}
                      >
                        {noteError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-[16px]">
                    {notesLoading ? (
                      <p className="text-meta" style={{ color: "#9aa0a6" }}>
                        Loading notes…
                      </p>
                    ) : notesError ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                          {notesError}
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void loadNotes()}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : notes.length === 0 ? (
                      <p className="text-meta italic" style={{ color: "#9aa0a6" }}>
                        No internal notes yet.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {notes.map((note) => (
                          <li
                            key={note.id}
                            className="rounded-[10px] border border-[#f0f2f6] bg-[#f7f9fb] px-3 py-3"
                          >
                            <p className="text-body whitespace-pre-wrap" style={{ color: "#32373c" }}>
                              {note.body}
                            </p>
                            <p className="text-meta mt-2" style={{ color: "#9aa0a6" }}>
                              {note.author} · {formatNoteTime(note.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-[14px]">
                <div className="ds-card">
                  <div className="text-card-title" style={{ color: "#000b49" }}>
                    Status
                  </div>
                  <div className="mt-[14px] space-y-2">
                    <Label>Current status</Label>
                    <Select
                      value={booking.status}
                      disabled={saving}
                      onValueChange={(val) => void handleStatus(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="ds-card">
                  <div className="text-card-title" style={{ color: "#000b49" }}>
                    Assignment
                  </div>
                  <AssignedDriverSummary
                    assignedDriverId={booking.assignedDriverId}
                    assigned={assigned ?? null}
                    drivers={drivers}
                  />
                  <div className="mt-[14px] space-y-2">
                    <Label>Assign driver</Label>
                    <Select
                      value={booking.assignedDriverId || "unassigned"}
                      disabled={saving}
                      onValueChange={(val) => void handleAssign(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 overflow-y-auto">
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {inactiveAssigned &&
                        !drivers.some((driver) => driver.id === inactiveAssigned.id) ? (
                          <SelectItem value={inactiveAssigned.id} disabled>
                            {inactiveAssigned.name &&
                            inactiveAssigned.name !== inactiveAssigned.id
                              ? inactiveAssigned.name
                              : "Assigned driver"}
                            {inactiveAssigned.vehicle
                              ? ` (${inactiveAssigned.vehicle})`
                              : ""}{" "}
                            — inactive
                          </SelectItem>
                        ) : null}
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}
                            {driver.vehicle ? ` (${driver.vehicle})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <AssignedDriverCall
                    assignedDriverId={booking.assignedDriverId}
                    drivers={drivers}
                    inactiveAssigned={inactiveAssigned}
                  />
                  {booking.assignedDriverId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-[12px]"
                      disabled={saving}
                      onClick={() => void handleAssign("unassigned")}
                    >
                      Unassign
                    </Button>
                  ) : null}
                </div>

                <div className="ds-card">
                  <div className="text-card-title" style={{ color: "#000b49" }}>
                    Payment
                  </div>
                  <RadioGroup
                    className="mt-[14px]"
                    value={booking.paymentStatus}
                    disabled={saving}
                    onValueChange={(val) => void handlePayment(val)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="UNPAID" id="unpaid" disabled={saving} />
                      <Label htmlFor="unpaid" className="text-destructive font-medium">
                        Unpaid
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DEPOSIT" id="deposit" disabled={saving} />
                      <Label htmlFor="deposit" className="text-orange-500 font-medium">
                        Deposit paid
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PAID" id="paid" disabled={saving} />
                      <Label htmlFor="paid" className="text-green-600 font-medium">
                        Paid in full
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPortalShell>
  );
}
