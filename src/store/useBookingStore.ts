import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import { bookingService } from "@/services/bookingService";

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchBookings: () => Promise<void>;
  addBooking: (booking: Booking) => Promise<void>;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  updatePaymentStatus: (id: string, status: PaymentStatus) => Promise<void>;
  assignDriver: (id: string, driverId: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      bookings: [],
      isLoading: false,
      error: null,

      fetchBookings: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await bookingService.getBookings();
          set({ bookings: data, isLoading: false });
        } catch (err) {
          set({ error: "Failed to fetch bookings", isLoading: false });
        }
      },

      addBooking: async (booking) => {
        set({ isLoading: true, error: null });
        try {
          const newBooking = await bookingService.createBooking(booking);
          set((state) => ({ 
            bookings: [...state.bookings, newBooking],
            isLoading: false 
          }));
        } catch (err) {
          set({ error: "Failed to create booking", isLoading: false });
        }
      },

      updateBookingStatus: async (id, status) => {
        // Optimistic update
        set((state) => ({
          bookings: state.bookings.map((b) => 
            b.id === id ? { ...b, status } : b
          )
        }));

        try {
          await bookingService.updateStatus(id, status);
        } catch (err) {
          // Revert on failure (simplified for prototype)
          set({ error: "Failed to update status" });
          await get().fetchBookings(); // Refetch to sync
        }
      },

      updatePaymentStatus: async (id, status) => {
        set((state) => ({
          bookings: state.bookings.map((b) => 
            b.id === id ? { ...b, paymentStatus: status } : b
          )
        }));

        try {
          await bookingService.updatePaymentStatus(id, status);
        } catch (err) {
          set({ error: "Failed to update payment" });
          await get().fetchBookings();
        }
      },

      assignDriver: async (id, driverId) => {
        set((state) => ({
          bookings: state.bookings.map((b) => 
            b.id === id ? { ...b, assignedDriverId: driverId, status: "SCHEDULED" } : b
          )
        }));

        try {
          await bookingService.assignDriver(id, driverId);
        } catch (err) {
          set({ error: "Failed to assign driver" });
          await get().fetchBookings();
        }
      },
    }),
    {
      name: "spark-clean-storage", // unique name
    }
  )
);
