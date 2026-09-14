"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Truck } from "lucide-react";
import { driverService } from "@/services/driverService";
import { useBookingStore } from "@/store/useBookingStore";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Technician = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  driverProfileId?: string;
};

type Driver = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle: string;
  isActive: boolean;
  city?: string;
  notes?: string;
};

export default function TechnicianProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const technicianId = params.id;
  const { bookings, fetchBookings } = useBookingStore();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await fetchBookings();
        const response = await fetch("/api/admin/technicians", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load technician");

        const found = (data.technicians as Technician[]).find(
          (item) => item.id === technicianId
        );
        if (!found) throw new Error("Technician not found");
        setTechnician(found);

        if (found.driverProfileId) {
          const profile = await driverService.getDriverById(found.driverProfileId);
          if (profile) {
            setDriver(profile);
            setNotes(profile.notes || "");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load technician");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [fetchBookings, technicianId]);

  const handleToggleActive = async () => {
    if (!driver) return;
    setSaving(true);
    setError(null);
    try {
      setDriver(await driverService.updateIsActive(driver.id, !driver.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!driver) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await driverService.updateDriver(driver.id, { notes });
      setDriver(updated);
      setNotes(updated.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes");
    } finally {
      setSaving(false);
    }
  };

  const todaysJobs = driver
    ? bookings.filter(
        (booking) =>
          booking.assignedDriverId === driver.id &&
          booking.collectionDate.startsWith(new Date().toISOString().split("T")[0])
      )
    : [];

  if (loading) {
    return (
      <AdminPortalShell pageTitle="Technician" active="technicians">
        <div className="portal-page py-12 text-center text-muted-foreground">
          Loading technician profile...
        </div>
      </AdminPortalShell>
    );
  }

  if (!technician) {
    return (
      <AdminPortalShell pageTitle="Technician not found" active="technicians">
        <div className="portal-page py-12 text-center">
          <p className="mb-4 text-muted-foreground">{error || "Technician not found"}</p>
          <Button onClick={() => router.push("/admin/technicians")}>Back to Technicians</Button>
        </div>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell pageTitle={technician.name || technician.email} active="technicians">
      <div className="portal-page flex flex-col gap-[18px]">
        <Button variant="ghost" onClick={() => router.push("/admin/technicians")} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Technicians
        </Button>

        {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Card>
              <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-muted-foreground">Name</Label><p className="mt-1 text-lg font-medium">{technician.name || technician.email}</p></div>
                  <div><Label className="text-muted-foreground">Email</Label><p className="mt-1 font-medium">{technician.email}</p></div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="mb-2 flex items-center gap-2 text-muted-foreground"><Phone size={14} /> Phone</Label><p className="font-medium">{driver?.phone || technician.phone || "No phone"}</p></div>
                  <div><Label className="mb-2 flex items-center gap-2 text-muted-foreground"><Truck size={14} /> Vehicle</Label><p className="font-medium">{driver?.vehicle || "No vehicle assigned"}</p></div>
                </div>
                {driver?.city && <><Separator /><div><Label className="mb-2 flex items-center gap-2 text-muted-foreground"><MapPin size={14} /> City</Label><p className="font-medium">{driver.city}</p></div></>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Today&apos;s Jobs ({todaysJobs.length})</CardTitle></CardHeader>
              <CardContent>
                {todaysJobs.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No jobs assigned for today</p> : <div className="space-y-3">{todaysJobs.map((job) => <button key={job.id} type="button" className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50" onClick={() => router.push(`/admin/bookings/${job.id}`)}><div><p className="font-medium">{job.id}</p><p className="text-sm text-muted-foreground">{job.customer.name}</p><p className="mt-1 text-xs text-muted-foreground">{job.addressLine1}, {job.suburb}</p></div><div className="text-right"><Badge variant="outline">{job.status}</Badge><p className="mt-2 text-xs text-muted-foreground">{job.collectionSlot}</p></div></button>)}</div>}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Badge variant={driver?.isActive ? "status-new" : "outline"}>{driver ? (driver.isActive ? "Active" : "Inactive") : "No driver profile"}</Badge>
                {driver && <Button onClick={() => void handleToggleActive()} disabled={saving} variant={driver.isActive ? "destructive" : "default"} className="w-full">{saving ? "Updating..." : driver.isActive ? "Mark Inactive" : "Mark Active"}</Button>}
              </CardContent>
            </Card>
            {driver && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add useful context about this technician..." rows={5} maxLength={2000} /><Button onClick={() => void handleSaveNotes()} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Notes"}</Button></CardContent></Card>}
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
