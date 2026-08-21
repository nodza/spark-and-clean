"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBookingStore } from "@/store/useBookingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, MapPin, Plus } from "lucide-react";
import { format } from "date-fns";

export default function ClientDashboard() {
  const router = useRouter();
  const { bookings, fetchBookings } = useBookingStore();
  const [email] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("clientEmail")
  );

  useEffect(() => {
    const storedEmail = localStorage.getItem("clientEmail");
    if (!storedEmail) {
      router.push("/login");
    } else {
      if (bookings.length === 0) fetchBookings();
    }
  }, [bookings.length, fetchBookings, router]);

  if (!email) return null;

  const myBookings = bookings.filter(b => b.customer.email.toLowerCase() === email.toLowerCase());
  const activeBookings = myBookings.filter(b => !["DELIVERED", "CANCELLED"].includes(b.status));
  const pastBookings = myBookings.filter(b => ["DELIVERED", "CANCELLED"].includes(b.status));

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">Welcome back, {email}</p>
        </div>
        <Link href="/book/rug">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Booking
          </Button>
        </Link>
      </div>

      <div className="space-y-8">
        {/* Active Bookings */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
          {activeBookings.length === 0 ? (
            <Card className="bg-secondary/10 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-muted-foreground mb-4">No active bookings.</p>
                <Link href="/book/rug">
                  <Button variant="outline">Book a Collection</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeBookings.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{booking.id}</span>
                        <Badge>{booking.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(booking.collectionDate), "PPP")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.addressLine1}</span>
                      </div>
                    </div>
                    <Link href={`/booking/${booking.id}`}>
                      <Button variant="outline">
                        Track Status <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Past Orders</h2>
            <div className="grid gap-4">
              {pastBookings.map((booking) => (
                <Card key={booking.id} className="opacity-75 hover:opacity-100 transition-opacity">
                  <CardContent className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{booking.id}</span>
                        <Badge variant="secondary">{booking.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {booking.rug.type} Rug ({booking.rug.widthM}x{booking.rug.lengthM}m)
                      </p>
                    </div>
                    <Link href={`/booking/${booking.id}`}>
                      <Button variant="ghost" size="sm">View Details</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
