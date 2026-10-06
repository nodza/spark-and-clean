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

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

class BookingService {
  async getBookings(): Promise<Booking[]> {
    const res = await fetch("/api/bookings", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch bookings"));
    return res.json();
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const res = await fetch(`/api/bookings/${id}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 404) return undefined;
    if (res.status === 401) {
      throw httpError("Unauthorized", 401);
    }
    if (res.status === 403) {
      throw httpError("Forbidden", 403);
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

  async updateStatus(
    id: string,
    status: BookingStatus,
    size?: { widthM: number; lengthM: number } | null
  ): Promise<Booking> {
    const payload: {
      status: BookingStatus;
      widthM?: number;
      lengthM?: number;
    } = { status };
    if (
      size &&
      Number.isFinite(size.widthM) &&
      Number.isFinite(size.lengthM)
    ) {
      payload.widthM = size.widthM;
      payload.lengthM = size.lengthM;
    }
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      throw httpError("Unauthorized", 401);
    }
    if (res.status === 403) {
      throw httpError("You can only update your own jobs", 403);
    }
    if (!res.ok) {
      throw httpError(
        await readError(res, "Failed to update status"),
        res.status
      );
    }
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
