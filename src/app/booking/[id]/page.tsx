"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BOOKING_STATUS_STEPS,
  BookingStatusTimeline,
} from "@/components/booking/BookingStatusTimeline";
import { SaveBookingAccountCard } from "@/components/booking/SaveBookingAccountCard";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBookingLiveTracking } from "@/hooks/useBookingLiveTracking";
import { isPersistedClient } from "@/types/user";
import { cn } from "@/lib/utils";

function slotLabel(slot: "MORNING" | "AFTERNOON") {
  return slot === "MORNING" ? "08:00 – 12:00" : "12:00 – 16:00";
}

function formatDimensions(widthM: number | null, lengthM: number | null) {
  if (
    typeof widthM === "number" &&
    typeof lengthM === "number" &&
    widthM > 0 &&
    lengthM > 0
  ) {
    return `${widthM}m × ${lengthM}m`;
  }
  return "To be measured on collection";
}

export default function BookingStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, ready: authReady } = useAuth();
  const signedInClient = isPersistedClient(user);

  const {
    booking,
    loading,
    error,
    forbidden,
    lastSyncedAt,
    isRefreshing,
    refresh,
  } = useBookingLiveTracking(id, authReady);

  if (loading && !booking) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div
          className="flex flex-col items-center justify-center gap-3 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <h1 className="text-xl font-semibold sm:text-2xl">Loading…</h1>
          <p className="text-sm text-muted-foreground">
            Fetching the latest status for your booking.
          </p>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 sm:py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold sm:text-2xl mb-2">Access denied</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This booking belongs to another account. Sign in with the email used at
          checkout to view it, or open the booking ID from the confirmation
          email while logged out.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard">Go to My Bookings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 sm:py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold sm:text-2xl mb-2">Booking not found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We couldn&apos;t find a booking with this ID. Check the reference from
          your confirmation and try again.
        </p>
        <Button asChild variant="outline">
          <Link href={signedInClient ? "/dashboard" : "/"}>
            <ArrowLeft className="h-4 w-4" />
            {signedInClient ? "Back to My Bookings" : "Back to home"}
          </Link>
        </Button>
      </div>
    );
  }

  const statusMeta = BOOKING_STATUS_STEPS.find((s) => s.id === booking.status);
  const isDelivered = booking.status === "DELIVERED";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10 pb-16">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href={signedInClient ? "/dashboard" : "/"}>
              <ArrowLeft className="h-4 w-4" />
              {signedInClient ? "My Bookings" : "Home"}
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Live order tracking
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Booking status
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground break-all">
              #{booking.id}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge
              variant={isDelivered ? "default" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {statusMeta?.label ?? booking.status}
            </Badge>
            <Badge
              variant={
                booking.paymentStatus === "PAID"
                  ? "default"
                  : booking.paymentStatus === "DEPOSIT"
                    ? "secondary"
                    : "outline"
              }
              className={cn(
                "text-sm",
                booking.paymentStatus === "UNPAID" &&
                  "border-destructive text-destructive"
              )}
            >
              {booking.paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {lastSyncedAt && (
            <span aria-live="polite">
              Last checked {format(lastSyncedAt, "HH:mm:ss")}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            aria-label="Refresh booking status"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {error && (
          <p
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <SaveBookingAccountCard
        bookingId={booking.id}
        email={booking.customer.email}
        name={booking.customer.name}
        phone={booking.customer.phone}
        userId={booking.userId}
        user={user}
        onClaimed={() => refresh()}
      />

      {/* Timeline */}
      <Card className="mb-6 sm:mb-8 overflow-hidden">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 text-primary shrink-0" aria-hidden />
            Cleaning journey
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Follow your rug from booking through delivery — status updates appear
            here within a few seconds.
          </p>
        </CardHeader>
        <CardContent className="pt-6 sm:pt-8 px-4 sm:px-6">
          <BookingStatusTimeline status={booking.status} />
        </CardContent>
      </Card>

      {/* Details grid */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
              Collection details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Address
              </p>
              <p className="font-medium break-words">{booking.addressLine1}</p>
              <p className="text-muted-foreground break-words">
                {booking.suburb}, {booking.city}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays
                className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"
                aria-hidden
              />
              <div>
                <p className="font-medium">
                  {format(new Date(booking.collectionDate), "EEEE, d MMMM yyyy")}
                </p>
                <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {slotLabel(booking.collectionSlot)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              Order summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Rug type</span>
              <span className="font-medium text-right break-words">
                {booking.rug.type}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Dimensions</span>
              <span className="font-medium text-right">
                {formatDimensions(booking.rug.widthM, booking.rug.lengthM)}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t pt-3">
              <span className="font-semibold">Estimated total</span>
              <span className="font-bold text-primary text-right tabular-nums">
                R{booking.estimatedPriceMin} – R{booking.estimatedPriceMax}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment */}
      <Card className="mt-4 sm:mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                booking.paymentStatus === "PAID"
                  ? "default"
                  : booking.paymentStatus === "DEPOSIT"
                    ? "secondary"
                    : "outline"
              }
              className={cn(
                booking.paymentStatus === "UNPAID" &&
                  "border-destructive text-destructive"
              )}
            >
              {booking.paymentStatus}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {booking.paymentStatus === "PAID"
              ? "Paid in full"
              : booking.paymentStatus === "DEPOSIT"
                ? "Deposit received — balance due before or on delivery"
                : "Payment outstanding — settle after inspection or when ready for delivery"}
          </p>
          {booking.paymentStatus === "UNPAID" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              Outstanding balance on this order.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
