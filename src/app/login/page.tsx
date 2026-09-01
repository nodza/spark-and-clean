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
  if (role === "ADMIN") return "/admin";
  if (role === "DRIVER") return "/tech/dashboard";
  return "/dashboard";
}

type LoginMethod = "pwd" | "link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, ready, refresh } = useAuth();

  const [method, setMethod] = useState<LoginMethod>("pwd");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(redirectForRole(user.role, next));
    }
  }, [ready, user, router, next]);

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

    if (result.error || !result.user) {
      setError(result.error || "Login failed");
      return;
    }

    await refresh();
    router.push(redirectForRole(result.user.role, next));
  };

  const handleSendLink = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkSent(false);

    if (!email.trim()) {
      setError("Enter your email to receive a sign-in link.");
      return;
    }

    // Phase 1 stub — UI matches Auth.dc.html; magic-link API not wired yet
    setLinkSent(true);
  };

  return (
    <AuthLayout
      portalLabel="CLIENT PORTAL"
      tagline={
        <>
          Cleaned in{" "}
          <span style={{ color: "#ffdc39" }}>7 minutes</span>. Booked in about
          the same.
        </>
      }
      subtext="Book collections, track your rugs and reorder past cleans across Gauteng and Cape Town."
    >
      <h1 className="text-page-title text-navy">Welcome back</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Log in to manage your bookings.
      </p>

      {/* Password / Email link tabs */}
      <div className="mt-[26px] flex rounded-[10px] bg-rule p-1">
        <button
          type="button"
          onClick={() => {
            setMethod("pwd");
            setError(null);
            setLinkSent(false);
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
            setLinkSent(false);
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
              onChange={(e) => setEmail(e.target.value)}
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
                setError("Password reset is coming soon. Use your demo password for now.")
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
            onChange={(e) => setPassword(e.target.value)}
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
        <form onSubmit={handleSendLink} className="mt-[22px]">
          <label className="flex flex-col gap-2">
            <span className="text-eyebrow text-grey-600">EMAIL</span>
            <Input
              id="email-link"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              required
            />
          </label>
          <p className="mt-3 text-[13px] leading-relaxed text-grey-600">
            We&apos;ll email a secure one-time link. No password needed.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3.5 rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
            >
              {error}
            </div>
          )}

          {linkSent && !error && (
            <div className="mt-3.5 rounded-[10px] border-[1.5px] border-[#bfe9dc] bg-[#eafaf5] px-3 py-2.5 text-[12.5px] text-green">
              If an account exists for {email}, a sign-in link would be sent
              (demo stub).
            </div>
          )}

          <Button type="submit" className="mt-[18px] w-full justify-center py-[14px]">
            Send sign-in link
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
        <Link href="/register" className="font-extrabold text-green hover:text-navy">
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
