"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBookingStore } from "@/store/useBookingStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  MapPinned,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useRequireAuth } from "@/hooks/useRequireClientAuth";
import { technicianDoneToday, technicianTodayStops } from "@/lib/technicianJobs";
import { johannesburgCalendarDate } from "@/lib/localCalendarDate";
import type { Booking } from "@/types/booking";

function statusVariant(
  status: Booking["status"]
): React.ComponentProps<typeof Badge>["variant"] {
  if (status === "DELIVERED") return "secondary";
  if (status === "READY") return "default";
  return "outline";
}

function JobCard({ job }: { job: Booking }) {
  return (
    <Link href={`/tech/job/${job.id}`} className="block">
      <Card className="transition-transform active:scale-[0.99]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{job.customer.name}</h3>
              <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{job.addressLine1}, {job.suburb}</span>
              </p>
            </div>
            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {job.collectionSlot}
            </span>
            <span className="font-mono text-xs">{job.id}</span>
          </div>
          <div className="mt-3 flex justify-end text-sm font-medium text-primary">
            View stop <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StopSection({ title, jobs }: { title: string; jobs: Booking[] }) {
  return (
    <section aria-labelledby={`${title.toLowerCase()}-stops`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 id={`${title.toLowerCase()}-stops`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{jobs.length}</span>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </div>
    </section>
  );
}

export default function TechDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const { user, ready } = useRequireAuth(["technician"], "/tech");
  const { bookings, fetchBookings, isLoading } = useBookingStore();
  const [doneOpen, setDoneOpen] = useState(false);

  useEffect(() => {
    if (ready) void fetchBookings();
  }, [ready, fetchBookings]);

  if (!ready || !user) return null;

  const today = johannesburgCalendarDate();
  const stops = technicianTodayStops(bookings, user.driverProfileId, today);
  const done = technicianDoneToday(bookings, user.driverProfileId, today);
  const morning = stops.filter((job) => job.collectionSlot === "MORNING");
  const afternoon = stops.filter((job) => job.collectionSlot === "AFTERNOON");

  const handleLogout = async () => {
    await logout();
    router.push("/tech");
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-6 pb-20">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Today, {today}</p>
          <h1 className="text-2xl font-bold">Hello, {(user.name || user.email).split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {stops.length} stop{stops.length === 1 ? "" : "s"} on your route
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void fetchBookings()}
            disabled={isLoading}
            aria-label="Refresh today's stops"
          >
            <RefreshCw className={isLoading ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void handleLogout()} aria-label="Log out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <Link href="/tech/map">
          <Button variant="outline" className="w-full">
            <MapPinned className="mr-2 h-4 w-4" /> View Map Route
          </Button>
        </Link>
      </div>

      {stops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="font-semibold">No stops for today</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dispatch has not assigned any pickups or returns to you yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {morning.length > 0 ? <StopSection title="Morning" jobs={morning} /> : null}
          {afternoon.length > 0 ? <StopSection title="Afternoon" jobs={afternoon} /> : null}
        </div>
      )}

      <section className="mt-8 border-t pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            onClick={() => setDoneOpen((open) => !open)}
            aria-expanded={doneOpen}
          >
            <span>Done today ({done.length})</span>
            <ChevronDown className={doneOpen ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
          </button>
          {doneOpen && done.length > 0 ? (
            <div className="mt-3 space-y-3">
              {done.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          ) : null}
      </section>
    </div>
  );
}
