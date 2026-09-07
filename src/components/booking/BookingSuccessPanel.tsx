"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package, UserPlus } from "lucide-react";
import { continueAsGuest, registerUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordRules";

type BookingSuccessPanelProps = {
  bookingId: string;
  email: string;
  name?: string;
  phone?: string;
};

/**
 * Post-booking confirmation — same card UI pattern as real-time tracking branch.
 * Track now / sign in later = one guest path (email only). Create account = password.
 * Provisional CTA copy — Noel to confirm before launch.
 */
export function BookingSuccessPanel({
  bookingId,
  email,
  name = "",
  phone = "",
}: BookingSuccessPanelProps) {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [tracking, setTracking] = useState(false);

  const checkoutEmail = email.trim().toLowerCase();
  const sessionMatchesCheckout =
    !!user &&
    user.role === "client" &&
    user.email.toLowerCase() === checkoutEmail;

  const trackMyOrder = async () => {
    setError(null);

    if (sessionMatchesCheckout) {
      router.push(`/booking/${bookingId}`);
      return;
    }

    if (!checkoutEmail) {
      setError("No checkout email found. Go back and add your email in Step 3.");
      return;
    }

    setTracking(true);
    const result = await continueAsGuest({
      email: checkoutEmail,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      bookingId,
    });
    setTracking(false);

    if (result.error || !result.user) {
      setError(result.error || "Could not open tracking");
      return;
    }

    await refresh();
    router.push(`/booking/${bookingId}`);
  };

  const registerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!checkoutEmail) {
      setError("No checkout email found. Go back and add your email in Step 3.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setRegistering(true);
    const result = await registerUser({
      email: checkoutEmail,
      password,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    if (result.error) {
      setRegistering(false);
      if (result.error.toLowerCase().includes("already")) {
        setError(
          "Account exists — use Track My Order with this email, or sign in from the header."
        );
        return;
      }
      setError(result.error);
      return;
    }

    await refresh();
    setRegistering(false);
    router.push(`/booking/${bookingId}`);
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Booking confirmed</h1>
        <p className="mt-2 text-muted-foreground">
          Thanks — we&apos;ve saved your collection request to our system.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Your booking ID</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-primary break-all">
          {bookingId}
        </p>
        {sessionMatchesCheckout ? (
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
              Track my order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save this booking ID, or come back later and sign in with{" "}
              <strong>{checkoutEmail || "the email you used at checkout"}</strong>
              . No password needed — track now or later with the same email.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => void trackMyOrder()}
              disabled={tracking || registering}
            >
              {tracking ? "Opening…" : "Track My Order"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-primary" aria-hidden />
              Create an account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => void registerAccount(e)}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Optional — set a password and we&apos;ll save your checkout name
                and phone with your account.
              </p>

              <div className="space-y-2">
                <Label htmlFor="register-name">Full name</Label>
                <Input
                  id="register-name"
                  type="text"
                  value={name || ""}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-phone">Phone</Label>
                <Input
                  id="register-phone"
                  type="tel"
                  value={phone || ""}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={email || ""}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <PasswordInput
                  id="register-password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password-confirm">Confirm password</Label>
                <PasswordInput
                  id="register-password-confirm"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={registering || tracking}
              >
                {registering ? "Creating account…" : "Register & track booking"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <p className="text-sm text-destructive text-center" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
