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

function TechLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const emailFromQuery = searchParams.get("email") || "";
  const { user, ready, refresh } = useAuth();
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const destination = resolvePostLoginPath("technician", next);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (ready && user?.role === "technician") {
      router.replace(destination);
    }
  }, [ready, user, router, destination]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginUser({
      email,
      password,
      role: "technician",
    });
    setLoading(false);
    if (result.error || !result.user) {
      setError(result.error || "Login failed");
      return;
    }
    await refresh();
    router.push(resolvePostLoginPath(result.user.role, next));
  };

  return (
    <AuthLayout
      portalLabel="TECHNICIAN"
      tagline={
        <>
          Jobs on the road.{" "}
          <span style={{ color: "#ffdc39" }}>Status in sync.</span>
        </>
      }
      subtext="Sign in to see today's collections and deliveries."
    >
      <h1 className="text-page-title text-navy">Technician log in</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Use your staff email and password.
      </p>

      <form onSubmit={(e) => void handleLogin(e)} className="mt-[22px]">
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">EMAIL</span>
          <Input
            id="driver-email"
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
          <label htmlFor="driver-password" className="text-eyebrow text-grey-600">
            PASSWORD
          </label>
          <Link
            href={`/forgot-password?from=tech${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
            className="text-[12px] font-bold text-green hover:text-navy"
          >
            Forgot?
          </Link>
        </div>
        <PasswordInput
          id="driver-password"
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
          {loading ? "Signing in…" : "Continue to jobs"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function TechLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <TechLoginForm />
    </Suspense>
  );
}
