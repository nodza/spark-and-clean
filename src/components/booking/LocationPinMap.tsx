"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { reverseGeocodeCoordinates } from "@/lib/addressAutocomplete";
import type { GeocodedAddress } from "@/lib/geocode/address";
import type { Coordinates } from "@/types/booking";

const LocationPinMapCanvas = dynamic(
  () =>
    import("@/components/booking/LocationPinMapCanvas").then(
      (mod) => mod.LocationPinMapCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-[#6b7280]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="sr-only">Loading map</span>
      </div>
    ),
  }
);

export interface PinCommit {
  coordinates: Coordinates;
  address?: GeocodedAddress;
}

interface LocationPinMapProps {
  latitude: number;
  longitude: number;
  disabled?: boolean;
  onPinChange: (update: PinCommit) => void;
}

export function LocationPinMap({
  latitude,
  longitude,
  disabled = false,
  onPinChange,
}: LocationPinMapProps) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onPinChangeRef = useRef(onPinChange);
  const emittedPin = useRef<string | null>(null);
  onPinChangeRef.current = onPinChange;

  useEffect(() => {
    const key = `${latitude},${longitude}`;
    if (emittedPin.current === key) return;
    setNote(null);
  }, [latitude, longitude]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const commitPin = (coordinates: Coordinates) => {
    emittedPin.current = `${coordinates.lat},${coordinates.lng}`;
    setNote(null);
    onPinChangeRef.current({ coordinates });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResolving(true);

    void (async () => {
      try {
        const looked = await reverseGeocodeCoordinates(coordinates, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (looked.result) {
          setNote(null);
          onPinChangeRef.current({
            coordinates,
            address: looked.result,
          });
          return;
        }
        setNote(
          looked.configured === false
            ? "Address search isn’t connected. The pin is saved — type the street if it looks wrong."
            : "Couldn’t match that pin to a street. The pin is saved — edit the address if it looks wrong."
        );
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setNote(
          "Couldn’t match that pin to a street. The pin is saved — edit the address if it looks wrong."
        );
      } finally {
        if (!controller.signal.aborted) setResolving(false);
      }
    })();
  };

  return (
    <div className="space-y-2">
      <div className="rounded-[10px] border border-[#d7ebe4] bg-[#e7fbf6] px-3 py-2.5">
        <p className="text-[13px] font-semibold text-[#0a7a63]">Adjust the pin</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-[#0a7a63]/80">
          Drag the marker if the gate or entrance is not on the street point.
        </p>
      </div>
      <div
        className="relative h-72 overflow-hidden rounded-[10px] border border-[#e3e7ed] sm:h-80 md:h-96"
        role="region"
        aria-label="Collection location map. Drag the pin to adjust it."
      >
        <LocationPinMapCanvas
          latitude={latitude}
          longitude={longitude}
          disabled={disabled || resolving}
          onCommit={commitPin}
          onReject={() =>
            setNote("Drop the pin in Cape Town or Gauteng. The previous pin is still saved.")
          }
        />
        {resolving ? (
          <div className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[12.5px] font-medium text-[#32373c] shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0a7a63]" aria-hidden />
            Reading the new pin…
          </div>
        ) : null}
      </div>
      {note ? (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {note}
        </p>
      ) : (
        <p className="sr-only" role="status">
          {resolving ? "Updating the address from the pin" : "Pin ready to drag"}
        </p>
      )}
    </div>
  );
}
