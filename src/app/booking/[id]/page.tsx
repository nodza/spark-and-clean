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

function readSessionBooking(id: string): Booking | undefined {
  try {
    const raw = sessionStorage.getItem(`booking:${id}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as Booking;
  } catch {
    return undefined;
  }
}

export default function BookingStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const { bookings, fetchBookings, isLoading } = useBookingStore();
  const [hydrated, setHydrated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [sessionBooking, setSessionBooking] = useState<Booking | undefined>();

  useEffect(() => {
    setHydrated(useBookingStore.persist.hasHydrated());
    return useBookingStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    setSessionBooking(readSessionBooking(id));
  }, [id]);

  const booking = bookings.find((b) => b.id === id) ?? sessionBooking;

  useEffect(() => {
    if (!hydrated || booking || hasFetched) return;
    void fetchBookings().finally(() => setHasFetched(true));
  }, [hydrated, booking, hasFetched, fetchBookings]);

  if (!hydrated || (isLoading && !booking && !hasFetched)) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading Booking...</h1>
        <p className="text-muted-foreground">
          If this takes too long, the booking ID might be invalid.
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Booking not found</h1>
        <p className="text-muted-foreground">
          No booking exists for this ID. Complete a booking from{" "}
          <a href="/book/rug" className="text-primary underline-offset-4 hover:underline">
            /book/rug
          </a>{" "}
          to view status here.
        </p>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.id === booking.status);

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Booking Status</h1>
        <p className="text-muted-foreground">Order #{booking.id}</p>
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
              <span className="font-medium">
                {typeof booking.rug.widthM === "number" &&
                typeof booking.rug.lengthM === "number" &&
                booking.rug.widthM > 0 &&
                booking.rug.lengthM > 0
                  ? `${booking.rug.widthM}m x ${booking.rug.lengthM}m`
                  : "To be measured by driver"}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold">Est. Total</span>
              <span className="font-bold text-primary">R{booking.estimatedPriceMin} - R{booking.estimatedPriceMax}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
