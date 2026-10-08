"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientBookingDetail } from "@/components/booking/ClientBookingDetail";
import { ClientPortalShell } from "@/components/portal/ClientPortalShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBookingLiveTracking } from "@/hooks/useBookingLiveTracking";
import { isPersistedClient } from "@/types/user";

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
    refresh,
  } = useBookingLiveTracking(id, authReady);

  const frame = (children: ReactNode) =>
    signedInClient ? (
      <ClientPortalShell>
        <div className="min-h-full bg-[#f5f7fa]">{children}</div>
      </ClientPortalShell>
    ) : (
      <div className="min-h-screen bg-[#f5f7fa]">{children}</div>
    );

  if (loading && !booking) {
    return frame(
      <div className="px-4 py-16 sm:py-20">
        <div
          className="flex flex-col items-center justify-center gap-3 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#000b49]" aria-hidden />
          <h1 className="text-xl font-extrabold text-[#000b49] sm:text-2xl">Loading…</h1>
          <p className="text-sm text-[#6b7280]">Fetching the latest status for your booking.</p>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return frame(
      <div className="px-4 py-16 text-center sm:py-20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdecec]">
          <ShieldAlert className="h-6 w-6 text-[#b33232]" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-extrabold text-[#000b49] sm:text-2xl">Access denied</h1>
        <p className="mx-auto mb-6 max-w-lg text-sm text-[#6b7280]">
          This booking belongs to another account. Sign in with the email used at checkout to
          view it, or open the booking ID from the confirmation email while logged out.
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
    return frame(
      <div className="px-4 py-16 text-center sm:py-20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f2f6]">
          <AlertCircle className="h-6 w-6 text-[#9aa0a6]" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-extrabold text-[#000b49] sm:text-2xl">Booking not found</h1>
        <p className="mx-auto mb-6 max-w-lg text-sm text-[#6b7280]">
          We couldn&apos;t find a booking with this ID. Check the reference from your confirmation
          and try again.
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

  return frame(
    <ClientBookingDetail
      booking={booking}
      signedInClient={signedInClient}
      user={user}
      error={error}
      onRefresh={() => void refresh()}
    />
  );
}
