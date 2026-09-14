import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

class BookingService {
  async getBookings(): Promise<Booking[]> {
    const res = await fetch("/api/bookings", { credentials: "include" });
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch bookings"));
    return res.json();
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const res = await fetch(`/api/bookings/${id}`, { credentials: "include" });
    if (res.status === 404) return undefined;
    if (res.status === 403) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch booking"));
    return res.json();
  }

  async createBooking(booking: Booking): Promise<Booking> {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(booking),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to create booking"));
    return res.json();
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to update status"));
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
    if (!res.ok) throw new Error(await readError(res, "Failed to update payment"));
    return res.json();
  }

  /** Pass null (or empty string) to unassign. */
  async assignDriver(
    id: string,
    driverId: string | null
  ): Promise<Booking> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        assignedDriverId: driverId && driverId.length > 0 ? driverId : null,
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to assign driver"));
    return res.json();
  }
}

export const bookingService = new BookingService();
