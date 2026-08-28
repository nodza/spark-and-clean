"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, UserPlus, Eye, LogIn } from "lucide-react";
import { continueAsGuest, registerUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";

type BookingSuccessPanelProps = {
  bookingId: string;
  email: string;
  name?: string;
  phone?: string;
};

/**
 * Post-submission: track as guest, sign in, or register with checkout details.
 */
export function BookingSuccessPanel({
  bookingId,
  email,
  name = "",
  phone = "",
}: BookingSuccessPanelProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const goSignIn = () => {
    router.push(`/login?next=/booking/${bookingId}`);
  };

  const trackAsGuest = async () => {
    setError(null);
    if (!email.trim()) {
      setError("No checkout email found. Go back and add your email in Step 3.");
      return;
    }

    setGuestLoading(true);
    const result = await continueAsGuest({
      email: email.trim().toLowerCase(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      bookingId,
    });
    setGuestLoading(false);

    if (result.error || !result.user) {
      setError(result.error || "Could not continue as guest");
      return;
    }

    await refresh();
    router.push(`/booking/${bookingId}`);
  };

  const registerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("No checkout email found. Go back and add your email in Step 3.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setRegistering(true);
    const result = await registerUser({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    if (result.error) {
      setRegistering(false);
      if (result.error.toLowerCase().includes("already")) {
        setError("Account exists — sign in to view this booking.");
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
        <p className="mt-4 text-sm text-muted-foreground">Your booking reference</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-primary">
          {bookingId}
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              Continue as guest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              View this booking&apos;s status without creating a password account.
              We&apos;ll use <strong>{email || "your checkout email"}</strong>.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void trackAsGuest()}
              disabled={guestLoading}
            >
              {guestLoading ? "Opening…" : "Track Booking as Guest"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <LogIn className="h-5 w-5 text-primary" />
              Already have an account?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with <strong>{email || "your checkout email"}</strong> to track
              this booking.
            </p>
            <Button type="button" variant="outline" className="w-full" onClick={goSignIn}>
              Sign in to track booking
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-primary" />
              Create an account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void registerAccount(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We&apos;ll save your checkout name and phone with your account.
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
                  minLength={6}
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
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={registering}>
                {registering ? "Creating account…" : "Register & track booking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
