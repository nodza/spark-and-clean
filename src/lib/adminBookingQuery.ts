import type { Booking, BookingStatus, PaymentStatus } from "@/types/booking";

/** Default list sort: newest `createdAt` first. Toggle to soonest `collectionDate`. */
export type BookingListSort = "created" | "collection";

export const DEFAULT_BOOKING_SORT: BookingListSort = "created";

export type AdminBookingFilters = {
  status: string;
  payment: string;
  on: string;
  from: string;
  to: string;
  suburb: string;
  city: string;
  assigned: "" | "0" | "1";
  q: string;
  sort: BookingListSort;
};

export const EMPTY_BOOKING_FILTERS: AdminBookingFilters = {
  status: "",
  payment: "",
  on: "",
  from: "",
  to: "",
  suburb: "",
  city: "",
  assigned: "",
  q: "",
  sort: DEFAULT_BOOKING_SORT,
};

const BOOKING_STATUSES: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "DEPOSIT", "PAID"];

export function parseBookingListQuery(
  params: URLSearchParams | { get(name: string): string | null }
): AdminBookingFilters {
  const sortRaw = (params.get("sort") || "").trim();
  const assignedRaw = (params.get("assigned") || "").trim();
  const status = (params.get("status") || "").trim().toUpperCase();
  const payment = (params.get("payment") || "").trim().toUpperCase();

  return {
    status: BOOKING_STATUSES.includes(status as BookingStatus) ? status : "",
    payment: PAYMENT_STATUSES.includes(payment as PaymentStatus) ? payment : "",
    on: (params.get("on") || "").trim(),
    from: (params.get("from") || "").trim(),
    to: (params.get("to") || "").trim(),
    suburb: (params.get("suburb") || "").trim(),
    city: (params.get("city") || "").trim(),
    assigned: assignedRaw === "0" || assignedRaw === "1" ? assignedRaw : "",
    q: (params.get("q") || "").trim(),
    sort: sortRaw === "collection" ? "collection" : DEFAULT_BOOKING_SORT,
  };
}

export function bookingFiltersToSearchParams(
  filters: AdminBookingFilters
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.payment) params.set("payment", filters.payment);
  if (filters.on) params.set("on", filters.on);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.suburb) params.set("suburb", filters.suburb);
  if (filters.city) params.set("city", filters.city);
  if (filters.assigned) params.set("assigned", filters.assigned);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== DEFAULT_BOOKING_SORT) params.set("sort", filters.sort);
  return params;
}

export function bookingListHref(filters: Partial<AdminBookingFilters>): string {
  const params = bookingFiltersToSearchParams({
    ...EMPTY_BOOKING_FILTERS,
    ...filters,
  });
  const qs = params.toString();
  return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
}

export function collectionDay(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function matchesQuery(booking: Booking, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    booking.id,
    booking.customer.name,
    booking.customer.email,
    booking.customer.phone,
  ];
  if (haystacks.some((part) => part.toLowerCase().includes(needle))) return true;
  const qDigits = digitsOnly(q);
  if (qDigits.length >= 3 && digitsOnly(booking.customer.phone).includes(qDigits)) {
    return true;
  }
  return false;
}

export function filterBookings(
  bookings: Booking[],
  filters: AdminBookingFilters
): Booking[] {
  return bookings.filter((booking) => {
    if (filters.status && booking.status !== filters.status) return false;
    if (filters.payment && booking.paymentStatus !== filters.payment) return false;
    if (filters.suburb && booking.suburb.toLowerCase() !== filters.suburb.toLowerCase()) {
      return false;
    }
    if (filters.city && booking.city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }
    if (filters.assigned === "1" && !booking.assignedDriverId) return false;
    if (filters.assigned === "0" && booking.assignedDriverId) return false;

    const day = collectionDay(booking.collectionDate);
    if (filters.on && day !== filters.on) return false;
    if (!filters.on) {
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
    }

    if (!matchesQuery(booking, filters.q)) return false;
    return true;
  });
}

export function sortBookings(
  bookings: Booking[],
  sort: BookingListSort
): Booking[] {
  const copy = [...bookings];
  if (sort === "collection") {
    copy.sort((a, b) => {
      const day = collectionDay(a.collectionDate).localeCompare(
        collectionDay(b.collectionDate)
      );
      if (day !== 0) return day;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return copy;
  }
  copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return copy;
}

export function applyBookingListQuery(
  bookings: Booking[],
  filters: AdminBookingFilters
): Booking[] {
  return sortBookings(filterBookings(bookings, filters), filters.sort);
}
