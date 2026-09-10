"use client";

import { create } from "zustand";
import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import { bookingService } from "@/services/bookingService";
import { statusAfterDriverAssign } from "@/lib/bookingAssignment";

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  fetchBookings: (opts?: { silent?: boolean }) => Promise<void>;
  fetchBookingById: (id: string) => Promise<Booking | undefined>;
  addBooking: (booking: Booking) => Promise<Booking | undefined>;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<boolean>;
  updatePaymentStatus: (id: string, status: PaymentStatus) => Promise<boolean>;
  assignDriver: (id: string, driverId: string | null) => Promise<boolean>;
}

/**
 * In-memory UI cache only — source of truth is Mongo via /api/bookings.
 * Optimistic updates roll back on PATCH failure.
 */
export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,

  fetchBookings: async (opts) => {
    const silent = opts?.silent === true;
    if (!silent) set({ isLoading: true, error: null });
    try {
      const data = await bookingService.getBookings();
      set({ bookings: data, isLoading: false, error: null });
    } catch {
      set({
        error: "Failed to fetch bookings",
        isLoading: silent ? get().isLoading : false,
      });
    }
  },

  fetchBookingById: async (id) => {
    try {
      const booking = await bookingService.getBookingById(id);
      if (booking) {
        set((state) => {
          const others = state.bookings.filter((b) => b.id !== id);
          return { bookings: [...others, booking] };
        });
      }
      return booking;
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: number }).status)
          : 0;
      set({ error: status === 403 ? "FORBIDDEN" : "Failed to fetch booking" });
      throw err;
    }
  },

  addBooking: async (booking) => {
    set({ isLoading: true, error: null });
    try {
      const newBooking = await bookingService.createBooking(booking);
      set((state) => ({
        bookings: [...state.bookings, newBooking],
        isLoading: false,
      }));
      return newBooking;
    } catch {
      set({ error: "Failed to create booking", isLoading: false });
      return undefined;
    }
  },

  updateBookingStatus: async (id, status) => {
    const prev = get().bookings;
    set({
      error: null,
      bookings: prev.map((b) => (b.id === id ? { ...b, status } : b)),
    });
    try {
      const updated = await bookingService.updateStatus(id, status);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update status";
      set({ error: message, bookings: prev });
      await get().fetchBookings({ silent: true });
      return false;
    }
  },

  updatePaymentStatus: async (id, status) => {
    const prev = get().bookings;
    set({
      error: null,
      bookings: prev.map((b) =>
        b.id === id ? { ...b, paymentStatus: status } : b
      ),
    });
    try {
      const updated = await bookingService.updatePaymentStatus(id, status);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update payment";
      set({ error: message, bookings: prev });
      await get().fetchBookings({ silent: true });
      return false;
    }
  },

  assignDriver: async (id, driverId) => {
    const prev = get().bookings;
    const nextDriver = driverId && driverId.length > 0 ? driverId : null;
    set({
      error: null,
      bookings: prev.map((b) => {
        if (b.id !== id) return b;
        const nextStatus = statusAfterDriverAssign(b.status, nextDriver);
        return {
          ...b,
          assignedDriverId: nextDriver ?? undefined,
          ...(nextStatus ? { status: nextStatus } : {}),
        };
      }),
    });
    try {
      const updated = await bookingService.assignDriver(id, nextDriver);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to assign driver";
      set({ error: message, bookings: prev });
      await get().fetchBookings({ silent: true });
      return false;
    }
  },
}));
