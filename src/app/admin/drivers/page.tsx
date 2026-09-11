"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { driverService } from "@/services/driverService";
import { useBookingStore } from "@/store/useBookingStore";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavItem, SidebarNavGroup } from "@/components/ui/sidebar-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  CalendarDays,
  Users,
  UserCog,
  Tag,
  ChevronRight,
  Phone,
  Truck,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle: string;
  isActive: boolean;
  city?: string;
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

export default function AdminDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { bookings, fetchBookings } = useBookingStore();

  useEffect(() => {
    Promise.all([
      fetchBookings(),
      driverService.getDrivers().then(setDrivers).catch((err) => {
        setError(err.message);
        setDrivers([]);
      }),
    ]).finally(() => setLoading(false));
  }, [fetchBookings]);

  const getJobCountToday = (driverId: string) => {
    const today = new Date().toISOString().split("T")[0];
    return bookings.filter(
      (b) =>
        b.assignedDriverId === driverId &&
        b.collectionDate.startsWith(today)
    ).length;
  };

  const sidebar = (
    <SidebarNavGroup>
      <SidebarNavItem
        icon={<LayoutGrid size={17} strokeWidth={1.8} />}
        label="Overview"
        onClick={() => router.push("/admin")}
      />
      <SidebarNavItem
        icon={<CalendarDays size={17} strokeWidth={1.8} />}
        label="Bookings"
        badge={bookings.length || 12}
        onClick={() => router.push("/admin/bookings")}
      />
      <SidebarNavItem
        icon={<UserCog size={17} strokeWidth={1.8} />}
        label="Technicians"
        active
      />
      <SidebarNavItem
        icon={<Users size={17} strokeWidth={1.8} />}
        label="Clients"
      />
      <SidebarNavItem
        icon={<Tag size={17} strokeWidth={1.8} />}
        label="Pricing & coupons"
      />
    </SidebarNavGroup>
  );

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={sidebar}
      sidebarFooter={<AdminUserFooter />}
      pageTitle="Technicians"
    >
      <div className="portal-page">
        <Card>
          <CardHeader>
            <CardTitle>Driver Management</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading drivers...
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No drivers found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                        Phone
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                        Vehicle
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                        Jobs Today
                      </th>
                      <th className="text-center py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr
                        key={driver.id}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/drivers/${driver.id}`)}
                      >
                        <td className="py-3 px-4 font-medium">{driver.name}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-muted-foreground" />
                            {driver.phone}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Truck size={14} className="text-muted-foreground" />
                            {driver.vehicle}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={driver.isActive ? "status-new" : "outline"}
                          >
                            {driver.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-muted px-2 py-1 rounded text-xs font-medium">
                            {getJobCountToday(driver.id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <ChevronRight size={18} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
