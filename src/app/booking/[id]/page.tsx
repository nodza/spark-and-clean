"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Clock,
  Coins,
  CreditCard,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
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
import { PayButton } from "@/components/payments/PayButton";
import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import {
  amountDueCentsForBooking,
  balanceAmountCents,
  depositAmountCents,
  DEPOSIT_FRACTION,
} from "@/lib/payments/deposit";
import { isPersistedClient } from "@/types/user";
import { cn } from "@/lib/utils";

function formatRand(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `R ${amount.replace(/\u00a0/g, " ")}`;
}

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

function CheckoutReturnNotice() {
  const value = useSearchParams().get("checkout");
  if (value === "success") {
    return (
      <p
        className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-foreground"
        role="status"
      >
        You&apos;re back from checkout. This booking stays unpaid until the bank
        confirms the deposit.
      </p>
    );
  }
  if (value === "cancel") {
    return (
      <p
        className="rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground"
        role="status"
      >
        Checkout was cancelled. You can pay the deposit when you&apos;re ready.
      </p>
    );
  }
  return null;
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
            <Link href="/portal">Go to My Bookings</Link>
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
          <Link href={signedInClient ? "/portal" : "/"}>
            <ArrowLeft className="h-4 w-4" />
            {signedInClient ? "Back to My Bookings" : "Back to home"}
          </Link>
        </Button>
      </div>
    );
  }

  const statusMeta = BOOKING_STATUS_STEPS.find((s) => s.id === booking.status);
  const isDelivered = booking.status === "DELIVERED";
  const amountDueCents = amountDueCentsForBooking(booking);
  const depositCents = depositAmountCents(amountDueCents);
  const balanceCents = Math.max(0, amountDueCents - depositCents);
  const depositPercent = Math.round(DEPOSIT_FRACTION * 100);
  const paymentLabel =
    booking.paymentStatus === "PAID"
      ? "Paid in full"
      : booking.paymentStatus === "DEPOSIT"
        ? "Deposit received"
        : "Unpaid";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10 pb-16">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href={signedInClient ? "/portal" : "/"}>
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
      <Card className="mt-4 overflow-hidden rounded-xl border-[#e6ebf2] bg-white sm:mt-5">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#3154d4]">
              <CreditCard className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                Payment
              </p>
              <h2 className="text-base font-bold tracking-tight text-[#172033]">
                {paymentLabel}
              </h2>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide",
              booking.paymentStatus === "PAID" && "bg-[#e8f8f2] text-[#0a7a63]",
              booking.paymentStatus === "DEPOSIT" && "bg-[#eef2ff] text-[#2c4fa6]",
              booking.paymentStatus === "UNPAID" && "bg-[#fff1f1] text-[#e11d48]"
            )}
          >
            <CircleAlert className="size-3" aria-hidden />
            {booking.paymentStatus}
          </span>
        </div>

        <CardContent className="space-y-3 px-4 pb-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-[#e8edf5] px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef3ff] text-[#3154d4]">
                <Coins className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#7b8494]">Amount due</p>
                <p className="text-lg font-bold tabular-nums tracking-tight text-[#172033]">
                  {formatRand(amountDueCents)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#d7f3e8] bg-[#f3fbf7] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e5f8ef] text-[#12a15a]">
                  <ShieldCheck className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#12a15a]">
                    Deposit · {depositPercent}%
                  </p>
                  <p className="text-lg font-bold tabular-nums tracking-tight text-[#0d8a4b]">
                    {formatRand(
                      booking.paymentStatus === "PAID" ? 0 : depositCents
                    )}
                  </p>
                </div>
              </div>
              {booking.paymentStatus === "UNPAID" ? (
                <div className="hidden w-20 shrink-0 sm:block">
                  <div className="h-1 overflow-hidden rounded-full bg-[#d7efe4]">
                    <div
                      className="h-full rounded-full bg-[#16a34a]"
                      style={{ width: `${depositPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-[#7b8494]">
                    {depositPercent}% of total
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-[#e4e9fb] bg-[#f7f8ff] px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[#3154d4]" aria-hidden />
            <p className="text-xs leading-relaxed text-[#3d4660]">
              {booking.paymentStatus === "PAID" ? (
                "This booking is settled."
              ) : booking.paymentStatus === "DEPOSIT" ? (
                <>
                  Deposit received. {formatRand(balanceCents)} remains before delivery.
                </>
              ) : (
                <>
                  A {depositPercent}% deposit holds the collection slot. The remaining{" "}
                  {formatRand(balanceCents)} is due before delivery.
                </>
              )}
            </p>
          </div>

          <Suspense fallback={null}>
            <CheckoutReturnNotice />
          </Suspense>

          {booking.paymentStatus === "UNPAID" && !authReady ? (
            <p className="rounded-lg border border-[#e8edf5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5c6578]">
              Checking your account before showing pay options…
            </p>
          ) : null}

          {booking.paymentStatus === "UNPAID" &&
          authReady &&
          clientOwnsBooking(user, booking) ? (
            <div className="rounded-lg border border-[#e8edf5] p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
                <PayButton
                  bookingId={booking.id}
                  amountCents={depositCents}
                  kind="DEPOSIT"
                  onPaid={() => void refresh()}
                />
                <dl className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3 text-[#5c6578]">
                    <dt className="flex items-center gap-1.5">
                      <Wallet className="size-3.5 text-[#8b93a7]" aria-hidden />
                      Total
                    </dt>
                    <dd className="font-medium tabular-nums text-[#172033]">
                      {formatRand(amountDueCents)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[#5c6578]">
                    <dt className="flex items-center gap-1.5">
                      <Coins className="size-3.5 text-[#8b93a7]" aria-hidden />
                      Deposit
                    </dt>
                    <dd className="font-medium tabular-nums text-[#172033]">
                      {formatRand(depositCents)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[#5c6578]">
                    <dt className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#8b93a7]" aria-hidden />
                      Remaining
                    </dt>
                    <dd className="font-medium tabular-nums text-[#172033]">
                      {formatRand(balanceCents)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {booking.paymentStatus === "DEPOSIT" &&
          clientOwnsBooking(user, booking) &&
          balanceAmountCents(booking) > 0 ? (
            <div className="rounded-lg border border-[#e8edf5] p-3">
              <PayButton
                bookingId={booking.id}
                amountCents={balanceAmountCents(booking)}
                kind="BALANCE"
                onPaid={() => void refresh()}
              />
            </div>
          ) : null}

          {booking.paymentStatus === "UNPAID" &&
          authReady &&
          !clientOwnsBooking(user, booking) ? (
            <p className="rounded-lg border border-[#f3c9c9] bg-[#fff5f5] px-3 py-2 text-xs text-[#b42318]">
              {user
                ? "This unpaid booking is not linked to your account, so pay is hidden. Open a booking you own (same email / My Bookings), or ask ops to link it."
                : "Sign in with the client account that owns this booking to pay the deposit."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
