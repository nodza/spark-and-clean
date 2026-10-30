"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { FieldError } from "@/components/booking/FieldError";
import { useAuth } from "@/components/auth/AuthProvider";
import { validateCustomerName, validateEmail } from "@/lib/bookingValidation";
import type { AdminTier } from "@/types/user";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  adminTier: AdminTier;
  active: boolean;
};

const TABLE_COLS =
  "minmax(0,1.15fr) minmax(0,1.5fr) 9.5rem 6.5rem 8.5rem";
const HEADINGS = ["Name", "Email", "Tier", "Status", ""] as const;

function tierLabel(tier: AdminTier) {
  return tier === "full" ? "Full" : "Marketing";
}

function displayName(admin: AdminRow) {
  const name = admin.name.trim();
  return name || admin.email;
}

export default function AdminTeamPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<AdminTier>("marketing-only");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shownOncePassword, setShownOncePassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeFullCount = admins.filter(
    (admin) => admin.active && admin.adminTier === "full"
  ).length;

  const load = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/team", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        admins?: AdminRow[];
      };
      if (!res.ok) {
        setLoadError(data.error || "Could not load admins");
        setAdmins([]);
        return;
      }
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
    } catch {
      setLoadError("Could not load admins");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setTier("marketing-only");
    setFieldErrors({});
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const nextErrors: { name?: string; email?: string } = {};
    const nameErr = validateCustomerName(name);
    if (nameErr) nextErrors.name = nameErr;
    const emailErr = validateEmail(email);
    if (emailErr) nextErrors.email = emailErr;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().replace(/\s+/g, " "),
          email: email.trim(),
          adminTier: tier,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
      };
      if (!res.ok) {
        setFormError(data.error || "Could not add admin");
        return;
      }
      setFormOpen(false);
      resetForm();
      if (typeof data.temporaryPassword === "string") {
        setShownOncePassword(data.temporaryPassword);
        setCopied(false);
      }
      await load();
    } catch {
      setFormError("Could not add admin. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const patchAdmin = async (
    admin: AdminRow,
    body: { adminTier?: AdminTier; active?: boolean }
  ) => {
    if (busyId) return;
    setBusyId(admin.id);
    try {
      const res = await fetch(`/api/admin/team/${encodeURIComponent(admin.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        admin?: AdminRow;
      };
      if (!res.ok) {
        toast.error(data.error || "Could not update admin");
        return;
      }
      if (data.admin) {
        setAdmins((rows) =>
          rows.map((row) => (row.id === admin.id ? data.admin! : row))
        );
      } else {
        await load();
      }
      if (body.active === false) toast.success(`${displayName(admin)} is now inactive`);
      else if (body.active === true) toast.success(`${displayName(admin)} is now active`);
      else if (body.adminTier) {
        toast.success(
          `${displayName(admin)} is now ${tierLabel(body.adminTier).toLowerCase()}`
        );
      }
    } catch {
      toast.error("Could not update admin. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPortalShell pageTitle="Team" active="team">
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-eyebrow"
              style={{ color: "#9aa0a6" }}
            >
              <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
              Admin accounts
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              Add a full or marketing admin. A deactivated admin cannot sign in,
              and their open session stops working.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 w-full shrink-0 sm:w-auto"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add admin
          </Button>
        </div>

        {shownOncePassword ? (
          <div
            className="ds-card"
            style={{ borderColor: "#6cf3d5", background: "#eafaf5" }}
          >
            <div className="text-[14px] font-extrabold" style={{ color: "#000b49" }}>
              Temporary password — copy it now
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#6b7280" }}>
              This value is shown once. They must change it on first login.
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
        ) : null}

        {loadError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}{" "}
            <button type="button" className="ds-text-action" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <div className="hidden lg:block">
            <div
              className="grid items-center px-[22px] py-[14px]"
              style={{
                gridTemplateColumns: TABLE_COLS,
                background: "#f7f9fb",
                borderBottom: "1px solid #f0f2f6",
                columnGap: 10,
              }}
            >
              {HEADINGS.map((heading) => (
                <div key={heading || "actions"} className="text-th whitespace-nowrap">
                  {heading}
                </div>
              ))}
            </div>
            {admins.map((admin) => (
              <AdminDesktopRow
                key={admin.id}
                admin={admin}
                isSelf={admin.id === user?.id}
                isLastActiveFull={
                  admin.active &&
                  admin.adminTier === "full" &&
                  activeFullCount <= 1
                }
                busy={busyId === admin.id}
                onTier={(next) => void patchAdmin(admin, { adminTier: next })}
                onActive={(next) => void patchAdmin(admin, { active: next })}
              />
            ))}
          </div>

          <div className="lg:hidden">
            {admins.map((admin) => (
              <AdminMobileRow
                key={admin.id}
                admin={admin}
                isSelf={admin.id === user?.id}
                isLastActiveFull={
                  admin.active &&
                  admin.adminTier === "full" &&
                  activeFullCount <= 1
                }
                busy={busyId === admin.id}
                onTier={(next) => void patchAdmin(admin, { adminTier: next })}
                onActive={(next) => void patchAdmin(admin, { active: next })}
              />
            ))}
          </div>

          {loading && admins.length === 0 ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
              role="status"
            >
              Loading admins…
            </div>
          ) : null}

          {!loading && !loadError && admins.length === 0 ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
            >
              No admins yet.
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => void handleCreate(e)} noValidate>
            <DialogHeader>
              <DialogTitle>Add admin</DialogTitle>
              <DialogDescription>
                They receive a temporary password and must choose their own on
                first login. Marketing admins only see Overview and Pricing &
                coupons.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={name}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.email) || undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                />
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-tier">Tier</Label>
                <Select
                  value={tier}
                  onValueChange={(next) => setTier(next as AdminTier)}
                >
                  <SelectTrigger id="admin-tier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="marketing-only">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formError ? (
                <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding…" : "Add admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}

function StatusPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span
        className="inline-flex w-fit whitespace-nowrap rounded-full px-2 py-[5px] text-[10px] font-extrabold"
        style={{ background: "#eafaf5", color: "#0a7a63" }}
      >
        ACTIVE
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-fit whitespace-nowrap rounded-full px-2 py-[5px] text-[10px] font-extrabold"
      style={{ background: "#fdecec", color: "#b33232" }}
    >
      INACTIVE
    </span>
  );
}

function TierSelect({
  admin,
  locked,
  lockReason,
  busy,
  onTier,
}: {
  admin: AdminRow;
  locked: boolean;
  lockReason?: string;
  busy: boolean;
  onTier: (tier: AdminTier) => void;
}) {
  return (
    <Select
      value={admin.adminTier}
      onValueChange={(next) => onTier(next as AdminTier)}
      disabled={busy || locked}
    >
      <SelectTrigger
        aria-label={`Tier for ${displayName(admin)}`}
        title={lockReason}
        className="w-[8.5rem]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="full">Full</SelectItem>
        <SelectItem value="marketing-only">Marketing</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ActiveButton({
  admin,
  locked,
  lockReason,
  busy,
  onActive,
}: {
  admin: AdminRow;
  locked: boolean;
  lockReason?: string;
  busy: boolean;
  onActive: (active: boolean) => void;
}) {
  if (admin.active) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || locked}
        title={lockReason}
        onClick={() => onActive(false)}
      >
        Deactivate
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={() => onActive(true)}
    >
      Reactivate
    </Button>
  );
}

function AdminControls({
  admin,
  isSelf,
  isLastActiveFull,
  busy,
  onTier,
  onActive,
}: {
  admin: AdminRow;
  isSelf: boolean;
  isLastActiveFull: boolean;
  busy: boolean;
  onTier: (tier: AdminTier) => void;
  onActive: (active: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TierSelect
        admin={admin}
        locked={isSelf || isLastActiveFull}
        lockReason={
          isLastActiveFull
            ? "The last full admin cannot be downgraded."
            : isSelf
              ? "You cannot change your own tier."
              : undefined
        }
        busy={busy}
        onTier={onTier}
      />
      <ActiveButton
        admin={admin}
        locked={admin.active && (isSelf || isLastActiveFull)}
        lockReason={
          !admin.active
            ? undefined
            : isLastActiveFull
              ? "The last full admin cannot be deactivated."
              : isSelf
                ? "You cannot deactivate your own account."
                : undefined
        }
        busy={busy}
        onActive={onActive}
      />
    </div>
  );
}

function AdminDesktopRow({
  admin,
  isSelf,
  isLastActiveFull,
  busy,
  onTier,
  onActive,
}: {
  admin: AdminRow;
  isSelf: boolean;
  isLastActiveFull: boolean;
  busy: boolean;
  onTier: (tier: AdminTier) => void;
  onActive: (active: boolean) => void;
}) {
  const label = displayName(admin);
  return (
    <div
      className="grid items-center px-[22px] py-[12px]"
      style={{
        gridTemplateColumns: TABLE_COLS,
        borderBottom: "1px solid #f0f2f6",
        columnGap: 10,
      }}
    >
      <div className="min-w-0">
        <div
          className="truncate text-body font-bold"
          style={{ color: "#000b49" }}
          title={label}
        >
          {label}
          {isSelf ? (
            <span className="ml-2 text-[11px] font-extrabold" style={{ color: "#9aa0a6" }}>
              You
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 truncate text-body" style={{ color: "#32373c" }} title={admin.email}>
        {admin.email}
      </div>
      <TierSelect
        admin={admin}
        locked={isSelf || isLastActiveFull}
        lockReason={
          isLastActiveFull
            ? "The last full admin cannot be downgraded."
            : isSelf
              ? "You cannot change your own tier."
              : undefined
        }
        busy={busy}
        onTier={onTier}
      />
      <StatusPill active={admin.active} />
      <ActiveButton
        admin={admin}
        locked={admin.active && (isSelf || isLastActiveFull)}
        lockReason={
          !admin.active
            ? undefined
            : isLastActiveFull
              ? "The last full admin cannot be deactivated."
              : isSelf
                ? "You cannot deactivate your own account."
                : undefined
        }
        busy={busy}
        onActive={onActive}
      />
    </div>
  );
}

function AdminMobileRow({
  admin,
  isSelf,
  isLastActiveFull,
  busy,
  onTier,
  onActive,
}: {
  admin: AdminRow;
  isSelf: boolean;
  isLastActiveFull: boolean;
  busy: boolean;
  onTier: (tier: AdminTier) => void;
  onActive: (active: boolean) => void;
}) {
  const label = displayName(admin);
  return (
    <div className="border-b border-[#f0f2f6] px-[16px] py-[14px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold" style={{ color: "#000b49" }}>
            {label}
            {isSelf ? (
              <span className="ml-2 text-[11px] font-extrabold" style={{ color: "#9aa0a6" }}>
                You
              </span>
            ) : null}
          </div>
          <div className="text-body mt-[4px] break-all" style={{ color: "#32373c" }}>
            {admin.email}
          </div>
        </div>
        <StatusPill active={admin.active} />
      </div>
      <div className="mt-3">
        <AdminControls
          admin={admin}
          isSelf={isSelf}
          isLastActiveFull={isLastActiveFull}
          busy={busy}
          onTier={onTier}
          onActive={onActive}
        />
      </div>
    </div>
  );
}
