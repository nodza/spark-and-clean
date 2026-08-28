import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";

class BookingService {
  async getBookings(): Promise<Booking[]> {
    const res = await fetch("/api/bookings", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch bookings");
    return res.json();
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const res = await fetch(`/api/bookings/${id}`, { credentials: "include" });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error("Failed to fetch booking");
    return res.json();
  }

  async createBooking(booking: Booking): Promise<Booking> {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(booking),
    });
    if (!res.ok) throw new Error("Failed to create booking");
    return res.json();
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update status");
    return res.json();
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus
  ): Promise<Booking> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ paymentStatus: status }),
    });
    if (!res.ok) throw new Error("Failed to update payment");
    return res.json();
  }

  async assignDriver(id: string, driverId: string): Promise<Booking> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ assignedDriverId: driverId }),
    });
    if (!res.ok) throw new Error("Failed to assign driver");
    return res.json();
  }
}

export const bookingService = new BookingService();
