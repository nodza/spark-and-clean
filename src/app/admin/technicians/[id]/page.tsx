"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { driverService } from "@/services/driverService";
import { useBookingStore } from "@/store/useBookingStore";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_DRIVER_NOTE_LEN } from "@/lib/driverProfile";
import { localCalendarDate } from "@/lib/localCalendarDate";
import {
  technicianJobsOnDay,
  technicianUpcomingJobs,
} from "@/lib/technicianJobs";
import type { Booking, Driver } from "@/types/booking";

type Technician = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  driverProfileId?: string;
  vehicle?: string | null;
  driverIsActive?: boolean | null;
  disabledAt?: string | null;
};

function statusVariant(
  status: string
): React.ComponentProps<typeof Badge>["variant"] {
  const value = status.toUpperCase();
  if (value === "BOOKED" || value === "SCHEDULED") return "status-new";
  if (value === "COLLECTED") return "status-collected";
  if (value === "CLEANING" || value === "DRYING" || value === "READY") {
    return "status-cleaning";
  }
  if (value === "DELIVERED") return "status-completed";
  return "outline";
}

function JobList({ jobs }: { jobs: Booking[] }) {
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/admin/bookings/${job.id}`}
          className="flex items-center justify-between gap-3 rounded-[10px] border border-[#f0f2f6] p-3 transition-colors hover:bg-[#f7f8fb]"
        >
          <div className="min-w-0">
            <p className="font-medium text-[#000b49]">{job.id}</p>
            <p className="text-sm text-[#6b7280]">{job.customer.name}</p>
            <p className="mt-1 text-xs text-[#9aa0a6]">
              {job.addressLine1}, {job.suburb}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            <p className="mt-2 text-xs text-[#9aa0a6]">
              {format(new Date(job.collectionDate), "d MMM")} · {job.collectionSlot}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function TechnicianProfilePage() {
  const params = useParams<{ id: string }>();
  const technicianId = params.id;
  const { bookings, fetchBookings } = useBookingStore();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [response] = await Promise.all([
          fetch(`/api/admin/technicians/${technicianId}`, {
            credentials: "include",
          }),
          fetchBookings({ silent: true }),
        ]);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load technician");
        }
        if (cancelled) return;
        setTechnician(data.technician as Technician);
        const profile = (data.driver as Driver | null) ?? null;
        setDriver(profile);
        setNotes(profile?.notes || "");
      } catch (err) {
        if (!cancelled) {
          setTechnician(null);
          setDriver(null);
          setError(
            err instanceof Error ? err.message : "Could not load technician"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchBookings, technicianId]);

  const today = localCalendarDate();
  const driverId = driver?.id ?? technician?.driverProfileId;
  const assignmentActive = driver
    ? driver.isActive !== false && !technician?.disabledAt
    : null;
  const todaysJobs = useMemo(
    () => technicianJobsOnDay(bookings, driverId, today),
    [bookings, driverId, today]
  );
  const upcomingJobs = useMemo(
    () => technicianUpcomingJobs(bookings, driverId, today),
    [bookings, driverId, today]
  );

  const handleToggleActive = async () => {
    if (!driver) return;
    setSavingStatus(true);
    setError(null);
    try {
      const nextActive = assignmentActive === false;
      const updated = await driverService.updateIsActive(driver.id, nextActive);
      setDriver(updated);
      setTechnician((current) =>
        current
          ? {
              ...current,
              driverIsActive: updated.isActive,
              disabledAt: updated.isActive ? null : new Date().toISOString(),
            }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!driver) return;
    setSavingNotes(true);
    setError(null);
    try {
      const updated = await driverService.updateDriver(driver.id, { notes });
      setDriver(updated);
      setNotes(updated.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const title = technician?.name || technician?.email || "Technician";
  const notesDirty = (driver?.notes || "") !== notes;

  if (loading) {
    return (
      <AdminPortalShell pageTitle="Technician" active="technicians">
        <div className="portal-page py-12 text-center text-meta" role="status">
          Loading technician…
        </div>
      </AdminPortalShell>
    );
  }

  if (!technician) {
    return (
      <AdminPortalShell pageTitle="Technician" active="technicians">
        <div className="portal-page flex flex-col gap-[18px]">
          <AdminBackLink href="/admin/technicians">Back to Technicians</AdminBackLink>
          <div className="ds-card py-[40px] text-center">
            <p className="text-meta" style={{ color: "#9aa0a6" }}>
              {error || "Technician not found"}
            </p>
          </div>
        </div>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell pageTitle={title} active="technicians">
      <div className="portal-page flex flex-col gap-[18px]">
        <AdminBackLink href="/admin/technicians">Back to Technicians</AdminBackLink>

        {error ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-[18px] lg:grid-cols-3">
          <div className="flex flex-col gap-[18px] lg:col-span-2">
            <div className="ds-card">
              <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                PROFILE
              </div>
              <div className="mt-[14px] grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    Name
                  </div>
                  <p className="mt-1 text-[16px] font-bold text-[#000b49]">
                    {technician.name || technician.email}
                  </p>
                </div>
                <div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    Email
                  </div>
                  <p className="mt-1 font-medium text-[#000b49]">{technician.email}</p>
                </div>
                <div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    Phone
                  </div>
                  <p className="mt-1 font-medium text-[#000b49]">
                    {driver?.phone || technician.phone || "No phone"}
                  </p>
                </div>
                <div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    Vehicle
                  </div>
                  <p className="mt-1 font-medium text-[#000b49]">
                    {driver?.vehicle || technician.vehicle || "No vehicle assigned"}
                  </p>
                </div>
                {driver?.city ? (
                  <div className="sm:col-span-2">
                    <div className="text-meta" style={{ color: "#9aa0a6" }}>
                      City
                    </div>
                    <p className="mt-1 font-medium text-[#000b49]">{driver.city}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ds-card">
              <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                TODAY&apos;S JOBS
              </div>
              <p className="mt-[6px] text-[15px] font-bold text-[#000b49]">
                {todaysJobs.length} assigned today
              </p>
              <div className="mt-[14px]">
                {todaysJobs.length === 0 ? (
                  <p className="text-meta" style={{ color: "#9aa0a6" }}>
                    No jobs assigned for today
                  </p>
                ) : (
                  <JobList jobs={todaysJobs} />
                )}
              </div>
            </div>

            <div className="ds-card">
              <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                UPCOMING JOBS
              </div>
              <p className="mt-[6px] text-[15px] font-bold text-[#000b49]">
                {upcomingJobs.length} after today
              </p>
              <div className="mt-[14px]">
                {upcomingJobs.length === 0 ? (
                  <p className="text-meta" style={{ color: "#9aa0a6" }}>
                    No upcoming jobs
                  </p>
                ) : (
                  <JobList jobs={upcomingJobs} />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[18px]">
            <div className="ds-card">
              <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                ASSIGNMENT
              </div>
              <div className="mt-[14px] flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-wide"
                  style={
                    assignmentActive === true
                      ? { background: "#eafaf5", color: "#0a7a63" }
                      : assignmentActive === false
                        ? { background: "#fdecec", color: "#b33232" }
                        : { background: "#f0f2f6", color: "#6b7280" }
                  }
                >
                  {assignmentActive === true
                    ? "ACTIVE"
                    : assignmentActive === false
                      ? "INACTIVE"
                      : "NO DRIVER PROFILE"}
                </span>
                {technician.disabledAt ? (
                  <span
                    className="rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-wide"
                    style={{ background: "#fff4d6", color: "#8a6d00" }}
                  >
                    LOGIN DISABLED
                  </span>
                ) : null}
              </div>
              <p className="text-meta mt-[10px]" style={{ color: "#9aa0a6" }}>
                Inactive also disables their technician login. They stay on this
                page but cannot be assigned to new jobs.
              </p>
              {driver ? (
                <Button
                  className="mt-[14px] w-full"
                  onClick={() => void handleToggleActive()}
                  disabled={savingStatus}
                  variant={assignmentActive ? "destructive" : "default"}
                >
                  {savingStatus
                    ? "Updating…"
                    : assignmentActive
                      ? "Mark inactive"
                      : "Mark active"}
                </Button>
              ) : null}
            </div>

            {driver ? (
              <div className="ds-card">
                <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
                  NOTES
                </div>
                <Label htmlFor="driver-notes" className="sr-only">
                  Driver notes
                </Label>
                <Textarea
                  id="driver-notes"
                  className="mt-[14px]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add useful context about this technician…"
                  rows={5}
                  maxLength={MAX_DRIVER_NOTE_LEN}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-meta" style={{ color: "#9aa0a6" }}>
                    {notes.length}/{MAX_DRIVER_NOTE_LEN}
                  </p>
                  <Button
                    onClick={() => void handleSaveNotes()}
                    disabled={savingNotes || !notesDirty}
                  >
                    {savingNotes ? "Saving…" : "Save notes"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
