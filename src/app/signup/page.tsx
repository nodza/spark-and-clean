"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { registerUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.toLowerCase() === form.email.trim().toLowerCase()) {
      setError("Password must not be the same as your email.");
      return;
    }

    setLoading(true);
    const result = await registerUser(form);
    if (result.error || !result.user) {
      setLoading(false);
      setError(
        result.error?.toLowerCase().includes("already exists")
          ? "An account already exists. Please log in instead."
          : result.error || "Could not create your account."
      );
      return;
    }

    await refresh();
    router.push("/dashboard");
  };

  return (
    <AuthLayout
      portalLabel="CLIENT PORTAL"
      tagline={
        <>
          Cleaned in <span style={{ color: "#ffdc39" }}>7 minutes</span>. Booked in about the same.
        </>
      }
      subtext="Book collections, track your rugs and reorder past cleans across Gauteng and Cape Town."
    >
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-navy">Create your account</h1>
      <p className="mt-[9px] text-[14.5px] font-medium leading-[1.55] text-grey-600">
        Book collections and track cleans in one place.
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-[24px] space-y-[14px]">
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">FULL NAME</span>
          <Input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">EMAIL</span>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">MOBILE</span>
          <Input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">PASSWORD</span>
          <PasswordInput
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">CONFIRM PASSWORD</span>
          <PasswordInput
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            minLength={8}
            required
          />
        </label>

        {error ? (
          <div role="alert" className="rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="mt-[6px] w-full justify-center rounded-full py-[14px] text-[14.5px] font-extrabold tracking-[-0.01em]" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="mt-[16px] text-center text-[13.5px] leading-[1.6] text-grey-600">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </div>

      <div className="mt-[20px] flex items-center gap-3">
        <div className="h-px flex-1 bg-[#eceef1]" />
        <span className="text-[12px] text-grey-400">or</span>
        <div className="h-px flex-1 bg-[#eceef1]" />
      </div>

      <p className="mt-[14px] text-center text-[13.5px] text-grey-600">
        Already have an account? <Link href="/login" className="font-extrabold text-green hover:text-navy">Log in</Link>
      </p>
    </AuthLayout>
  );
}
