"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  KeyRound,
  Mail,
  Phone,
  Plus,
  ShieldOff,
  Truck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { FieldError } from "@/components/booking/FieldError";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBookingStore } from "@/store/useBookingStore";
import {
  sanitizePhoneInput,
  validateCustomerName,
  validateEmail,
  validateSaPhone,
  type FieldErrors,
} from "@/lib/bookingValidation";
import { localCalendarDate } from "@/lib/localCalendarDate";
import { countTechnicianJobsOnDay } from "@/lib/technicianJobs";

type TechnicianRow = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  driverProfileId?: string;
  vehicle?: string | null;
  driverIsActive?: boolean | null;
  disabledAt?: string | null;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
};

type TechFormField = "name" | "phone" | "email";

function assignmentBadge(driverIsActive: boolean | null | undefined) {
  if (driverIsActive === false) {
    return {
      label: "INACTIVE",
      style: { background: "#fdecec", color: "#b33232" },
    };
  }
  if (driverIsActive === true) {
    return {
      label: "ACTIVE",
      style: { background: "#eafaf5", color: "#0a7a63" },
    };
  }
  return {
    label: "NO PROFILE",
    style: { background: "#f0f2f6", color: "#6b7280" },
  };
}

function initials(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function MetaRow({
  icon: Icon,
  children,
  className,
  color = "#6b7280",
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[13px] ${className ?? ""}`}
      style={{ color }}
    >
      <Icon size={14} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function validateTechnicianForm(form: {
  name: string;
  phone: string;
  email: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  const nameErr = validateCustomerName(form.name);
  if (nameErr) errors.name = nameErr;

  const phoneErr = validateSaPhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;

  return errors;
}

export default function AdminTechniciansPage() {
  const { user, ready } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";
  const { bookings, fetchBookings } = useBookingStore();
  const today = localCalendarDate();

  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<TechFormField, boolean>>>(
    {}
  );
  const [shownOncePassword, setShownOncePassword] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [passwordMode, setPasswordMode] = useState<"generate" | "manual">(
    "generate"
  );
  const [password, setPassword] = useState("");

  const markTouched = (field: TechFormField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const clearFieldError = (field: TechFormField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (formError) setFormError(null);
  };

  const liveError = (field: TechFormField, validator: () => string | null) =>
    touched[field] || fieldErrors[field]
      ? fieldErrors[field] || validator()
      : null;

  const nameError = liveError("name", () => validateCustomerName(name));
  const phoneError = liveError("phone", () => validateSaPhone(phone));
  const emailError = liveError("email", () => validateEmail(email));

  const load = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/technicians", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Could not load technicians");
        setTechnicians([]);
        return;
      }
      setTechnicians(data.technicians ?? []);
    } catch {
      setLoadError("Could not load technicians");
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && isFullAdmin) {
      void load();
      void fetchBookings({ silent: true });
    }
  }, [ready, isFullAdmin, fetchBookings]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setVehicle("");
    setPassword("");
    setPasswordMode("generate");
    setFormError(null);
    setFieldErrors({});
    setTouched({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors = validateTechnicianForm({ name, phone, email });
    setFieldErrors(nextErrors);
    setTouched({ name: true, phone: true, email: true });
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/technicians", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().replace(/\s+/g, " "),
          phone: phone.trim(),
          email: email.trim(),
          vehicle: vehicle.trim() || undefined,
          generatePassword: passwordMode === "generate",
          password: passwordMode === "manual" ? password : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Could not create technician";
        const lower = String(message).toLowerCase();
        if (lower.includes("name")) {
          setFieldErrors({ name: message });
        } else if (lower.includes("phone") || lower.includes("mobile")) {
          setFieldErrors({ phone: message });
        } else if (lower.includes("email") && !lower.includes("already exists")) {
          setFieldErrors({ email: message });
        } else {
          setFormError(message);
        }
        return;
      }
      setFormOpen(false);
      resetForm();
      if (typeof data.temporaryPassword === "string") {
        setShownOncePassword(data.temporaryPassword);
        setCopied(false);
      } else {
        setShownOncePassword(null);
      }
      await load();
    } catch {
      setFormError("Could not create technician. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (ready && user && !isFullAdmin) {
    return (
      <AdminPortalShell pageTitle="Technicians" active="technicians">
        <div className="portal-page">
          <div className="ds-card max-w-lg">
            <div className="text-[16px] font-extrabold" style={{ color: "#000b49" }}>
              Technicians are managed by full admins
            </div>
            <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
              Marketing-only accounts cannot create driver logins.
            </p>
          </div>
        </div>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell
      pageTitle="Technicians"
      active="technicians"
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
              <UserCog size={14} strokeWidth={1.8} aria-hidden="true" />
              STAFF LOGINS
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              Technician accounts are created here — there is no public driver signup.
            </p>
          </div>
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add technician
          </Button>
        </div>

        {shownOncePassword && (
          <div
            className="ds-card"
            style={{ borderColor: "#6cf3d5", background: "#eafaf5" }}
          >
            <div className="text-[14px] font-extrabold" style={{ color: "#000b49" }}>
              Temporary password — copy it now
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#6b7280" }}>
              This value is shown once. The technician must change it on first login.
            </p>
            <div className="mt-[12px] flex flex-wrap items-center gap-3">
              <code className="rounded-[8px] bg-white px-3 py-2 text-[14px] font-bold tracking-wide text-[#000b49]">
                {shownOncePassword}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(shownOncePassword);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <button
                type="button"
                className="ds-text-action"
                onClick={() => setShownOncePassword(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {technicians.map((t) => {
            const badge = assignmentBadge(t.driverIsActive);
            const todayJobs = countTechnicianJobsOnDay(
              bookings,
              t.driverProfileId,
              today
            );
            return (
              <Link
                key={t.id}
                href={`/admin/technicians/${t.id}`}
                className="ds-card block transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-[13px]">
                  <div
                    className="flex size-[46px] flex-none items-center justify-center rounded-full text-[16px] font-extrabold"
                    style={{ background: "#000b49", color: "#6cf3d5" }}
                  >
                    {initials(t.name, t.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold" style={{ color: "#000b49" }}>
                      {t.name || t.email}
                    </div>
                    <div className="text-meta mt-[3px] flex items-center gap-1.5 truncate" style={{ color: "#9aa0a6" }}>
                      <Mail size={12} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{t.email}</span>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-wide"
                    style={badge.style}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="my-[16px] h-px" style={{ background: "#f0f2f6" }} />
                <MetaRow icon={Phone}>{t.phone || "No phone"}</MetaRow>
                <MetaRow icon={Truck} className="mt-[6px]">
                  {t.vehicle || "No vehicle assigned"}
                </MetaRow>
                <MetaRow icon={CalendarDays} className="mt-[6px]">
                  {todayJobs === 1 ? "1 job today" : `${todayJobs} jobs today`}
                </MetaRow>
                {t.disabledAt ? (
                  <MetaRow icon={ShieldOff} className="mt-[10px] font-bold" color="#8a6d00">
                    Login disabled
                  </MetaRow>
                ) : null}
                {t.mustChangePassword ? (
                  <MetaRow icon={KeyRound} className="mt-[10px] font-bold" color="#8a6d00">
                    Must change password on next login
                  </MetaRow>
                ) : null}
              </Link>
            );
          })}
        </div>

        {loading && technicians.length === 0 && !loadError ? (
          <div
            className="ds-card py-[40px] text-center text-meta"
            style={{ color: "#9aa0a6" }}
            role="status"
          >
            Loading technicians…
          </div>
        ) : null}

        {!loading && technicians.length === 0 && !loadError ? (
          <div className="ds-card py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
            No technicians yet. Add one to create a driver login.
          </div>
        ) : null}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-md">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => void handleCreate(e)}
          >
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>Add technician</DialogTitle>
              <DialogDescription>
                Creates a technician login. Email is the username. They cannot
                register themselves.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="tech-name">Name</Label>
                <Input
                  id="tech-name"
                  autoComplete="name"
                  placeholder="e.g. Thabo Mokoena"
                  value={name}
                  aria-invalid={Boolean(nameError) || undefined}
                  aria-describedby={nameError ? "tech-name-error" : undefined}
                  onBlur={() => markTouched("name")}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  required
                />
                <FieldError id="tech-name-error" message={nameError} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tech-phone">Phone</Label>
                <Input
                  id="tech-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="082 123 4567"
                  value={phone}
                  aria-invalid={Boolean(phoneError) || undefined}
                  aria-describedby={
                    phoneError ? "tech-phone-error" : "tech-phone-hint"
                  }
                  onBlur={() => markTouched("phone")}
                  onChange={(e) => {
                    setPhone(sanitizePhoneInput(e.target.value));
                    clearFieldError("phone");
                  }}
                  required
                />
                {phoneError ? (
                  <FieldError id="tech-phone-error" message={phoneError} />
                ) : (
                  <p id="tech-phone-hint" className="text-[12px] text-[#9aa0a6]">
                    SA numbers: 060, 071, 082 or +27…
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tech-email">Email (login)</Label>
                <Input
                  id="tech-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tech@sparkandclean.co.za"
                  value={email}
                  aria-invalid={Boolean(emailError) || undefined}
                  aria-describedby={emailError ? "tech-email-error" : undefined}
                  onBlur={() => markTouched("email")}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  required
                />
                <FieldError id="tech-email-error" message={emailError} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tech-vehicle">Vehicle (optional)</Label>
                <Input
                  id="tech-vehicle"
                  placeholder="e.g. Nissan NP200 (CA 123-456)"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Password</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="password-mode"
                    checked={passwordMode === "generate"}
                    onChange={() => setPasswordMode("generate")}
                  />
                  Generate and show once
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="password-mode"
                    checked={passwordMode === "manual"}
                    onChange={() => setPasswordMode("manual")}
                  />
                  Set a temporary password
                </label>
              </fieldset>
              {passwordMode === "manual" && (
                <div className="space-y-1.5">
                  <Label htmlFor="tech-password">Temporary password</Label>
                  <PasswordInput
                    id="tech-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              )}
              {formError && (
                <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                  {formError}
                </p>
              )}
            </div>
            <DialogFooter className="mt-5 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create technician"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}
