"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useBookingStore } from "@/store/useBookingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, DollarSign, Truck, Calendar as CalendarIcon, AlertCircle, Bell } from "lucide-react";

export default function AdminDashboard() {
  const { bookings, fetchBookings } = useBookingStore();

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Derived stats
  const today = new Date().toISOString().split("T")[0];
  const todaysPickups = bookings.filter(b => b.collectionDate.startsWith(today) && b.status === "SCHEDULED").length;
  const activeJobs = bookings.filter(b => ["COLLECTED", "CLEANING", "DRYING", "READY"].includes(b.status)).length;
  const unpaidCount = bookings.filter(b => b.paymentStatus === "UNPAID").length;
  const revenue = bookings.reduce((acc, b) => acc + (b.estimatedPriceMin + b.estimatedPriceMax) / 2, 0);

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Operations Dashboard</h1>
        <Link href="/admin/analytics">
          <Button variant="outline">View Analytics</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Pickups</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysPickups}</div>
            <p className="text-xs text-muted-foreground">Scheduled for collection</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs}</div>
            <p className="text-xs text-muted-foreground">In cleaning process</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Bookings</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{unpaidCount}</div>
            <p className="text-xs text-muted-foreground">Action required</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pipeline value</p>
          </CardContent>
        </Card>
      </div>

      {/* Notifications / Alerts */}
      <Card className="mb-8 border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            Notifications & Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {unpaidCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-orange-200">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{unpaidCount} Unpaid Booking{unpaidCount > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">Follow up on payment collection</p>
                </div>
                <Button size="sm" variant="outline">View</Button>
              </div>
            )}
            {todaysPickups > 0 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-200">
                <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{todaysPickups} Collection{todaysPickups > 1 ? 's' : ''} Today</p>
                  <p className="text-xs text-muted-foreground">Ensure drivers are assigned</p>
                </div>
                <Button size="sm" variant="outline">Assign</Button>
              </div>
            )}
            {activeJobs > 5 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                <CalendarIcon className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">High Volume Alert</p>
                  <p className="text-xs text-muted-foreground">{activeJobs} jobs in progress - consider capacity</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{booking.customer.name}</span>
                      <span className="text-xs text-muted-foreground">{booking.customer.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{booking.suburb}</TableCell>
                  <TableCell>
                    {format(new Date(booking.collectionDate), "MMM d")}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({booking.collectionSlot === "MORNING" ? "AM" : "PM"})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{booking.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={booking.paymentStatus === "PAID" ? "default" : "destructive"}>
                      {booking.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/bookings/${booking.id}`}>
                      <Button variant="ghost" size="sm">
                        View <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
