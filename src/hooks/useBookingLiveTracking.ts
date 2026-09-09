"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBookingStore } from "@/store/useBookingStore";
import type { Booking } from "@/types/booking";
import { BOOKING_LIVE_POLL_MS } from "@/lib/bookingLive";

/**
 * Loads a booking by id from the store/API and polls for admin status updates.
 * Phase 1 “real-time”: reflects changes within ~10s without manual refresh.
 */
export function useBookingLiveTracking(bookingId: string, enabled: boolean) {
  const fetchBookingById = useBookingStore((s) => s.fetchBookingById);
  const storeBooking = useBookingStore((s) =>
    s.bookings.find((b) => b.id === bookingId)
  );

  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mounted = useRef(true);

  const sync = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || !bookingId) return;

      if (!opts?.silent) setLoading(true);
      else setIsRefreshing(true);

      try {
        const next = await fetchBookingById(bookingId);
        if (!mounted.current) return;
        setBooking(next);
        setLastSyncedAt(new Date());
        setError(null);
        setForbidden(false);
      } catch (err) {
        if (!mounted.current) return;
        const status =
          err && typeof err === "object" && "status" in err
            ? Number((err as { status: number }).status)
            : 0;
        if (status === 403) {
          setForbidden(true);
          setError(null);
          return;
        }
        setError("Could not refresh booking status. Retrying…");
      } finally {
        if (!mounted.current) return;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [bookingId, enabled, fetchBookingById]
  );

  // Initial load
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void sync({ silent: false });
    return () => {
      mounted.current = false;
    };
  }, [enabled, sync]);

  // Keep local view in sync when store updates (e.g. same-tab admin tools later)
  useEffect(() => {
    if (storeBooking) {
      setBooking(storeBooking);
    }
  }, [storeBooking]);

  // Poll while tab is visible
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void sync({ silent: true });
    };

    const id = window.setInterval(tick, BOOKING_LIVE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, sync]);

  return {
    booking,
    loading,
    error,
    forbidden,
    lastSyncedAt,
    isRefreshing,
    refresh: () => sync({ silent: true }),
  };
}
