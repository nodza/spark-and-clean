"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isPersistedClient } from "@/types/user";

type BookingSuccessPanelProps = {
  bookingId: string;
  email: string;
  name?: string;
  phone?: string;
};

/**
 * Post-booking confirmation. Guests track by booking ID with no session.
 * Convert-to-account is on the tracking page (password, not magic link).
 */
export function BookingSuccessPanel({
  bookingId,
  email,
}: BookingSuccessPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const checkoutEmail = email.trim().toLowerCase();
  const signedInOwner =
    isPersistedClient(user) &&
    user!.email.toLowerCase() === checkoutEmail;

  return (
    <div className="container mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Booking confirmed</h1>
        <p className="mt-2 text-muted-foreground">
          Thanks — we&apos;ve saved your collection request. Keep this booking ID
          to track status anytime.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Your booking ID</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-primary break-all">
          {bookingId}
        </p>
        {signedInOwner ? (
          <p className="mt-4 text-sm text-foreground">
            You&apos;re signed in with this email — this booking is already on{" "}
            <Link
              href="/dashboard"
              className="font-medium underline underline-offset-2"
            >
              My Bookings
            </Link>
            .
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" aria-hidden />
              Track booking as guest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No account needed. Open live status with this booking ID. You will
              not be signed in, and you will not see anyone else&apos;s history.
            </p>
            <Button
              type="button"
              className="w-full min-h-11"
              onClick={() => router.push(`/booking/${bookingId}`)}
            >
              Track Booking as Guest
            </Button>
          </CardContent>
        </Card>

        {!signedInOwner && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-primary" aria-hidden />
                Save this booking to an account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Optional — create a password later and we&apos;ll attach every
                unclaimed booking for{" "}
                <strong>
                  {checkoutEmail || "the email you used at checkout"}
                </strong>
                . Your booking ID stays the same.
              </p>
              <Button asChild variant="outline" className="w-full min-h-11">
                <Link href={`/booking/${bookingId}`}>Create a password</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
