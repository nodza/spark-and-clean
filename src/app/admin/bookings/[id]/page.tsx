"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { Phone, User } from "lucide-react";
import { toast } from "sonner";
import { useBookingStore } from "@/store/useBookingStore";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import { MAX_NOTE_LEN } from "@/lib/internalNotes";
import type { BookingStatus, InternalNote, PaymentStatus } from "@/types/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { telHref } from "@/lib/phone";
import {
  AdminBackLink,
  AdminPortalShell,
} from "@/components/admin/AdminPortalShell";

type DriverOption = {
  id: string;
  name: string;
  vehicle?: string;
  phone?: string;
  isActive?: boolean;
};

function CallAction({
  label,
  phone,
  disabledReason,
  profileHref,
}: {
  label: string;
  phone?: string;
  disabledReason?: string;
  profileHref?: string;
}) {
  if (phone?.trim()) {
    return (
      <a
        href={telHref(phone)}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#000b49] px-3 text-sm font-bold text-white hover:bg-[#0a1a6b]"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex min-h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md bg-[#e3e7ed] px-3 text-sm font-bold text-[#6b7280]"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      <span className="text-xs text-[#6b7280]">{disabledReason}</span>
      {profileHref ? (
        <a href={profileHref} className="text-xs font-bold text-[#0a7a63] hover:underline">
          Open profile
        </a>
      ) : null}
    </div>
  );
}

const STATUS_OPTIONS = BOOKING_STATUSES;

function formatNoteTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : format(parsed, "PPp");
}

