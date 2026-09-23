"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
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
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { useAuth } from "@/components/auth/AuthProvider";

type VehicleRow = {
  id: string;
  label: string;
  plate: string;
  assignedDriverId: string | null;
  assignedDriverName?: string | null;
};

type DriverOption = { id: string; name: string };

const UNASSIGNED = "unassigned";

export default function AdminVehiclesPage() {
  const { user, ready } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";

  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState<VehicleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [plate, setPlate] = useState("");
  const [newDriverId, setNewDriverId] = useState(UNASSIGNED);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [vehicleRes, driverRes] = await Promise.all([
        fetch("/api/admin/vehicles", { credentials: "include" }),
        fetch("/api/drivers", { credentials: "include" }),
      ]);
      const vehicleData = await vehicleRes.json().catch(() => ({}));
      const driverData = await driverRes.json().catch(() => []);
      if (!vehicleRes.ok) {
        throw new Error(vehicleData.error || "Could not load vehicles");
      }
      setVehicles(Array.isArray(vehicleData.vehicles) ? vehicleData.vehicles : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && isFullAdmin) void load();
  }, [ready, isFullAdmin, load]);

  const resetForm = () => {
    setLabel("");
    setPlate("");
    setNewDriverId(UNASSIGNED);
    setEditing(null);
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (vehicle: VehicleRow) => {
    setEditing(vehicle);
    setLabel(vehicle.label);
    setPlate(vehicle.plate);
    setNewDriverId(UNASSIGNED);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const wasEditing = Boolean(editing);
    try {
      const res = editing
        ? await fetch(`/api/admin/vehicles/${editing.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, plate }),
          })
        : await fetch("/api/admin/vehicles", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label,
              plate,
              assignedDriverId: newDriverId === UNASSIGNED ? null : newDriverId,
            }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(
          data.error || (wasEditing ? "Could not save vehicle" : "Could not add vehicle")
        );
        return;
      }
      setFormOpen(false);
      resetForm();
      toast.success(wasEditing ? "Vehicle updated" : "Vehicle added");
      await load();
    } catch {
      setFormError("Could not save vehicle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (vehicleId: string, driverId: string | null) => {
    setBusyId(vehicleId);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedDriverId: driverId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not update assignment");
        return;
      }
      await load();
    } catch {
      toast.error("Could not update assignment");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not delete vehicle");
        return;
      }
      toast.success("Vehicle deleted");
      setDeleting(null);
      await load();
    } catch {
      toast.error("Could not delete vehicle");
    } finally {
      setBusyId(null);
    }
  };

  const assignmentSelect = (vehicle: VehicleRow) => {
    const selectValue = vehicle.assignedDriverId || UNASSIGNED;
    const missingAssigned =
      vehicle.assignedDriverId &&
      !drivers.some((d) => d.id === vehicle.assignedDriverId);
    const disabled = busyId === vehicle.id;
    return (
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(val) =>
          void handleAssign(vehicle.id, val === UNASSIGNED ? null : val)
        }
      >
        <SelectTrigger className="w-full max-w-[260px]">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {missingAssigned ? (
            <SelectItem value={vehicle.assignedDriverId!} disabled>
              {vehicle.assignedDriverName || "Assigned driver"} — inactive
            </SelectItem>
          ) : null}
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={driver.id}>
              {driver.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const rowActions = (vehicle: VehicleRow) => (
    <div className="flex flex-wrap items-center gap-2">
      {vehicle.assignedDriverId ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busyId === vehicle.id}
          onClick={() => void handleAssign(vehicle.id, null)}
        >
          Unassign
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busyId === vehicle.id}
        onClick={() => openEdit(vehicle)}
      >
        <Pencil size={14} strokeWidth={2} aria-hidden="true" />
        Edit
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busyId === vehicle.id}
        onClick={() => setDeleting(vehicle)}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
        Delete
      </Button>
    </div>
  );

  if (ready && user && !isFullAdmin) {
    return (
      <AdminPortalShell pageTitle="Vehicles" active="vehicles">
        <div className="portal-page">
          <div className="ds-card max-w-lg">
            <div className="text-[16px] font-extrabold" style={{ color: "#000b49" }}>
              Vehicles are managed by full admins
            </div>
            <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
              Marketing-only accounts cannot assign bakkies.
            </p>
          </div>
        </div>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell
      pageTitle="Vehicles"
      active="vehicles"
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
              <Truck size={14} strokeWidth={1.8} aria-hidden="true" />
              TODAY&apos;S BAKKIES
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              One vehicle per driver. Jobs show that driver&apos;s current bakkie.
            </p>
          </div>
          <Button type="button" onClick={openAdd}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add vehicle
          </Button>
        </div>

        {loadError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <div className="hidden min-w-[720px] lg:block">
            <div
              className="grid px-[22px] py-[14px]"
              style={{
                gridTemplateColumns: "1.2fr 0.8fr 1.2fr minmax(240px, 1.4fr)",
                background: "#f7f9fb",
                borderBottom: "1px solid #f0f2f6",
              }}
            >
              {["Vehicle", "Plate", "Assigned driver", ""].map((h) => (
                <div key={h || "actions"} className="text-th">
                  {h}
                </div>
              ))}
            </div>
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="grid items-center px-[22px] py-[14px]"
                style={{
                  gridTemplateColumns: "1.2fr 0.8fr 1.2fr minmax(240px, 1.4fr)",
                  borderBottom: "1px solid #f0f2f6",
                  columnGap: 12,
                }}
              >
                <div className="text-body font-bold" style={{ color: "#000b49" }}>
                  {vehicle.label}
                </div>
                <div className="text-body tabular" style={{ color: "#32373c" }}>
                  {vehicle.plate}
                </div>
                {assignmentSelect(vehicle)}
                {rowActions(vehicle)}
              </div>
            ))}
          </div>

          <div className="space-y-0 lg:hidden">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="border-b border-[#f0f2f6] px-[16px] py-[14px]"
              >
                <div className="text-[15px] font-bold" style={{ color: "#000b49" }}>
                  {vehicle.label}
                </div>
                <div className="text-meta mt-[4px]" style={{ color: "#9aa0a6" }}>
                  {vehicle.plate}
                </div>
                <div className="mt-[12px]">
                  <Label className="sr-only">Assigned driver</Label>
                  {assignmentSelect(vehicle)}
                </div>
                <div className="mt-[10px]">{rowActions(vehicle)}</div>
              </div>
            ))}
          </div>

          {loading && vehicles.length === 0 && !loadError ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
              role="status"
            >
              Loading vehicles…
            </div>
          ) : null}

          {!loading && vehicles.length === 0 && !loadError ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
            >
              No vehicles yet. Add a bakkie and assign it to a driver.
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
          <form onSubmit={(e) => void handleSave(e)}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Fix the make/model or plate. Assignment stays on the table."
                  : "Make/model and plate. Assign to one active driver, or leave unassigned."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-label">Make / model</Label>
                <Input
                  id="vehicle-label"
                  placeholder="e.g. Nissan NP200"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-plate">Plate</Label>
                <Input
                  id="vehicle-plate"
                  placeholder="e.g. CA 123-456"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  required
                />
              </div>
              {!editing ? (
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle-driver">Assign to</Label>
                  <Select value={newDriverId} onValueChange={setNewDriverId}>
                    <SelectTrigger id="vehicle-driver" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {formError ? (
                <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Add vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete vehicle?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.label} (${deleting.plate}) will be removed. The assigned driver will have no current bakkie.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId === deleting?.id}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}
