"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
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

type WorkshopStaff = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export default function WorkshopStaffPage() {
  const [staff, setStaff] = useState<WorkshopStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/workshop-staff", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json()) as {
        error?: string;
        workshopStaff?: WorkshopStaff[];
      };
      if (!response.ok) {
        setLoadError(data.error || "Could not load workshop accounts");
        setStaff([]);
      } else {
        setStaff(Array.isArray(data.workshopStaff) ? data.workshopStaff : []);
      }
    } catch {
      setLoadError("Could not load workshop accounts");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/workshop-staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = (await response.json()) as {
        error?: string;
        temporaryPassword?: string;
      };
      if (!response.ok) {
        setFormError(data.error || "Could not create workshop account");
        return;
      }
      setFormOpen(false);
      setName("");
      setEmail("");
      if (data.temporaryPassword) setTemporaryPassword(data.temporaryPassword);
      await load();
    } catch {
      setFormError("Could not create workshop account. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (member: WorkshopStaff) => {
    if (busyId) return;
    setBusyId(member.id);
    try {
      const response = await fetch(
        `/api/admin/workshop-staff/${encodeURIComponent(member.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !member.active }),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        workshopStaff?: WorkshopStaff;
      };
      if (!response.ok || !data.workshopStaff) {
        toast.error(data.error || "Could not update workshop account");
        return;
      }
      setStaff((rows) =>
        rows.map((row) =>
          row.id === member.id ? data.workshopStaff! : row
        )
      );
      toast.success(
        `${member.name || member.email} is now ${
          data.workshopStaff.active ? "active" : "inactive"
        }`
      );
    } catch {
      toast.error("Could not update workshop account. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPortalShell pageTitle="Workshop staff" active="workshopStaff">
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-eyebrow text-[#9aa0a6]">
              <Users size={14} aria-hidden="true" />
              Workshop accounts
            </div>
            <p className="text-meta mt-[6px] text-[#6b7280]">
              Each staff member has an individual login for accountable workshop
              activity. Accounts are provisioned by full admins.
            </p>
          </div>
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Add workshop account
          </Button>
        </div>

        {temporaryPassword ? (
          <div className="ds-card border-[#6cf3d5] bg-[#eafaf5]">
            <div className="font-extrabold text-[#000b49]">
              Temporary password — copy it now
            </div>
            <p className="text-meta mt-1 text-[#6b7280]">
              This password is shown once. The staff member must change it at
              first login.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded bg-white px-3 py-2 font-bold text-[#000b49]">
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(temporaryPassword)}
              >
                Copy
              </Button>
              <button
                type="button"
                className="ds-text-action"
                onClick={() => setTemporaryPassword(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {loadError ? (
          <p role="alert" className="text-sm text-[#b3261e]">
            {loadError}{" "}
            <button type="button" className="ds-text-action" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_1.5fr_8rem_8rem] gap-3 border-b border-[#f0f2f6] bg-[#f7f9fb] px-5 py-3 text-th">
            <span>Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {staff.map((member) => (
            <div
              key={member.id}
              className="grid grid-cols-[1fr_1.5fr_8rem_8rem] items-center gap-3 border-b border-[#f0f2f6] px-5 py-4 text-sm last:border-0"
            >
              <span className="truncate font-semibold text-[#000b49]">
                {member.name || "—"}
              </span>
              <span className="truncate text-[#6b7280]">{member.email}</span>
              <span
                className={
                  member.active
                    ? "font-bold text-[#0a7a63]"
                    : "font-bold text-[#b33232]"
                }
              >
                {member.active ? "Active" : "Inactive"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyId === member.id}
                onClick={() => void setActive(member)}
              >
                {member.active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          ))}
          {loading && staff.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#9aa0a6]" role="status">
              Loading workshop accounts…
            </p>
          ) : null}
          {!loading && !loadError && staff.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#9aa0a6]">
              No workshop accounts yet.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void createAccount(event)}>
            <DialogHeader>
              <DialogTitle>Add workshop account</DialogTitle>
              <DialogDescription>
                A temporary password will be generated. Staff must choose their
                own password before using the workshop portal.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="workshop-name">Name</Label>
                <Input
                  id="workshop-name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workshop-email">Email</Label>
                <Input
                  id="workshop-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {formError ? (
                <p className="text-sm text-[#b3261e]" role="alert">
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
                {saving ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}
