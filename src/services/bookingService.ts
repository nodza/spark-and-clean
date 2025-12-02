import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import bookingsData from "@/data/bookings.json";

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class BookingService {
  // In Phase 1, we fetch from the API to demonstrate the architecture.
  
  async getBookings(): Promise<Booking[]> {
    // For client-side fetching
    if (typeof window !== 'undefined') {
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    }
    // Fallback for server-side or initial load if needed (though we use this in Zustand mostly)
    return bookingsData as Booking[];
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const bookings = await this.getBookings();
    return bookings.find((b) => b.id === id);
  }

  async createBooking(booking: Booking): Promise<Booking> {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (!res.ok) throw new Error("Failed to create booking");
    return res.json();
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    await delay(400);
    // In real app: await fetch(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    return { id, status } as any; // Partial return for mock
  }

  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<Booking> {
    await delay(400);
    return { id, paymentStatus: status } as any;
  }

  async assignDriver(id: string, driverId: string): Promise<Booking> {
    await delay(400);
    return { id, assignedDriverId: driverId, status: "SCHEDULED" } as any;
  }
}

export const bookingService = new BookingService();
