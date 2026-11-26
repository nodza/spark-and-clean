"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SignInLockNotice, useSignInLock } from "@/components/auth/SignInLock";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginUser } from "@/lib/authClient";
import {
  passwordChangePathForRole,
  resolvePostLoginPath,
} from "@/lib/accessControl";

function WorkshopLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const emailFromQuery = searchParams.get("email") || "";
  const { user, ready, refresh } = useAuth();
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { locked, remainingLabel, startLock } = useSignInLock();

  useEffect(() => {
    if (ready && user?.role === "workshop") {
      router.replace(
        user.mustChangePassword
          ? passwordChangePathForRole("workshop") || "/workshop/change-password"
          : resolvePostLoginPath("workshop", next)
      );
    }
  }, [ready, user, router, next]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (locked) return;
    setError(null);
    setLoading(true);
    const result = await loginUser({ email, password, role: "workshop" });
    if (result.retryAfterSeconds) {
      setLoading(false);
      startLock(result.retryAfterSeconds);
      return;
    }
    if (result.error || !result.user) {
      setLoading(false);
      setError(result.error || "Login failed");
      return;
    }
    if (result.user.mustChangePassword) {
      router.replace("/workshop/change-password");
      return;
    }
    await refresh();
    setLoading(false);
    router.replace(resolvePostLoginPath(result.user.role, next));
  };

  return (
    <AuthLayout
      portalLabel="WORKSHOP"
      tagline={
        <>
          Every rug accounted for.{" "}
          <span style={{ color: "#ffdc39" }}>Every hand on record.</span>
        </>
      }
      subtext="Sign in with the individual account provided by your administrator."
    >
      <h1 className="text-page-title text-navy">Workshop log in</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Use your workshop email and password.
      </p>
      <form onSubmit={(event) => void handleLogin(event)} className="mt-[22px]">
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">EMAIL</span>
          <Input
            id="workshop-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            required
          />
        </label>
        <div className="mt-4 mb-2 flex items-center justify-between">
          <label htmlFor="workshop-password" className="text-eyebrow text-grey-600">
            PASSWORD
          </label>
          <Link
            href={`/forgot-password?from=workshop${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
            className="text-[12px] font-bold text-green hover:text-navy"
          >
            Forgot?
          </Link>
        </div>
        <PasswordInput
          id="workshop-password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(error)}
          required
          minLength={6}
        />
        {locked ? <SignInLockNotice /> : null}
        {!locked && error ? (
          <div
            role="alert"
            className="mt-3.5 rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
          >
            {error}
          </div>
        ) : null}
        <Button
          type="submit"
          className="mt-5 w-full justify-center py-[14px]"
          disabled={loading || locked}
        >
          {locked
            ? `Try again in ${remainingLabel}`
            : loading
              ? "Signing in…"
              : "Continue to workshop"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function WorkshopLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WorkshopLoginForm />
    </Suspense>
  );
}
