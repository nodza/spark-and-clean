"use client";

import { create } from "zustand";
import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import { bookingService } from "@/services/bookingService";
import { statusAfterDriverAssign } from "@/lib/bookingAssignment";
import { rugAreaSqM } from "@/lib/fieldStatus";

export type FieldSizeUpdate = {
  widthM: number;
  lengthM: number;
};

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  fetchBookings: (opts?: { silent?: boolean }) => Promise<void>;
  fetchBookingById: (id: string) => Promise<Booking | undefined>;
  addBooking: (booking: Booking) => Promise<Booking | undefined>;
  /** null = success; string = error message for toast */
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    size?: FieldSizeUpdate | null
  ) => Promise<string | null>;
  updatePaymentStatus: (
    id: string,
    status: PaymentStatus
  ) => Promise<string | null>;
  assignDriver: (
    id: string,
    driverId: string | null
  ) => Promise<string | null>;
}

/**
 * In-memory UI cache only — source of truth is Mongo via /api/bookings.
 * Optimistic updates roll back on PATCH failure (no silent list refetch).
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
          const idx = state.bookings.findIndex((b) => b.id === id);
          if (idx === -1) {
            return { bookings: [booking, ...state.bookings], error: null };
          }
          const current = state.bookings[idx];
          if (
            current.updatedAt &&
            booking.updatedAt &&
            booking.updatedAt < current.updatedAt
          ) {
            return state;
          }
          const next = [...state.bookings];
          next[idx] = booking;
          return { bookings: next, error: null };
        });
      } else {
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== id),
        }));
      }
      return booking;
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: number }).status)
          : 0;
      if (status === 403 || status === 401) {
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== id),
          error: status === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
        }));
      } else {
        set({ error: "Failed to fetch booking" });
      }
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

  updateBookingStatus: async (id, status, size) => {
    const prev = get().bookings;
    set({
      error: null,
      bookings: prev.map((b) => {
        if (b.id !== id) return b;
        if (!size) return { ...b, status };
        return {
          ...b,
          status,
          rug: {
            ...b.rug,
            widthM: size.widthM,
            lengthM: size.lengthM,
            areaSqM: rugAreaSqM(size.widthM, size.lengthM),
          },
        };
      }),
    });
    try {
      const updated = await bookingService.updateStatus(id, status, size);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
      }));
      return null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update status";
      set({ error: message, bookings: prev });
      return message;
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
      return null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update payment";
      set({ error: message, bookings: prev });
      return message;
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
      return null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to assign driver";
      set({ error: message, bookings: prev });
      return message;
    }
  },
}));
