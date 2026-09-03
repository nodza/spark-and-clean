"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { registerUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

type ConvertAccountFormProps = {
  defaultEmail?: string;
  defaultName?: string;
  defaultPhone?: string;
  bookingId?: string;
  emailLocked?: boolean;
  /** Where to go after a successful convert. Defaults to the booking or /dashboard. */
  successHref?: string;
  variant?: "page" | "card";
  className?: string;
  onSuccess?: () => void;
};

export function ConvertAccountForm({
  defaultEmail = "",
  defaultName = "",
  defaultPhone = "",
  bookingId,
  emailLocked = false,
  successHref,
  variant = "page",
  className,
  onSuccess,
}: ConvertAccountFormProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginHref = `/login?${new URLSearchParams({
    email: email.trim().toLowerCase(),
    ...(bookingId ? { next: `/booking/${bookingId}` } : {}),
  }).toString()}`;

  const afterHref =
    successHref || (bookingId ? `/booking/${bookingId}` : "/dashboard");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAccountExists(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
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

    setLoading(true);
    const result = await registerUser({
      email: trimmedEmail,
      password,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setLoading(false);

    if (result.code === "ACCOUNT_EXISTS") {
      setAccountExists(true);
      setError(
        "An account with this email already exists. Log in to attach this booking."
      );
      return;
    }

    if (result.error || !result.user) {
      setError(result.error || "Could not create your account.");
      return;
    }

    await refresh();
    onSuccess?.();
    router.push(afterHref);
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn(variant === "page" ? "mt-[22px]" : "space-y-4", className)}
    >
      <label className="flex flex-col gap-2">
        <span className="text-eyebrow text-grey-600">FULL NAME</span>
        <Input
          id="convert-name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>

      <label className={cn("flex flex-col gap-2", variant === "page" && "mt-4")}>
        <span className="text-eyebrow text-grey-600">PHONE</span>
        <Input
          id="convert-phone"
          type="tel"
          autoComplete="tel"
          placeholder="082 123 4567"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>

      <label className={cn("flex flex-col gap-2", variant === "page" && "mt-4")}>
        <span className="text-eyebrow text-grey-600">EMAIL</span>
        <Input
          id="convert-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          readOnly={emailLocked}
          className={emailLocked ? "bg-rule" : undefined}
          onChange={(e) => {
            if (emailLocked) return;
            setEmail(e.target.value);
            setAccountExists(false);
            if (error) setError(null);
          }}
          required
        />
      </label>

      <label className={cn("flex flex-col gap-2", variant === "page" && "mt-4")}>
        <span className="text-eyebrow text-grey-600">PASSWORD</span>
        <PasswordInput
          id="convert-password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          required
          minLength={6}
        />
      </label>

      <label className={cn("flex flex-col gap-2", variant === "page" && "mt-4")}>
        <span className="text-eyebrow text-grey-600">CONFIRM PASSWORD</span>
        <PasswordInput
          id="convert-password-confirm"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (error) setError(null);
          }}
          required
          minLength={6}
        />
      </label>

      {error && (
        <div
          role="alert"
          className={cn(
            "rounded-[10px] border-[1.5px] px-3 py-2.5 text-[12.5px]",
            variant === "page" ? "mt-3.5" : "mt-1",
            accountExists
              ? "border-line bg-rule text-navy"
              : "border-[#f2b8b0] bg-[#fdecea] text-[#b3261e]"
          )}
        >
          <p>{error}</p>
          {accountExists && (
            <Link
              href={loginHref}
              className="mt-2 inline-block font-extrabold text-green hover:text-navy"
            >
              Log in to attach this booking
            </Link>
          )}
        </div>
      )}

      <Button
        type="submit"
        className={cn(
          "w-full justify-center py-[14px]",
          variant === "page" ? "mt-5" : "mt-2"
        )}
        disabled={loading}
      >
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
