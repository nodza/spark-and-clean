"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { driverService } from "@/services/driverService";
import { useBookingStore } from "@/store/useBookingStore";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavItem, SidebarNavGroup } from "@/components/ui/sidebar-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Phone, Mail, Truck, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle: string;
  isActive: boolean;
  city?: string;
  notes?: string;
}

function AdminUserFooter() {
  return (
    <div className="flex items-center gap-[11px]">
      <div
        className="flex size-[36px] flex-none items-center justify-center rounded-full text-[14px] font-extrabold"
        style={{ background: "#6cf3d5", color: "#000b49" }}
      >
        LM
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-bold text-white">Lerato Mabaso</div>
        <div className="mt-[3px] text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
          Operations manager
        </div>
      </div>
    </div>
  );
}

export default function AdminDriverDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const { bookings, fetchBookings } = useBookingStore();
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Fetch bookings and all drivers
        await fetchBookings();
        const drivers = await driverService.getDrivers();
        setAllDrivers(drivers);
        
        // Try to find driver by ID from the list first
        let found = drivers.find((d) => d.id === id);
        
        // If not found, try fetching directly from API
        if (!found) {
          found = await driverService.getDriverById(id);
        }
        
        if (found) {
          setDriver(found);
        } else {
          setError("Driver not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load driver");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fetchBookings]);

  const handleToggleActive = async () => {
    if (!driver) return;
    setIsTogglingActive(true);
    try {
      const updated = await driverService.updateIsActive(driver.id, !driver.isActive);
      setDriver(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update driver");
    } finally {
      setIsTogglingActive(false);
    }
  };

  const todaysJobs = bookings.filter(
    (b) =>
      b.assignedDriverId === id &&
      b.collectionDate.startsWith(new Date().toISOString().split("T")[0])
  );

  const sidebar = (
    <SidebarNavGroup>
      <SidebarNavItem
        icon={<Calendar size={17} strokeWidth={1.8} />}
        label="Back to Technicians"
        onClick={() => router.back()}
      />
    </SidebarNavGroup>
  );

  if (loading) {
    return (
      <PortalLayout
        portalLabel="OPERATIONS"
        portalLabelColor="#ffdc39"
        sidebar={sidebar}
        sidebarFooter={<AdminUserFooter />}
        pageTitle="Loading..."
      >
        <div className="portal-page text-center py-12 text-muted-foreground">
          Loading driver profile...
        </div>
      </PortalLayout>
    );
  }

  if (!driver) {
    return (
      <PortalLayout
        portalLabel="OPERATIONS"
        portalLabelColor="#ffdc39"
        sidebar={sidebar}
        sidebarFooter={<AdminUserFooter />}
        pageTitle="Driver Not Found"
      >
        <div className="portal-page">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {error || "Driver not found"}
            </p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={sidebar}
      sidebarFooter={<AdminUserFooter />}
      pageTitle={driver.name}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="w-fit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Technicians
        </Button>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Profile Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium text-lg mt-1">{driver.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Driver ID</Label>
                    <p className="font-medium mt-1">{driver.id}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                      <Phone size={14} /> Phone
                    </Label>
                    <p className="font-medium">{driver.phone}</p>
                  </div>
                  {driver.email && (
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                        <Mail size={14} /> Email
                      </Label>
                      <p className="font-medium">{driver.email}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                    <Truck size={14} /> Current Vehicle
                  </Label>
                  <p className="font-medium">{driver.vehicle}</p>
                </div>

                {driver.city && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                        <MapPin size={14} /> City
                      </Label>
                      <p className="font-medium">{driver.city}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Today's Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Today's Jobs ({todaysJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todaysJobs.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">
                    No jobs assigned for today
                  </p>
                ) : (
                  <div className="space-y-3">
                    {todaysJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/bookings/${job.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{job.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.customer.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.addressLine1}, {job.suburb}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge variant="outline">{job.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-2">
                            {job.collectionSlot}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">
                    Availability
                  </Label>
                  <Badge
                    variant={driver.isActive ? "status-new" : "outline"}
                    className="text-base py-2 px-3"
                  >
                    {driver.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <Separator />

                <Button
                  onClick={handleToggleActive}
                  disabled={isTogglingActive}
                  variant={driver.isActive ? "destructive" : "default"}
                  className="w-full"
                >
                  {isTogglingActive
                    ? "Updating..."
                    : driver.isActive
                    ? "Mark Inactive"
                    : "Mark Active"}
                </Button>

                {!driver.isActive && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    Inactive drivers won't appear in booking assignment dropdowns
                  </p>
                )}
              </CardContent>
            </Card>

            {driver.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{driver.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
