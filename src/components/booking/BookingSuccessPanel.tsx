"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, UserPlus, Eye } from "lucide-react";

type BookingSuccessPanelProps = {
  bookingId: string;
  email: string;
};

/**
 * Post-submission panel: track as guest or register with checkout email (E6 stub).
 */
export function BookingSuccessPanel({ bookingId, email }: BookingSuccessPanelProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const trackAsGuest = () => {
    router.push(`/booking/${bookingId}`);
  };

  const registerAccount = (e: React.FormEvent) => {
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

    // Phase 1 stub for E6 authentication — credentials map to Step 3 email
    try {
      localStorage.setItem("clientEmail", email.trim().toLowerCase());
      localStorage.setItem(
        "clientAccount",
        JSON.stringify({
          email: email.trim().toLowerCase(),
          registeredAt: new Date().toISOString(),
          linkedBookingId: bookingId,
          // Password not stored in plaintext in production; stub only for Phase 1 demo
          passwordSet: true,
        })
      );
      router.push("/dashboard");
    } catch {
      setError("Could not create account. Please try again.");
      setRegistering(false);
    }
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Booking confirmed</h1>
        <p className="mt-2 text-muted-foreground">
          Thanks — we&apos;ve received your collection request.
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
              Track as guest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              View this booking&apos;s status without creating an account.
            </p>
            <Button type="button" variant="outline" className="w-full" onClick={trackAsGuest}>
              Track Booking as Guest
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
            <form onSubmit={registerAccount} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Save your details to track booking history. Your account email is the one you
                entered at checkout.
              </p>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={email || ""}
                  readOnly
                  className="bg-muted"
                  aria-describedby="register-email-help"
                />
                <p id="register-email-help" className="text-xs text-muted-foreground">
                  From Step 3 contact details
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
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
                <Input
                  id="register-password-confirm"
                  type="password"
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
                {registering ? "Creating account…" : "Register Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
