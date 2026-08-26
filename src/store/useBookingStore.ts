"use client";

import { create } from "zustand";
import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import { bookingService } from "@/services/bookingService";

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  fetchBookings: () => Promise<void>;
  fetchBookingById: (id: string) => Promise<Booking | undefined>;
  addBooking: (booking: Booking) => Promise<Booking | undefined>;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  updatePaymentStatus: (id: string, status: PaymentStatus) => Promise<void>;
  assignDriver: (id: string, driverId: string) => Promise<void>;
}

/**
 * In-memory UI cache only — source of truth is Mongo via /api/bookings.
 * No localStorage persist (avoids stale offline bookings).
 */
export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,

  fetchBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await bookingService.getBookings();
      set({ bookings: data, isLoading: false });
    } catch {
      set({ error: "Failed to fetch bookings", isLoading: false });
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
    } catch {
      set({ error: "Failed to fetch booking" });
      return undefined;
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
      bookings: prev.map((b) => (b.id === id ? { ...b, status } : b)),
    });
    try {
      const updated = await bookingService.updateStatus(id, status);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
    } catch {
      set({ error: "Failed to update status", bookings: prev });
      await get().fetchBookings();
    }
  },

  updatePaymentStatus: async (id, status) => {
    const prev = get().bookings;
    set({
      bookings: prev.map((b) =>
        b.id === id ? { ...b, paymentStatus: status } : b
      ),
    });
    try {
      const updated = await bookingService.updatePaymentStatus(id, status);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
    } catch {
      set({ error: "Failed to update payment", bookings: prev });
      await get().fetchBookings();
    }
  },

  assignDriver: async (id, driverId) => {
    const prev = get().bookings;
    set({
      bookings: prev.map((b) =>
        b.id === id
          ? { ...b, assignedDriverId: driverId, status: "SCHEDULED" }
          : b
      ),
    });
    try {
      const updated = await bookingService.assignDriver(id, driverId);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
    } catch {
      set({ error: "Failed to assign driver", bookings: prev });
      await get().fetchBookings();
    }
  },
}));
