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
      tagline="A cleaner way to stay on top of every booking."
      subtext="Create your account to track collections, manage bookings and reorder past cleans."
    >
      <h1 className="text-page-title text-navy">Create your account</h1>
      <p className="text-body mt-[9px] text-grey-600">
        Join Spark &amp; Clean and keep your bookings in one place.
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-[22px] space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">FULL NAME</span>
          <Input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">EMAIL</span>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">PHONE</span>
          <Input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">PASSWORD</span>
          <PasswordInput
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow text-grey-600">CONFIRM PASSWORD</span>
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

        <Button type="submit" className="w-full justify-center py-[14px]" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-[22px] text-center text-[13.5px] text-grey-600">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-green hover:text-navy">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
