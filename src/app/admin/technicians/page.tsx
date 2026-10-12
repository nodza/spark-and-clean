"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  KeyRound,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  ShieldOff,
  Trash2,
  Truck,
  UserCheck,
  UserCog,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { FieldError } from "@/components/booking/FieldError";
import { useAuth } from "@/components/auth/AuthProvider";
import { driverService } from "@/services/driverService";
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

function technicianLabel(technician: { name?: string; email: string }) {
  const name = technician.name?.trim();
  return name || technician.email;
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

function onActionMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)'
    )
  );
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    const next = current < 0 ? 0 : (current + 1) % items.length;
    items[next]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const next =
      current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    items[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    items[items.length - 1]?.focus();
  }
}

function ActionMenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  destructive,
  title,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13.5px] font-semibold transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        destructive
          ? "text-[#b33232] hover:bg-[#fff6f6] focus-visible:bg-[#fff6f6]"
          : "text-[#000b49] hover:bg-[#f7f9fb] focus-visible:bg-[#f7f9fb]"
      }`}
      onClick={onClick}
    >
      <Icon
        size={15}
        strokeWidth={2}
        className={`shrink-0 ${destructive ? "text-[#b33232]" : "text-[#6b7280]"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

function TechnicianActionsMenu({
  technician,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  technician: TechnicianRow;
  busy: boolean;
  onEdit: (technician: TechnicianRow) => void;
  onToggleActive: (technician: TechnicianRow) => void;
  onDelete: (technician: TechnicianRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = technicianLabel(technician);
  const isActive = technician.driverIsActive === true;
  const canToggle = Boolean(technician.driverProfileId) && technician.driverIsActive !== null;
  const StatusIcon = isActive ? UserX : UserCheck;

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#9aa0a6] transition-colors hover:bg-[#f0f2f6] hover:text-[#000b49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49] data-[state=open]:bg-[#f0f2f6] data-[state=open]:text-[#000b49] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Actions for ${label}`}
          disabled={busy}
        >
          <MoreVertical size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="w-52 max-w-[calc(100vw-1.5rem)] rounded-[12px] border-[#e3e7ed] bg-white p-1 shadow-[0_12px_32px_rgba(0,11,73,0.12)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          menuRef.current
            ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
            ?.focus();
        }}
      >
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${label}`}
          onKeyDown={onActionMenuKeyDown}
        >
          <ActionMenuItem icon={Pencil} onClick={() => choose(() => onEdit(technician))}>
            Edit
          </ActionMenuItem>
          <ActionMenuItem
            icon={StatusIcon}
            disabled={!canToggle || busy}
            title={
              canToggle
                ? undefined
                : "This technician has no driver profile"
            }
            onClick={() => choose(() => onToggleActive(technician))}
          >
            {busy ? "Updating…" : isActive ? "Deactivate" : "Activate"}
          </ActionMenuItem>
          <div className="mx-1.5 my-1 h-px bg-[#f0f2f6]" role="separator" />
          <ActionMenuItem
            icon={Trash2}
            destructive
            onClick={() => choose(() => onDelete(technician))}
          >
            Delete
          </ActionMenuItem>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TechnicianCard({
  technician,
  todayJobs,
  statusBusy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  technician: TechnicianRow;
  todayJobs: number;
  statusBusy: boolean;
  onEdit: (technician: TechnicianRow) => void;
  onToggleActive: (technician: TechnicianRow) => void;
  onDelete: (technician: TechnicianRow) => void;
}) {
  const badge = assignmentBadge(technician.driverIsActive);
  const label = technicianLabel(technician);
  const profileHref = `/admin/technicians/${technician.id}`;

  return (
    <article className="ds-card flex min-w-0 flex-col transition-shadow hover:shadow-[0_8px_24px_rgba(0,11,73,0.06)]">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={profileHref}
          className="flex min-w-0 flex-1 items-center gap-[13px] rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#000b49]/25 focus-visible:ring-offset-2"
        >
          <div
            className="flex size-[46px] flex-none items-center justify-center rounded-full text-[16px] font-extrabold"
            style={{ background: "#000b49", color: "#6cf3d5" }}
          >
            {initials(technician.name, technician.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[15px] font-bold"
              style={{ color: "#000b49" }}
              title={label}
            >
              {label}
            </div>
            <div
              className="text-meta mt-[3px] flex items-center gap-1.5"
              style={{ color: "#9aa0a6" }}
            >
              <Mail size={12} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
              <span className="truncate" title={technician.email}>
                {technician.email}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <span
            className="rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-wide"
            style={badge.style}
          >
            {badge.label}
          </span>
          <TechnicianActionsMenu
            technician={technician}
            busy={statusBusy}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
          />
        </div>
      </div>
      <Link
        href={profileHref}
        className="mt-[16px] block min-w-0 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#000b49]/25 focus-visible:ring-offset-2"
      >
        <div className="-mx-[22px] mb-4 h-px bg-[#f0f2f6]" />
        <MetaRow icon={Phone}>{technician.phone || "No phone"}</MetaRow>
        <MetaRow icon={Truck} className="mt-[6px]">
          {technician.vehicle || "No vehicle assigned"}
        </MetaRow>
        <MetaRow icon={CalendarDays} className="mt-[6px]">
          {todayJobs === 1 ? "1 job today" : `${todayJobs} jobs today`}
        </MetaRow>
        {technician.disabledAt ? (
          <MetaRow icon={ShieldOff} className="mt-[10px] font-bold" color="#8a6d00">
            Login disabled
          </MetaRow>
        ) : null}
        {technician.mustChangePassword ? (
          <MetaRow icon={KeyRound} className="mt-[10px] font-bold" color="#8a6d00">
            Must change password on next login
          </MetaRow>
        ) : null}
      </Link>
    </article>
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
  const [passwordMode, setPasswordMode] = useState<"generate" | "manual">(
    "generate"
  );
  const [password, setPassword] = useState("");

  const [editing, setEditing] = useState<TechnicianRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editTouched, setEditTouched] = useState<
    Partial<Record<"name" | "phone", boolean>>
  >({});

  const [removing, setRemoving] = useState<TechnicianRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

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

  const editLiveError = (
    field: "name" | "phone",
    validator: () => string | null
  ) =>
    editTouched[field] || editFieldErrors[field]
      ? editFieldErrors[field] || validator()
      : null;

  const editNameError = editLiveError("name", () => validateCustomerName(editName));
  const editPhoneError = editLiveError("phone", () => validateSaPhone(editPhone));

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

  const closeEdit = () => {
    if (editSaving) return;
    setEditing(null);
    setEditFormError(null);
    setEditFieldErrors({});
    setEditTouched({});
  };

  const openEdit = (technician: TechnicianRow) => {
    setEditing(technician);
    setEditName(technician.name ?? "");
    setEditPhone(technician.phone ?? "");
    setEditFormError(null);
    setEditFieldErrors({});
    setEditTouched({});
  };

  const clearEditFieldError = (field: "name" | "phone") => {
    setEditFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (editFormError) setEditFormError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || editSaving) return;
    setEditFormError(null);

    const nextErrors: FieldErrors = {};
    const nameErr = validateCustomerName(editName);
    if (nameErr) nextErrors.name = nameErr;
    const phoneErr = validateSaPhone(editPhone);
    if (phoneErr) nextErrors.phone = phoneErr;
    setEditFieldErrors(nextErrors);
    setEditTouched({ name: true, phone: true });
    if (Object.keys(nextErrors).length > 0) return;

    if (!editing.driverProfileId) {
      setEditFormError(
        "This technician has no driver profile, so name and phone cannot be saved."
      );
      return;
    }

    const savedName = editName.trim().replace(/\s+/g, " ");
    const savedPhone = editPhone.trim();
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/drivers/${encodeURIComponent(editing.driverProfileId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: savedName, phone: savedPhone }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Could not save technician";
        const lower = message.toLowerCase();
        if (lower.includes("name")) {
          setEditFieldErrors({ name: message });
        } else if (lower.includes("phone") || lower.includes("mobile")) {
          setEditFieldErrors({ phone: message });
        } else {
          setEditFormError(message);
        }
        return;
      }
      await load();
      setEditing(null);
      toast.success("Name and phone saved");
    } catch {
      setEditFormError("Could not save technician. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (technician: TechnicianRow) => {
    if (!technician.driverProfileId || technician.driverIsActive == null) return;
    if (statusBusyId) return;
    const nextActive = technician.driverIsActive === false;
    const personName = technicianLabel(technician);
    setStatusBusyId(technician.id);
    setTechnicians((rows) =>
      rows.map((row) =>
        row.id === technician.id
          ? {
              ...row,
              driverIsActive: nextActive,
              disabledAt: nextActive ? null : new Date().toISOString(),
            }
          : row
      )
    );
    try {
      await driverService.updateIsActive(technician.driverProfileId, nextActive);
      toast.success(
        nextActive ? `${personName} is now active` : `${personName} is now inactive`
      );
      await load();
    } catch (err) {
      setTechnicians((rows) =>
        rows.map((row) => (row.id === technician.id ? technician : row))
      );
      toast.error(
        err instanceof Error ? err.message : "Could not update status"
      );
    } finally {
      setStatusBusyId(null);
    }
  };

  const openDelete = (technician: TechnicianRow) => {
    setRemoveError(null);
    setRemoving(technician);
  };

  const closeDelete = () => {
    if (removeBusy) return;
    setRemoving(null);
    setRemoveError(null);
  };

  const handleDelete = async () => {
    if (!removing || removeBusy) return;
    const personName = technicianLabel(removing);

    if (!removing.driverProfileId) {
      setRemoveError(
        `${personName} has no driver profile, so they cannot be removed from this list.`
      );
      return;
    }

    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/drivers/${encodeURIComponent(removing.driverProfileId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveError(
          typeof data.error === "string"
            ? data.error
            : "Could not delete technician"
        );
        return;
      }
      await load();
      setRemoving(null);
      toast.success(`${personName} was removed`);
    } catch {
      setRemoveError("Could not delete technician. Please try again.");
    } finally {
      setRemoveBusy(false);
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
              <UserCog size={14} strokeWidth={1.8} aria-hidden="true" />
              STAFF LOGINS
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              Technician accounts are created here — there is no public driver signup.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 w-full shrink-0 sm:w-auto"
            onClick={() => setFormOpen(true)}
          >
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

        <ul className="grid list-none grid-cols-1 gap-[14px] p-0 md:grid-cols-2 xl:grid-cols-3">
          {technicians.map((t) => (
            <li key={t.id} className="min-w-0">
              <TechnicianCard
                technician={t}
                todayJobs={countTechnicianJobsOnDay(
                  bookings,
                  t.driverProfileId,
                  today
                )}
                statusBusy={statusBusyId === t.id}
                onEdit={openEdit}
                onToggleActive={(technician) => void handleToggleActive(technician)}
                onDelete={openDelete}
              />
            </li>
          ))}
        </ul>

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
              <p className="text-[12px] text-[#9aa0a6]">
                Assign a bakkie on Vehicles after you create the login.
              </p>
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

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-md">
          {editing ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => void handleEdit(e)}
            >
              <DialogHeader className="shrink-0 pr-8">
                <DialogTitle>Edit {technicianLabel(editing)}</DialogTitle>
                <DialogDescription>
                  Update the name and phone shown on this card and on the
                  profile. Email stays the login.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tech-name">Name</Label>
                  <Input
                    id="edit-tech-name"
                    autoComplete="name"
                    autoFocus
                    value={editName}
                    aria-invalid={Boolean(editNameError) || undefined}
                    aria-describedby={
                      editNameError ? "edit-tech-name-error" : undefined
                    }
                    onBlur={() =>
                      setEditTouched((prev) => ({ ...prev, name: true }))
                    }
                    onChange={(e) => {
                      setEditName(e.target.value);
                      clearEditFieldError("name");
                    }}
                    required
                  />
                  <FieldError id="edit-tech-name-error" message={editNameError} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tech-phone">Phone</Label>
                  <Input
                    id="edit-tech-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="082 123 4567"
                    value={editPhone}
                    aria-invalid={Boolean(editPhoneError) || undefined}
                    aria-describedby={
                      editPhoneError
                        ? "edit-tech-phone-error"
                        : "edit-tech-phone-hint"
                    }
                    onBlur={() =>
                      setEditTouched((prev) => ({ ...prev, phone: true }))
                    }
                    onChange={(e) => {
                      setEditPhone(sanitizePhoneInput(e.target.value));
                      clearEditFieldError("phone");
                    }}
                    required
                  />
                  {editPhoneError ? (
                    <FieldError
                      id="edit-tech-phone-error"
                      message={editPhoneError}
                    />
                  ) : (
                    <p
                      id="edit-tech-phone-hint"
                      className="text-[12px] text-[#9aa0a6]"
                    >
                      SA numbers: 060, 071, 082 or +27…
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tech-email">Email (login)</Label>
                  <Input
                    id="edit-tech-email"
                    type="email"
                    value={editing.email}
                    readOnly
                    aria-readonly="true"
                    tabIndex={0}
                    className="cursor-default bg-[#f7f9fb] text-[#6b7280] focus:border-[#dfe2e7] focus:shadow-none"
                    aria-describedby="edit-tech-email-hint"
                  />
                  <p id="edit-tech-email-hint" className="text-[12px] text-[#9aa0a6]">
                    Email is the login and cannot be changed here.
                  </p>
                </div>
                {editFormError ? (
                  <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                    {editFormError}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={editSaving}
                  onClick={closeEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-11" disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-md">
          {removing ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <DialogHeader className="pr-8">
                  <DialogTitle>Delete {technicianLabel(removing)}?</DialogTitle>
                  <DialogDescription>
                    This removes the technician login and driver profile for{" "}
                    {technicianLabel(removing)}. Delivered and cancelled bookings
                    stay on record. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                {removeError ? (
                  <p
                    className="mt-4 text-sm break-words"
                    style={{ color: "#b3261e" }}
                    role="alert"
                  >
                    {removeError}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-6 shrink-0 flex-col sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={removeBusy}
                  onClick={closeDelete}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11"
                  disabled={removeBusy}
                  onClick={() => void handleDelete()}
                >
                  {removeBusy ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}
