"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { loginUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

function redirectForRole(role: string, next?: string | null) {
  if (next && next.startsWith("/")) return next;
  if (role === "admin") return "/admin";
  if (role === "technician") return "/tech/dashboard";
  return "/dashboard";
}

type LoginMethod = "pwd" | "link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const emailFromQuery = searchParams.get("email") || "";
  const { user, ready, refresh } = useAuth();

  const [method, setMethod] = useState<LoginMethod>("pwd");
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (ready && user) {
      router.replace(redirectForRole(user.role, next));
    }
  }, [ready, user, router, next]);

  const completeLogin = async (result: Awaited<ReturnType<typeof loginUser>>) => {
    if (result.requiresPassword) {
      setMethod("pwd");
      setError("Enter your staff password to continue.");
      return;
    }

    if (result.error || !result.user) {
      setError(result.error || "Login failed");
      return;
    }

    await refresh();
    router.push(redirectForRole(result.user.role, next));
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const result = await loginUser({ email, password });
    setLoading(false);
    await completeLogin(result);
  };

  const handleEmailOnlyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email to continue.");
      return;
    }

    setLoading(true);
    // Customers / guests: email-only. Staff accounts return requiresPassword.
    const result = await loginUser({ email });
    setLoading(false);
    await completeLogin(result);
  };

  return (
    <AuthLayout
      portalLabel="CLIENT PORTAL"
      tagline={
        <>
          Cleaned in <span style={{ color: "#ffdc39" }}>7 minutes</span>. Booked
          in about the same.
        </>
      }
      subtext="Book collections, track your rugs and reorder past cleans across Gauteng and Cape Town."
    >
      <h1 className="text-page-title text-navy">Welcome back</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Log in to manage your bookings.
      </p>

      <div className="mt-[26px] flex rounded-[10px] bg-rule p-1">
        <button
          type="button"
          onClick={() => {
            setMethod("pwd");
            setError(null);
          }}
          className={cn(
            "flex-1 cursor-pointer rounded-[7px] py-2.5 text-center text-[13px] font-bold transition-all duration-150",
            method === "pwd"
              ? "bg-white text-navy shadow-[0_1px_4px_rgba(0,11,73,0.12)]"
              : "bg-transparent text-grey-400"
          )}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod("link");
            setError(null);
            setPassword("");
          }}
          className={cn(
            "flex-1 cursor-pointer rounded-[7px] py-2.5 text-center text-[13px] font-bold transition-all duration-150",
            method === "link"
              ? "bg-white text-navy shadow-[0_1px_4px_rgba(0,11,73,0.12)]"
              : "bg-transparent text-grey-400"
          )}
        >
          Email link
        </button>
      </div>

      {method === "pwd" ? (
        <form
          onSubmit={(e) => void handlePasswordLogin(e)}
          className="mt-[22px]"
        >
          <label className="flex flex-col gap-2">
            <span className="text-eyebrow text-grey-600">EMAIL</span>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
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
            <label htmlFor="password" className="text-eyebrow text-grey-600">
              PASSWORD
            </label>
            <button
              type="button"
              className="text-[12px] font-bold text-green hover:text-navy"
              onClick={() =>
                setError(
                  "Password reset is coming soon. Use your staff password for now."
                )
              }
            >
              Forgot?
            </button>
          </div>
          <PasswordInput
            id="password"
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

          {error && (
            <div
              role="alert"
              className="mt-3.5 rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="mt-5 w-full justify-center py-[14px]"
            disabled={loading}
          >
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => void handleEmailOnlyLogin(e)}
          className="mt-[22px]"
        >
          <label className="flex flex-col gap-2">
            <span className="text-eyebrow text-grey-600">EMAIL</span>
            <Input
              id="email-link"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={Boolean(error)}
              required
            />
          </label>
          <p className="mt-3 text-[13px] leading-relaxed text-grey-600">
            Continue with your email — no password needed for customer
            accounts.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3.5 rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="mt-[18px] w-full justify-center py-[14px]"
            disabled={loading}
          >
            {loading ? "Continuing…" : "Continue with email"}
          </Button>
        </form>
      )}

      <div className="my-[22px] flex items-center gap-3">
        <div className="h-px flex-1 bg-[#eceef1]" />
        <span className="text-[12px] text-grey-400">or</span>
        <div className="h-px flex-1 bg-[#eceef1]" />
      </div>

      <p className="text-center text-[13.5px] text-grey-600">
        New to Spark &amp; Clean?{" "}
        <Link
          href="/signup"
          className="font-extrabold text-green hover:text-navy"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ClientLogin() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-grey-600">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
