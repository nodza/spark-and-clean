"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking } from "@/types/booking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Phone, Navigation, CheckCircle2, Package } from "lucide-react";

export default function TechJobDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { bookings, fetchBookings, updateBookingStatus } = useBookingStore();
  const [booking, setBooking] = useState<Booking | undefined>();

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (bookings.length > 0) {
      setBooking(bookings.find((b) => b.id === id));
    }
  }, [bookings, id]);

  if (!booking) return <div className="p-6">Loading job...</div>;

  const handleStatusUpdate = async (newStatus: "COLLECTED" | "DELIVERED") => {
    await updateBookingStatus(booking.id, newStatus);
    router.back(); // Go back to dashboard after action
  };

  return (
    <div className="container max-w-md mx-auto py-6 px-4 pb-20">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 pl-0 hover:bg-transparent">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Jobs
      </Button>

      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold">Job #{booking.id.slice(-4)}</h1>
          <Badge variant="outline" className="text-lg">{booking.status}</Badge>
        </div>
        <p className="text-muted-foreground">{booking.collectionSlot} Slot</p>
      </div>

      <div className="space-y-6">
        {/* Customer & Location */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{booking.customer.name}</h3>
                <p className="text-sm text-muted-foreground">{booking.addressLine1}</p>
                <p className="text-sm text-muted-foreground">{booking.suburb}, {booking.city}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button className="flex-1" variant="outline">
                <Navigation className="mr-2 h-4 w-4" /> Navigate
              </Button>
              <Button className="flex-1" variant="outline">
                <Phone className="mr-2 h-4 w-4" /> Call
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rug Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rug Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{booking.rug.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{booking.rug.widthM}m x {booking.rug.lengthM}m</span>
            </div>
            {booking.rug.photos && booking.rug.photos.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {booking.rug.photos.map((photo, i) => (
                    <img key={i} src={photo} alt="Rug" className="h-16 w-16 object-cover rounded border" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="container max-w-md mx-auto flex gap-4">
            {booking.status === "SCHEDULED" && (
              <Button className="w-full text-lg h-12" onClick={() => handleStatusUpdate("COLLECTED")}>
                <Package className="mr-2 h-5 w-5" /> Mark Collected
              </Button>
            )}
            {booking.status === "READY" && (
              <Button className="w-full text-lg h-12" onClick={() => handleStatusUpdate("DELIVERED")}>
                <CheckCircle2 className="mr-2 h-5 w-5" /> Mark Delivered
              </Button>
            )}
            {/* If in other status, maybe show disabled or different actions */}
            {["COLLECTED", "CLEANING", "DRYING"].includes(booking.status) && (
              <Button disabled className="w-full text-lg h-12 variant-secondary">
                In Progress at Depot
              </Button>
            )}
             {booking.status === "DELIVERED" && (
              <Button disabled className="w-full text-lg h-12 variant-outline">
                Job Completed
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
