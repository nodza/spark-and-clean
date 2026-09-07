"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { FieldError } from "@/components/booking/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { registerUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  sanitizePhoneInput,
  validateCustomerName,
  validateEmail,
  validateSaPhone,
  type FieldErrors,
} from "@/lib/bookingValidation";
import {
  validatePasswordConfirm,
  validatePasswordNotEmail,
  validatePasswordStrength,
} from "@/lib/passwordRules";

type SignupField = "name" | "email" | "phone" | "password" | "confirmPassword";

function validateSignupForm(form: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  const nameErr = validateCustomerName(form.name);
  if (nameErr) errors.name = nameErr;

  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validateSaPhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  const passwordErr =
    validatePasswordStrength(form.password) ||
    validatePasswordNotEmail(form.password, form.email);
  if (passwordErr) errors.password = passwordErr;

  const confirmErr = validatePasswordConfirm(
    form.password,
    form.confirmPassword
  );
  if (confirmErr) errors.confirmPassword = confirmErr;

  return errors;
}

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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<SignupField, boolean>>>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const markTouched = (field: SignupField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const clearFieldError = (field: SignupField) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (formError) setFormError(null);
  };

  const update = (field: SignupField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  };

  const liveError = (field: SignupField, validator: () => string | null) =>
    touched[field] || errors[field] ? errors[field] || validator() : null;

  const nameError = liveError("name", () => validateCustomerName(form.name));
  const emailError = liveError("email", () => validateEmail(form.email));
  const phoneError = liveError("phone", () => validateSaPhone(form.phone));
  const passwordError = liveError(
    "password",
    () =>
      validatePasswordStrength(form.password) ||
      validatePasswordNotEmail(form.password, form.email)
  );
  const confirmError = liveError("confirmPassword", () =>
    validatePasswordConfirm(form.password, form.confirmPassword)
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validateSignupForm(form);
    setErrors(nextErrors);
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const result = await registerUser({
      name: form.name.trim().replace(/\s+/g, " "),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
    });
    if (result.error || !result.user) {
      setLoading(false);
      const message = result.error || "Could not create your account.";
      const lower = message.toLowerCase();

      if (lower.includes("already exists")) {
        setFormError("An account already exists. Please log in instead.");
        return;
      }
      if (lower.includes("name")) {
        setErrors({ name: message });
        return;
      }
      if (lower.includes("phone") || lower.includes("mobile")) {
        setErrors({ phone: message });
        return;
      }
      if (lower.includes("email")) {
        setErrors({ email: message });
        return;
      }
      if (lower.includes("confirm") || lower.includes("match")) {
        setErrors({ confirmPassword: message });
        return;
      }
      if (lower.includes("password")) {
        setErrors({ password: message });
        return;
      }

      setFormError(message);
      return;
    }

    await refresh();
    router.push("/portal");
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
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-navy">
        Create your account
      </h1>
      <p className="mt-[9px] text-[14.5px] font-medium leading-[1.55] text-grey-600">
        Book collections and track cleans in one place.
      </p>

      <form
        onSubmit={(event) => void submit(event)}
        className="mt-[24px] space-y-[14px]"
        noValidate
      >
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">
            FULL NAME
          </span>
          <Input
            type="text"
            autoComplete="name"
            placeholder="Nomsa Khumalo"
            value={form.name}
            aria-invalid={Boolean(nameError) || undefined}
            aria-describedby={nameError ? "signup-name-error" : "signup-name-hint"}
            onBlur={() => markTouched("name")}
            onChange={(event) => update("name", event.target.value)}
            required
          />
          {nameError && (
            <FieldError id="signup-name-error" message={nameError} />
          )}
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">
            EMAIL
          </span>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            aria-invalid={Boolean(emailError) || undefined}
            aria-describedby={emailError ? "signup-email-error" : undefined}
            onBlur={() => markTouched("email")}
            onChange={(event) => update("email", event.target.value)}
            required
          />
          <FieldError id="signup-email-error" message={emailError} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">
            MOBILE
          </span>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="082 000 0000"
            value={form.phone}
            aria-invalid={Boolean(phoneError) || undefined}
            aria-describedby={
              phoneError ? "signup-phone-error" : "signup-phone-hint"
            }
            onBlur={() => markTouched("phone")}
            onChange={(event) =>
              update("phone", sanitizePhoneInput(event.target.value))
            }
            required
          />
          {phoneError && (
            <FieldError id="signup-phone-error" message={phoneError} />
          )}
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">
            PASSWORD
          </span>
          <PasswordInput
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            aria-invalid={Boolean(passwordError) || undefined}
            aria-describedby={
              passwordError ? "signup-password-error" : undefined
            }
            onBlur={() => markTouched("password")}
            onChange={(event) => update("password", event.target.value)}
            minLength={8}
            required
          />
          <FieldError id="signup-password-error" message={passwordError} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-grey-600">
            CONFIRM PASSWORD
          </span>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Confirm password"
            value={form.confirmPassword}
            aria-invalid={Boolean(confirmError) || undefined}
            aria-describedby={
              confirmError ? "signup-confirm-error" : undefined
            }
            onBlur={() => markTouched("confirmPassword")}
            onChange={(event) => update("confirmPassword", event.target.value)}
            minLength={8}
            required
          />
          <FieldError id="signup-confirm-error" message={confirmError} />
        </label>

        {formError ? (
          <div
            role="alert"
            className="rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
          >
            {formError}{" "}
            {formError.toLowerCase().includes("already exists") ? (
              <Link
                href="/login"
                className="font-extrabold underline underline-offset-2"
              >
                Log in
              </Link>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          className="mt-[6px] w-full justify-center rounded-full py-[14px] text-[14.5px] font-extrabold tracking-[-0.01em]"
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="mt-[14px] text-[11.5px] leading-[1.6] text-grey-400">
        By creating an account you agree to our Terms of Service and Privacy
        Policy.
      </div>

      <div className="mt-[20px] flex items-center gap-3">
        <div className="h-px flex-1 bg-[#eceef1]" />
        <span className="text-[12px] text-grey-400">or</span>
        <div className="h-px flex-1 bg-[#eceef1]" />
      </div>

      <p className="mt-[16px] text-center text-[13.5px] text-grey-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-extrabold text-green hover:text-navy"
        >
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
