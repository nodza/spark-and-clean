"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useBookingStore } from "@/store/useBookingStore";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import type { BookingStatus, PaymentStatus } from "@/types/booking";
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
import { ArrowLeft, User } from "lucide-react";
import { format } from "date-fns";

type DriverOption = { id: string; name: string; vehicle?: string };

const STATUS_OPTIONS = BOOKING_STATUSES;

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
  const [loadDone, setLoadDone] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

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

    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setDrivers(data);
      })
      .catch(() => {
        if (!cancelled) setDrivers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchBookingById, id]);

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
      <div className="p-10" role="status">
        Loading...
      </div>
    );
  }

  if (notFound || (loadDone && !booking)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <p className="mb-4 text-muted-foreground">Booking not found.</p>
        <Button asChild variant="outline">
          <Link href="/admin/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bookings
          </Link>
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Button asChild variant="ghost" className="mb-6">
        <Link href="/admin/bookings">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bookings
        </Link>
      </Button>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Booking #{booking.id}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{booking.customer.name}</span>
            <span>•</span>
            <span>{booking.customer.phone}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            R{booking.estimatedPriceMin} - R{booking.estimatedPriceMax}
          </div>
          <p className="text-sm text-muted-foreground">Estimated Total</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label className="text-muted-foreground">Collection Date</Label>
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
                <Label className="text-muted-foreground mb-2 block">Address</Label>
                <p className="font-medium">{booking.addressLine1}</p>
                <p className="text-muted-foreground">
                  {booking.suburb}, {booking.city}
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground mb-2 block">Add-ons</Label>
                <div className="flex gap-2">
                  {booking.addOns.odourRemoval && (
                    <span className="bg-secondary px-2 py-1 rounded text-sm">
                      Odour Removal & Hygiene Treatment
                    </span>
                  )}
                  {booking.addOns.stainProtection && (
                    <span className="bg-secondary px-2 py-1 rounded text-sm">
                      Stain Protection Treatment
                    </span>
                  )}
                  {!booking.addOns.odourRemoval &&
                    !booking.addOns.stainProtection && (
                      <span className="text-muted-foreground italic">None</span>
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
                <div className="grid grid-cols-3 gap-4">
                  {booking.rug.photos.map((photo, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={photo}
                      alt="Rug"
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
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                        {driver.vehicle ? ` (${driver.vehicle})` : ""}
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
                    Deposit Paid
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PAID" id="paid" disabled={saving} />
                  <Label htmlFor="paid" className="text-green-600 font-medium">
                    Paid in Full
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
