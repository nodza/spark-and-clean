"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

const DEMO_EMAIL = "sarah.j@example.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export default function ClientLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Phase 1 mock auth — password/OTP/backend is stubbed for E6 / Phase 2
    localStorage.setItem("clientEmail", trimmed.toLowerCase());
    router.push("/dashboard");
  };

  return (
    <div className="container flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Enter your email to view your bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                autoComplete="email"
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : "email-hint"}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
              />
              {error ? (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full">
              View My Bookings
            </Button>
            <div id="email-hint" className="text-center text-sm text-muted-foreground mt-4">
              <p>
                Demo hint: use <strong>{DEMO_EMAIL}</strong> to view sample bookings.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
