"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking, PaymentStatus } from "@/types/booking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, Calendar, MapPin, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAST_STATUSES = new Set(["DELIVERED", "CANCELLED"]);

function paymentBadgeVariant(
  status: PaymentStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PAID") return "default";
  if (status === "DEPOSIT") return "secondary";
  return "outline";
}

function PaymentBadge({
  status,
  emphasizeUnpaid = false,
}: {
  status: PaymentStatus;
  emphasizeUnpaid?: boolean;
}) {
  const isUnpaid = status === "UNPAID";
  return (
    <Badge
      variant={paymentBadgeVariant(status)}
      className={cn(
        emphasizeUnpaid &&
          isUnpaid &&
          "border-destructive text-destructive gap-1"
      )}
    >
      {emphasizeUnpaid && isUnpaid ? (
        <AlertCircle className="h-3 w-3" aria-hidden />
      ) : null}
      {status}
    </Badge>
  );
}

function BookingCard({
  booking,
  past = false,
}: {
  booking: Booking;
  past?: boolean;
}) {
  const unpaidActive = !past && booking.paymentStatus === "UNPAID";

  return (
    <Link href={`/booking/${booking.id}`} className="block group">
      <Card
        className={cn(
          "transition-colors group-hover:border-primary/40",
          past && "opacity-75 group-hover:opacity-100",
          unpaidActive && "border-destructive/40 bg-destructive/5"
        )}
      >
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-lg", past ? "font-medium" : "font-bold")}>
                #{booking.id}
              </span>
              <Badge variant={past ? "secondary" : "default"}>
                {booking.status}
              </Badge>
              <PaymentBadge
                status={booking.paymentStatus}
                emphasizeUnpaid={!past}
              />
            </div>
            {past ? (
              <p className="text-sm text-muted-foreground">
                {booking.rug.type} Rug ({booking.rug.widthM}x{booking.rug.lengthM}
                m)
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(booking.collectionDate), "PPP")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{booking.addressLine1}</span>
                </div>
              </>
            )}
          </div>
          <Button
            variant={past ? "ghost" : "outline"}
            size={past ? "sm" : "default"}
            asChild
          >
            <span>
              {past ? "View Details" : "Track Status"}{" "}
              {!past && <ArrowRight className="ml-2 h-4 w-4" />}
            </span>
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

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

  const { activeBookings, pastBookings } = useMemo(() => {
    if (!email) {
      return { activeBookings: [] as Booking[], pastBookings: [] as Booking[] };
    }

    const myBookings = bookings.filter(
      (b) => b.customer.email.toLowerCase() === email.toLowerCase()
    );
    const active = myBookings.filter((b) => !PAST_STATUSES.has(b.status));
    const past = myBookings
      .filter((b) => PAST_STATUSES.has(b.status))
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return { activeBookings: active, pastBookings: past };
  }, [bookings, email]);

  if (!email) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
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
        <section>
          <h2 className="mb-4 text-xl font-semibold">Active Orders</h2>
          {activeBookings.length === 0 ? (
            <Card className="border-dashed bg-secondary/10">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <p className="mb-4 text-muted-foreground">No active bookings.</p>
                <Link href="/book/rug">
                  <Button variant="outline">Book a Collection</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </section>

        {pastBookings.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Past Orders</h2>
            <div className="grid gap-4">
              {pastBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} past />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
