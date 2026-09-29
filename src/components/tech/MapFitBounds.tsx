"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { LatLngTuple } from "@/lib/jobMapCoords";

function positionsKey(positions: LatLngTuple[]): string {
  return positions.map(([lat, lng]) => `${lat},${lng}`).join("|");
}

/**
 * Fits the map to today's stop pins so CPT and JHB routes both frame correctly.
 * Re-fits only when pin coordinates change — not on every bookings poll.
 */
export function MapFitBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();
  const lastKey = useRef("");

  useEffect(() => {
    if (positions.length === 0) return;

    const key = positionsKey(positions);
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (positions.length === 1) {
      map.setView(positions[0], 13, { animate: false });
      return;
    }

    map.fitBounds(positions, {
      padding: [48, 48],
      maxZoom: 14,
      animate: false,
    });
  }, [map, positions]);

  return null;
}