export default function AdminBookingDetail() {
  const params = useParams();
  const id = params.id as string;
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
  const [loadDone, setLoadDone] = useState(false);
  const [notFound, setNotFound] = useState(false);
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
    setLoadDone(false);
    setNotFound(false);

    void fetchBookingById(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoadDone(true);
      });

    void loadNotes();

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

    return () => {
      cancelled = true;
    };
  }, [fetchBookingById, id, loadNotes]);

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
      const driverId = val === "unassigned" ? null : val;
      const error = await assignDriver(booking.id, driverId);
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

  if (!loadDone && !booking) {
    return (
      <AdminPortalShell pageTitle="Booking detail" active="bookings">
        <div className="portal-page">
          <AdminBackLink href="/admin/bookings" label="Back to Bookings" />
          <div
            className="mt-6 text-meta"
            style={{ color: "#9aa0a6" }}
            role="status"
          >
            Loading booking…
          </div>
        </div>
      </AdminPortalShell>
    );
  }

  if (notFound || (loadDone && !booking)) {
    return (
      <AdminPortalShell pageTitle="Booking detail" active="bookings">
        <div className="portal-page">
          <AdminBackLink href="/admin/bookings" label="Back to Bookings" />
          <p className="mt-6 text-meta" style={{ color: "#9aa0a6" }}>
            Booking not found.
          </p>
        </div>
      </AdminPortalShell>
    );
  }

  if (!booking) return null;

  return (
    <AdminPortalShell pageTitle={`Booking ${booking.id}`} active="bookings">
      <div className="portal-page mx-auto max-w-4xl">
        <AdminBackLink href="/admin/bookings" label="Back to Bookings" />

        <div className="mt-6 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1
              className="text-[22px] font-extrabold sm:text-[28px]"
              style={{ color: "#000b49" }}
            >
              Booking #{booking.id}
            </h1>
            <div
              className="mt-2 flex flex-wrap items-center gap-2 text-[13px]"
              style={{ color: "#6b7280" }}
            >
              <User className="h-4 w-4 flex-none" />
              <span>{booking.customer.name}</span>
              <span aria-hidden="true">•</span>
              <CallAction
                label="Call customer"
                phone={booking.customer.phone}
                disabledReason="No customer number"
              />
            </div>
          </div>
          <div className="sm:text-right">
            <div
              className="text-[22px] font-extrabold tabular"
              style={{ color: "#000b49" }}
            >
              R{booking.estimatedPriceMin} – R{booking.estimatedPriceMax}
            </div>
            <p className="text-meta mt-1" style={{ color: "#9aa0a6" }}>
              Estimated total
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Rug Type</Label>
                    <p className="font-medium">{booking.rug.type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Dimensions</Label>
                    <p className="font-medium">
                      {booking.rug.widthM}m x {booking.rug.lengthM}m (
                      {booking.rug.areaSqM}m²)
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Collection Date
                    </Label>
                    <p className="font-medium">
                      {format(new Date(booking.collectionDate), "PPP")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Time Slot</Label>
                    <p className="font-medium">{booking.collectionSlot}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="mb-2 block text-muted-foreground">
                    Address
                  </Label>
                  <p className="font-medium">{booking.addressLine1}</p>
                  <p className="text-muted-foreground">
                    {booking.suburb}, {booking.city}
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="mb-2 block text-muted-foreground">
                    Add-ons
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {booking.addOns.odourRemoval && (
                      <span className="rounded bg-secondary px-2 py-1 text-sm">
                        Odour Removal & Hygiene Treatment
                      </span>
                    )}
                    {booking.addOns.stainProtection && (
                      <span className="rounded bg-secondary px-2 py-1 text-sm">
                        Stain Protection Treatment
                      </span>
                    )}
                    {!booking.addOns.odourRemoval &&
                      !booking.addOns.stainProtection && (
                        <span className="italic text-muted-foreground">
                          None
                        </span>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {booking.rug.photos && booking.rug.photos.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Photos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {booking.rug.photos.map((photo, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={photo}
                        alt={`Rug photo ${i + 1}`}
                        className="rounded-lg border"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
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
                    aria-describedby={
                      noteError ? "internal-note-error" : undefined
                    }
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
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
                      className="text-xs text-destructive"
                    >
                      {noteError}
                    </p>
                  ) : null}
                </div>

                <Separator />

                {notesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading notes…</p>
                ) : notesError ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-destructive" role="alert">
                      {notesError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadNotes()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No internal notes yet.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-md border bg-muted/30 px-3 py-3"
                      >
                        <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {note.author}
                          {" · "}
                          {formatNoteTime(note.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status & Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Current Status</Label>
                  <Select
                    value={booking.status}
                    disabled={saving}
                    onValueChange={(val) => void handleStatus(val)}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label>Assign Driver</Label>
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
                          {inactiveAssigned.name}
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

                {(() => {
                  const assignedDriver =
                    drivers.find((driver) => driver.id === booking.assignedDriverId) ??
                    (inactiveAssigned?.id === booking.assignedDriverId
                      ? inactiveAssigned
                      : null);
                  const hasAssignment = Boolean(booking.assignedDriverId);
                  return (
                    <div className="space-y-2">
                      <Label>Driver contact</Label>
                      <CallAction
                        label="Call driver"
                        phone={assignedDriver?.phone}
                        disabledReason={
                          hasAssignment
                            ? "No number on profile"
                            : "Assign a driver first"
                        }
                        profileHref={
                          assignedDriver
                            ? `/admin/technicians/${assignedDriver.id}`
                            : undefined
                        }
                      />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={booking.paymentStatus}
                  disabled={saving}
                  onValueChange={(val) => void handlePayment(val)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="UNPAID"
                      id="unpaid"
                      disabled={saving}
                    />
                    <Label
                      htmlFor="unpaid"
                      className="font-medium text-destructive"
                    >
                      Unpaid
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="DEPOSIT"
                      id="deposit"
                      disabled={saving}
                    />
                    <Label
                      htmlFor="deposit"
                      className="font-medium text-orange-500"
                    >
                      Deposit Paid
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PAID" id="paid" disabled={saving} />
                    <Label htmlFor="paid" className="font-medium text-green-600">
                      Paid in Full
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
