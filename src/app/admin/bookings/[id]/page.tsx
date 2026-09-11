"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { BookingStatus, PaymentStatus } from "@/types/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { User } from "lucide-react";
import { format } from "date-fns";
import {
  AdminBackLink,
  AdminPortalShell,
} from "@/components/admin/AdminPortalShell";

type DriverOption = { id: string; name: string; vehicle: string };

const STATUS_OPTIONS: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
];

export default function AdminBookingDetail() {
  const params = useParams();
  const id = params.id as string;
  const {
    bookings,
    fetchBookings,
    updateBookingStatus,
    updatePaymentStatus,
    assignDriver,
  } = useBookingStore();
  const booking = bookings.find((candidate) => candidate.id === id);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);

  useEffect(() => {
    void fetchBookings();
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDrivers(data);
      })
      .catch(() => setDrivers([]));
  }, [fetchBookings]);

  if (!booking) {
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

  return (
    <AdminPortalShell
      pageTitle={`Booking ${booking.id}`}
      active="bookings"
    >
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
              <span>{booking.customer.phone}</span>
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

            {booking.rug.photos && booking.rug.photos.length > 0 && (
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
            )}
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
                    onValueChange={(val) =>
                      updateBookingStatus(booking.id, val as BookingStatus)
                    }
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
                    onValueChange={(val) => assignDriver(booking.id, val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" disabled>
                        Select driver...
                      </SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} ({driver.vehicle})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={booking.paymentStatus}
                  onValueChange={(val) =>
                    updatePaymentStatus(booking.id, val as PaymentStatus)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="UNPAID" id="unpaid" />
                    <Label
                      htmlFor="unpaid"
                      className="font-medium text-destructive"
                    >
                      Unpaid
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DEPOSIT" id="deposit" />
                    <Label
                      htmlFor="deposit"
                      className="font-medium text-orange-500"
                    >
                      Deposit Paid
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PAID" id="paid" />
                    <Label
                      htmlFor="paid"
                      className="font-medium text-green-600"
                    >
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
