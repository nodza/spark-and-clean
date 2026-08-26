"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useBookingStore } from "@/store/useBookingStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useRequireAuth } from "@/hooks/useRequireClientAuth";

export default function TechDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const { user, ready } = useRequireAuth(["DRIVER"], "/tech");
  const { bookings, fetchBookings } = useBookingStore();

  useEffect(() => {
    if (ready) void fetchBookings();
  }, [ready, fetchBookings]);

  if (!ready || !user) return null;

  const driverId = user.driverProfileId;
  const myJobs = bookings.filter(
    (b) => b.assignedDriverId === driverId && b.status !== "DELIVERED"
  );

  const handleLogout = async () => {
    await logout();
    router.push("/tech");
  };

  return (
    <div className="container max-w-md mx-auto py-6 px-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">
            Hello, {(user.name || user.email).split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            You have {myJobs.length} active jobs.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void handleLogout()}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-4">
        <Link href="/tech/map">
          <Button variant="outline" className="w-full">
            <MapPin className="mr-2 h-4 w-4" /> View Map Route
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {myJobs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No jobs assigned yet.</p>
            <p className="text-sm">Check with dispatch.</p>
          </div>
        ) : (
          myJobs.map((job) => (
            <Link key={job.id} href={`/tech/job/${job.id}`}>
              <Card className="active:scale-95 transition-transform mb-2">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge
                      variant={
                        job.status === "COLLECTED" ? "secondary" : "default"
                      }
                    >
                      {job.status}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      #{job.id.slice(-4)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-1">
                    {job.customer.name}
                  </h3>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        {job.addressLine1}, {job.suburb}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{job.collectionSlot}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary p-0 h-auto hover:bg-transparent"
                    >
                      View Details <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
