"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useBookingStore } from "@/store/useBookingStore";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import type { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
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
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import {
  bookingStatusVariant,
  paymentStatusVariant,
} from "@/components/admin/bookingBadges";

const STATUS_OPTIONS = BOOKING_STATUSES;

type DriverOption = { id: string; name: string; vehicle?: string };

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits || phone.trim()}`;
}

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
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">(
    booking ? "ready" : "loading"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadState(booking ? "ready" : "loading");
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setDrivers(data);
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
    return () => {
      cancelled = true;
    };
    // Show cached row immediately; refresh this id from S1 without refetching the full list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchBookingById]);

  const assigned = useMemo(
    () => drivers.find((d) => d.id === booking?.assignedDriverId),
    [drivers, booking?.assignedDriverId]
  );

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
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <Link href="/admin/bookings" className="ds-text-action w-fit">
          ← Back to bookings
        </Link>

        {loadState === "loading" && !booking && (
          <div className="ds-card text-meta" style={{ color: "#9aa0a6" }}>
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
                <div className="text-meta mt-[6px] flex flex-wrap gap-x-[14px] gap-y-[4px]" style={{ color: "#6b7280" }}>
                  <a className="ds-text-action" href={telHref(booking.customer.phone)}>
                    {booking.customer.phone}
                  </a>
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
              <div className="flex flex-col gap-[18px] min-w-0">
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
                  <p className="text-body mt-[10px]" style={{ color: "#32373c" }}>
                    {assigned
                      ? assigned.vehicle
                        ? `${assigned.name} · ${assigned.vehicle}`
                        : assigned.name
                      : booking.assignedDriverId
                        ? booking.assignedDriverId
                        : "Unassigned"}
                  </p>
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
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}
                            {driver.vehicle ? ` (${driver.vehicle})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
