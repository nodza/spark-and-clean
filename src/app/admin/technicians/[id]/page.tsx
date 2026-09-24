"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarDays,
  CalendarRange,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Truck,
  User,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { driverService } from "@/services/driverService";
import { useBookingStore } from "@/store/useBookingStore";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_NOTE_LEN } from "@/lib/internalNotes";
import { localCalendarDate } from "@/lib/localCalendarDate";
import {
  technicianJobsOnDay,
  technicianUpcomingJobs,
} from "@/lib/technicianJobs";
import type { Booking, Driver, InternalNote } from "@/types/booking";

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

function formatNoteTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : format(parsed, "PPp");
}

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-meta" style={{ color: "#9aa0a6" }}>
      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
      {children}
    </div>
  );
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
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(
    async (driverId: string, signal?: AbortSignal) => {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const res = await fetch(`/api/drivers/${driverId}/notes`, {
          credentials: "include",
          signal,
        });
        if (signal?.aborted) return;
        if (!res.ok) {
          setNotesError("Could not load notes");
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        const list: InternalNote[] = Array.isArray(data.notes) ? data.notes : [];
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setNotes(list);
      } catch (err) {
        if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setNotesError("Could not load notes");
      } finally {
        if (!signal?.aborted) setNotesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setNotesLoading(true);
      try {
        const [response] = await Promise.all([
          fetch(`/api/admin/technicians/${technicianId}`, {
            credentials: "include",
            signal: abort.signal,
          }),
          fetchBookings({ silent: true }),
        ]);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load technician");
        }
        if (cancelled || abort.signal.aborted) return;
        setTechnician(data.technician as Technician);
        const profile = (data.driver as Driver | null) ?? null;
        setDriver(profile);
        if (profile?.id) {
          await loadNotes(profile.id, abort.signal);
        } else {
          setNotes([]);
          setNotesLoading(false);
        }
      } catch (err) {
        if (
          cancelled ||
          abort.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        setTechnician(null);
        setDriver(null);
        setNotes([]);
        setNotesLoading(false);
        setError(
          err instanceof Error ? err.message : "Could not load technician"
        );
      } finally {
        if (!cancelled && !abort.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [fetchBookings, loadNotes, technicianId]);

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

  const addNote = async () => {
    if (!driver) return;
    const body = noteDraft.trim();
    setNoteError(null);
    if (!body) return;
    if (body.length > MAX_NOTE_LEN) {
      setNoteError(`Note must be at most ${MAX_NOTE_LEN} characters`);
      return;
    }

    setNoteSaving(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteError(
          typeof data.error === "string" ? data.error : "Failed to add note"
        );
        return;
      }
      const created = data.note as InternalNote | undefined;
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setNotesError(null);
      } else {
        await loadNotes(driver.id);
      }
      setNoteDraft("");
    } catch {
      setNoteError("Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  const title = technician?.name || technician?.email || "Technician";

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
                  <FieldLabel icon={User}>Name</FieldLabel>
                  <p className="mt-1 text-[16px] font-bold text-[#000b49]">
                    {technician.name || technician.email}
                  </p>
                </div>
                <div>
                  <FieldLabel icon={Mail}>Email</FieldLabel>
                  <p className="mt-1 font-medium text-[#000b49]">{technician.email}</p>
                </div>
                <div>
                  <FieldLabel icon={Phone}>Phone</FieldLabel>
                  <p className="mt-1 font-medium text-[#000b49]">
                    {driver?.phone || technician.phone || "No phone"}
                  </p>
                </div>
                <div>
                  <FieldLabel icon={Truck}>Vehicle</FieldLabel>
                  <p className="mt-1 font-medium text-[#000b49]">
                    {driver?.vehicle || technician.vehicle || "No vehicle assigned"}
                  </p>
                  <Link
                    href="/admin/vehicles"
                    className="mt-1 inline-block text-[12px] font-bold text-[#0a7a63] hover:underline"
                  >
                    Manage on Vehicles
                  </Link>
                </div>
                {driver?.city ? (
                  <div className="sm:col-span-2">
                    <FieldLabel icon={MapPin}>City</FieldLabel>
                    <p className="mt-1 font-medium text-[#000b49]">{driver.city}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ds-card">
              <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
                <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />
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
              <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
                <CalendarRange size={14} strokeWidth={1.8} aria-hidden="true" />
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
              <div className="flex items-center gap-2 text-eyebrow" style={{ color: "#9aa0a6" }}>
                <UserCog size={14} strokeWidth={1.8} aria-hidden="true" />
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
                <div
                  className="flex items-center gap-2 text-eyebrow"
                  style={{ color: "#6b7280" }}
                >
                  <StickyNote size={14} strokeWidth={1.8} aria-hidden="true" />
                  INTERNAL NOTES
                </div>
                <Label htmlFor="technician-internal-note" className="sr-only">
                  Internal note
                </Label>
                <Textarea
                  id="technician-internal-note"
                  className="mt-[14px] placeholder:text-xs"
                  value={noteDraft}
                  onChange={(event) => {
                    setNoteDraft(event.target.value);
                    if (noteError) setNoteError(null);
                  }}
                  placeholder="Bakkie in for service Friday, prefers northern suburbs…"
                  rows={3}
                  maxLength={MAX_NOTE_LEN}
                  aria-invalid={noteError ? true : undefined}
                  aria-describedby={
                    noteError ? "technician-internal-note-error" : undefined
                  }
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-meta" style={{ color: "#9aa0a6" }}>
                    {noteDraft.trim().length}/{MAX_NOTE_LEN}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={noteSaving || !noteDraft.trim()}
                    onClick={() => void addNote()}
                  >
                    {noteSaving ? "Adding…" : "Add"}
                  </Button>
                </div>
                {noteError ? (
                  <p
                    id="technician-internal-note-error"
                    role="alert"
                    className="mt-2 text-xs"
                    style={{ color: "#b3261e" }}
                  >
                    {noteError}
                  </p>
                ) : null}

                <div className="mt-[14px] border-t border-[#f0f2f6] pt-[14px]">
                  {notesLoading ? (
                    <p className="text-meta" style={{ color: "#9aa0a6" }}>
                      Loading notes…
                    </p>
                  ) : notesError ? (
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className="text-sm"
                        style={{ color: "#b3261e" }}
                        role="alert"
                      >
                        {notesError}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadNotes(driver.id)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : notes.length === 0 ? (
                    <p
                      className="text-sm italic"
                      style={{ color: "#9aa0a6" }}
                    >
                      No internal notes yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {notes.map((note) => (
                        <li
                          key={note.id}
                          className="rounded-[10px] border border-[#f0f2f6] bg-[#f7f9fb] px-3 py-3"
                        >
                          <p className="text-sm whitespace-pre-wrap text-[#000b49]">
                            {note.body}
                          </p>
                          <p
                            className="mt-2 text-xs"
                            style={{ color: "#9aa0a6" }}
                          >
                            {note.author}
                            {" · "}
                            {formatNoteTime(note.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="ds-card">
                <div
                  className="flex items-center gap-2 text-eyebrow"
                  style={{ color: "#6b7280" }}
                >
                  <StickyNote size={14} strokeWidth={1.8} aria-hidden="true" />
                  INTERNAL NOTES
                </div>
                <p className="text-body mt-[14px]" style={{ color: "#6b7280" }}>
                  Internal notes are stored on the driver profile. Add a vehicle
                  to this technician so a driver profile exists, then you can
                  leave ops notes here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}
