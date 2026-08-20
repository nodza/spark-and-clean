"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking, BookingStatus } from "@/types/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, MapPin, Truck } from "lucide-react";
import { format } from "date-fns";

const STATUS_STEPS: { id: BookingStatus; label: string }[] = [
  { id: "BOOKED", label: "Booked" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "COLLECTED", label: "Collected" },
  { id: "CLEANING", label: "Cleaning" },
  { id: "DRYING", label: "Drying" },
  { id: "READY", label: "Ready" },
  { id: "DELIVERED", label: "Delivered" },
];

export default function BookingStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const { bookings, fetchBookings } = useBookingStore();
  const [booking, setBooking] = useState<Booking | undefined>();

  useEffect(() => {
    // Ensure we have data (from local storage or fetch)
    if (bookings.length === 0) {
      fetchBookings();
    }
  }, [bookings.length, fetchBookings]);

  useEffect(() => {
    if (bookings.length > 0) {
      const found = bookings.find((b) => b.id === id);
      if (found) {
        setBooking(found);
        return;
      }
    }

    try {
      const raw = sessionStorage.getItem(`booking:${id}`);
      if (raw) {
        setBooking(JSON.parse(raw) as Booking);
      }
    } catch {
      // ignore
    }
  }, [bookings, id]);

  if (!booking) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading Booking...</h1>
        <p className="text-muted-foreground">If this takes too long, the booking ID might be invalid.</p>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.id === booking.status);

  const paymentLabel =
    booking.paymentStatus === "PAID"
      ? "Paid in full"
      : booking.paymentStatus === "DEPOSIT"
        ? "Deposit received"
        : "Payment outstanding";

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Booking Status</h1>
        <p className="text-muted-foreground">Order #{booking.id}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant={booking.status === "DELIVERED" ? "default" : "secondary"}>
            {STATUS_STEPS.find((s) => s.id === booking.status)?.label}
          </Badge>
          <Badge
            variant={
              booking.paymentStatus === "PAID"
                ? "default"
                : booking.paymentStatus === "DEPOSIT"
                  ? "secondary"
                  : "outline"
            }
            className={
              booking.paymentStatus === "UNPAID"
                ? "border-destructive text-destructive"
                : undefined
            }
          >
            {booking.paymentStatus}
          </Badge>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Current Status</span>
            <Badge variant={booking.status === "DELIVERED" ? "default" : "secondary"} className="text-lg px-4 py-1">
              {STATUS_STEPS.find(s => s.id === booking.status)?.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Vertical line for mobile, horizontal for desktop could be tricky, let's stick to vertical list for simplicity and responsiveness */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-secondary" />
            
            <div className="space-y-8 relative">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center gap-4">
                    <div className={`z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      isCompleted 
                        ? "bg-primary border-primary text-primary-foreground" 
                        : "bg-background border-muted-foreground text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </div>
                    <div className={`${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                      <p className={`font-medium ${isCurrent ? "text-lg font-bold text-primary" : ""}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-sm text-muted-foreground animate-pulse">
                          In Progress...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Collection Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="font-medium">{booking.addressLine1}</p>
                <p className="text-sm text-muted-foreground">{booking.suburb}, {booking.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm">
                {format(new Date(booking.collectionDate), "PPP")} - {booking.collectionSlot === "MORNING" ? "08:00 - 12:00" : "12:00 - 16:00"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rug Type</span>
              <span className="font-medium">{booking.rug.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{booking.rug.widthM}m x {booking.rug.lengthM}m</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold">Est. Total</span>
              <span className="font-bold text-primary">R{booking.estimatedPriceMin} - R{booking.estimatedPriceMax}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Payment status</span>
            <Badge
              variant={
                booking.paymentStatus === "PAID"
                  ? "default"
                  : booking.paymentStatus === "DEPOSIT"
                    ? "secondary"
                    : "outline"
              }
              className={
                booking.paymentStatus === "UNPAID"
                  ? "border-destructive text-destructive"
                  : undefined
              }
            >
              {booking.paymentStatus}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{paymentLabel}</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated amount</span>
            <span className="font-medium">
              R{booking.estimatedPriceMin} – R{booking.estimatedPriceMax}
            </span>
          </div>
          {booking.paymentStatus === "UNPAID" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Outstanding balance — pay after inspection or when your rug is ready
              for delivery.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
