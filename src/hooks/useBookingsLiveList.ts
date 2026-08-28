"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBookingStore } from "@/store/useBookingStore";
import { BOOKING_LIVE_POLL_MS } from "@/lib/bookingLive";

/**
 * Loads the customer's bookings list and polls for admin status/payment updates.
 */
export function useBookingsLiveList(enabled: boolean) {
  const fetchBookings = useBookingStore((s) => s.fetchBookings);
  const isLoading = useBookingStore((s) => s.isLoading);
  const error = useBookingStore((s) => s.error);
  const bookings = useBookingStore((s) => s.bookings);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialDone, setInitialDone] = useState(false);
  const mounted = useRef(true);

  const sync = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return;

      if (opts?.silent) setIsRefreshing(true);

      try {
        await fetchBookings({ silent: opts?.silent });
        if (!mounted.current) return;
        setLastSyncedAt(new Date());
      } finally {
        if (!mounted.current) return;
        setIsRefreshing(false);
        setInitialDone(true);
      }
    },
    [enabled, fetchBookings]
  );

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void sync({ silent: false });
    return () => {
      mounted.current = false;
    };
  }, [enabled, sync]);

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
    bookings,
    loading: !initialDone && isLoading,
    error,
    lastSyncedAt,
    isRefreshing,
    refresh: () => sync({ silent: true }),
  };
}
