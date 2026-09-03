"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvertAccountForm } from "@/components/auth/ConvertAccountForm";
import { claimBooking } from "@/lib/authClient";
import type { AuthUser } from "@/lib/authClient";
import { isPersistedClient } from "@/types/user";
import { UserPlus } from "lucide-react";

type SaveBookingAccountCardProps = {
  bookingId: string;
  email: string;
  name?: string;
  phone?: string;
  userId?: string;
  user: AuthUser | null;
  onClaimed: () => Promise<void> | void;
};

export function SaveBookingAccountCard({
  bookingId,
  email,
  name,
  phone,
  userId,
  user,
  onClaimed,
}: SaveBookingAccountCardProps) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const emailNorm = email.trim().toLowerCase();
  const fullClient = isPersistedClient(user);
  const emailMatches =
    fullClient && user!.email.toLowerCase() === emailNorm;
  const alreadyOwned = Boolean(userId && fullClient && userId === user!.id);
  const unclaimed = !userId;

  if (alreadyOwned || claimed) return null;

  if (fullClient && emailMatches && unclaimed) {
    const handleClaim = async () => {
      setError(null);
      setClaiming(true);
      const result = await claimBooking(bookingId);
      setClaiming(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setClaimed(true);
      await onClaimed();
    };

    return (
      <Card className="mb-6 sm:mb-8 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <UserPlus className="h-5 w-5 text-primary shrink-0" aria-hidden />
            Save this booking to your account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This collection is still a guest booking. Attach it (and any other
            unclaimed bookings for {emailNorm}) without changing the booking ID.
          </p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="button"
            className="w-full min-h-11 sm:w-auto"
            onClick={() => void handleClaim()}
            disabled={claiming}
          >
            {claiming ? "Attaching…" : "Attach to my account"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (fullClient) return null;

  const loginHref = `/login?${new URLSearchParams({
    email: emailNorm,
    next: `/booking/${bookingId}`,
  }).toString()}`;

  return (
    <Card className="mb-6 sm:mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <UserPlus className="h-5 w-5 text-primary shrink-0" aria-hidden />
          Save this booking to an account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create a client password to keep this booking on your account. If you
          already registered with {emailNorm},{" "}
          <Link
            href={loginHref}
            className="font-medium text-green underline-offset-2 hover:underline"
          >
            log in
          </Link>{" "}
          and we&apos;ll offer to attach it.
        </p>
        <ConvertAccountForm
          variant="card"
          defaultEmail={emailNorm}
          defaultName={name}
          defaultPhone={phone}
          bookingId={bookingId}
          emailLocked
          onSuccess={() => void onClaimed()}
        />
      </CardContent>
    </Card>
  );
}
