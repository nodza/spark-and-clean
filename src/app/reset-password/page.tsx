"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordRules";
import { resetPasswordWithToken, validateResetToken } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { refresh } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!token) {
        setChecking(false);
        setTokenValid(false);
        setError(
          "This reset link is invalid or has expired. Request a new link."
        );
        return;
      }

      setChecking(true);
      const result = await validateResetToken(token);
      if (cancelled) return;
      setChecking(false);
      setTokenValid(result.valid);
      if (!result.valid) {
        setError(
          result.error ||
            "This reset link is invalid or has expired. Request a new link."
        );
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await resetPasswordWithToken({
      token,
      password,
      confirmPassword,
    });
    setLoading(false);

    if (result.error || !result.user) {
      const message =
        result.error ||
        "This reset link is invalid or has expired. Request a new link.";
      setError(message);
      if (/invalid or has expired/i.test(message)) {
        setTokenValid(false);
      }
      return;
    }

    await refresh();
    router.replace(result.homePath || "/login");
  };

  return (
    <AuthLayout
      portalLabel="ACCOUNT"
      tagline={
        <>
          Cleaned in <span style={{ color: "#ffdc39" }}>7 minutes</span>. Booked
          in about the same.
        </>
      }
      subtext="Choose a new password to get back into your account."
    >
      {checking ? (
        <p className="text-body text-grey-600">Checking your reset link…</p>
      ) : !tokenValid ? (
        <div>
          <h1 className="text-page-title text-navy">Link not valid</h1>
          <p className="text-body mt-[9px] leading-relaxed text-grey-600">
            {error ||
              "This reset link is invalid or has expired. Request a new link."}
          </p>
          <Button asChild className="mt-5 w-full justify-center py-[14px]">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <p className="mt-5 text-center text-[13px]">
            <Link
              href="/login"
              className="font-bold text-green hover:text-navy"
            >
              ← Back to log in
            </Link>
          </p>
        </div>
      ) : (
        <div>
          <Link
            href="/login"
            className="mb-4 inline-block text-[13px] font-bold text-green hover:text-navy"
          >
            ← Back to log in
          </Link>
          <h1 className="text-page-title text-navy">Choose a new password</h1>
          <p className="text-body mt-[9px] leading-relaxed text-grey-600">
            Use at least {MIN_PASSWORD_LENGTH} characters. Your role stays the
            same after reset.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6">
            <label className="flex flex-col gap-2">
              <span className="text-eyebrow text-grey-600">NEW PASSWORD</span>
              <PasswordInput
                autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={Boolean(error)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </label>

            <label className="mt-4 flex flex-col gap-2">
              <span className="text-eyebrow text-grey-600">
                CONFIRM PASSWORD
              </span>
              <PasswordInput
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={Boolean(error)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </label>

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
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        </div>
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-grey-600">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
