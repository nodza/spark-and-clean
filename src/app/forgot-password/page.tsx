"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/authClient";

function loginHref(from: string | null) {
  if (from === "tech") return "/tech";
  return "/login";
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const emailFromQuery = searchParams.get("email") || "";
  const backHref = useMemo(() => loginHref(from), [from]);

  const [email, setEmail] = useState(emailFromQuery);
  const [sent, setSent] = useState(false);
  const [shownEmail, setShownEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(trimmed);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setShownEmail(trimmed);
    setSent(true);
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
      subtext="Reset access for client, technician, and operations accounts."
    >
      {sent ? (
        <div className="text-center">
          <div
            className="mx-auto flex size-[72px] items-center justify-center rounded-full"
            style={{ background: "#eafaf5" }}
          >
            <Mail className="size-8 text-green" strokeWidth={1.8} />
          </div>
          <h1 className="text-page-title mt-[22px] text-navy">
            Check your inbox
          </h1>
          <p className="text-body mt-[11px] leading-relaxed text-grey-600">
            If an account exists for{" "}
            <span className="font-bold text-navy">{shownEmail}</span>, we&apos;ve
            sent a reset link. It expires in 60 minutes.
          </p>
          <Button asChild className="mt-[26px] w-full justify-center py-[14px]">
            <Link href={backHref}>Back to log in</Link>
          </Button>
          <button
            type="button"
            className="mt-5 text-[13px] font-bold text-green hover:text-navy"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div>
          <Link
            href={backHref}
            className="mb-4 inline-block text-[13px] font-bold text-green hover:text-navy"
          >
            ← Back to log in
          </Link>
          <h1 className="text-page-title text-navy">Reset your password</h1>
          <p className="text-body mt-[9px] leading-relaxed text-grey-600">
            Enter the email on your account and we&apos;ll send a reset link.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6">
            <label className="flex flex-col gap-2">
              <span className="text-eyebrow text-grey-600">EMAIL</span>
              <Input
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
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </div>
      )}
    </AuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-grey-600">
          Loading…
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
