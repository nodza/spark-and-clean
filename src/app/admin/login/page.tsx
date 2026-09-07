"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { loginUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { resolvePostLoginPath } from "@/lib/accessControl";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const emailFromQuery = searchParams.get("email") || "";
  const { user, ready, refresh } = useAuth();

  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (ready && user?.role === "admin") {
      router.replace(
        resolvePostLoginPath("admin", next, user.adminTier ?? null)
      );
    }
  }, [ready, user, router, next]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const result = await loginUser({
      email,
      password,
      role: "admin",
    });
    setLoading(false);

    if (result.error || !result.user) {
      setError(result.error || "Login failed");
      return;
    }

    await refresh();
    router.push(
      resolvePostLoginPath(
        result.user.role,
        next,
        result.user.adminTier ?? null
      )
    );
  };

  return (
    <AuthLayout
      portalLabel="OPERATIONS"
      tagline={
        <>
          Bookings, routes, and{" "}
          <span style={{ color: "#ffdc39" }}>facility status</span> in one
          place.
        </>
      }
      subtext="Sign in with your operations email and password."
    >
      <h1 className="text-page-title text-navy">Admin log in</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Use your staff email and password.
      </p>

      <form onSubmit={(e) => void handleLogin(e)} className="mt-[22px]">
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">EMAIL</span>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            placeholder="you@sparkandclean.co.za"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            required
          />
        </label>

        <div className="mt-4 mb-2 flex items-center justify-between">
          <label htmlFor="admin-password" className="text-eyebrow text-grey-600">
            PASSWORD
          </label>
          <Link
            href={`/forgot-password?from=admin${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
            className="text-[12px] font-bold text-green hover:text-navy"
          >
            Forgot?
          </Link>
        </div>
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
          required
          minLength={6}
        />

        {error ? (
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
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
