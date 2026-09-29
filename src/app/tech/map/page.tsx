"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2 } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import { localCalendarDate } from "@/lib/localCalendarDate";
import { DEFAULT_MAP_CENTER, todayMapPins } from "@/lib/jobMapCoords";
import { slotTimeLabel, slotWindowLabel } from "@/lib/techUi";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const MapFitBounds = dynamic(
  () =>
    import("@/components/tech/MapFitBounds").then((mod) => mod.MapFitBounds),
  { ssr: false }
);

export default function TechMapPage() {
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const { bookings, loading: isLoading } = useBookingsLiveList(!!ready);
  const [mounted, setMounted] = useState(false);
  const [markerIcon, setMarkerIcon] = useState<Icon | null>(null);

  useEffect(() => {
    setMounted(true);
    void import("leaflet").then((L) => {
      setMarkerIcon(
        L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        })
      );
    });
  }, []);

  const driverId = user?.driverProfileId;
  const todaySa = localCalendarDate();

  const pins = useMemo(
    () => todayMapPins(bookings, driverId, todaySa),
    [bookings, driverId, todaySa]
  );

  const fitPositions = useMemo(
    () => pins.map((pin) => pin.position),
    [pins]
  );

  const mapReady = mounted && !!markerIcon;
  const showEmpty = mapReady && !isLoading && pins.length === 0;
  const showLoading = !mapReady || (isLoading && pins.length === 0);

  return (
    <TechAppShell
      activeTab="today"
      padded={false}
      contentClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-none items-center justify-between border-b border-[#e3e7ed] bg-white px-4 py-3">
          <h1 className="text-sm font-extrabold text-navy">
            Today&apos;s map
            <span className="ml-1 font-semibold text-muted-foreground">
              ({pins.length})
            </span>
          </h1>
        </div>

        <div className="relative min-h-0 flex-1">
          {showLoading ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
              role="status"
            >
              <Loader2 className="size-7 animate-spin text-navy" aria-hidden />
              <p className="text-sm font-medium">Loading map…</p>
            </div>
          ) : (
            <MapContainer
              center={DEFAULT_MAP_CENTER}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              aria-label="Map of today's stops"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {fitPositions.length > 0 ? (
                <MapFitBounds positions={fitPositions} />
              ) : null}
              {pins.map(({ job, position }) => (
                <Marker key={job.id} position={position} icon={markerIcon!}>
                  <Popup>
                    <div className="min-w-[168px] max-w-[220px] p-1">
                      <h3 className="text-[13px] font-bold leading-snug text-navy">
                        {job.customer.name}
                      </h3>
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {job.addressLine1}
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                        {slotWindowLabel(job.collectionSlot)} ·{" "}
                        {slotTimeLabel(job.collectionSlot)}
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="mt-2.5 h-9 w-full touch-manipulation"
                      >
                        <Link href={`/tech/job/${job.id}`}>View Job</Link>
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          {showEmpty ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500]">
              <div
                className="pointer-events-auto rounded-xl border border-[#e3e7ed] bg-white/95 px-4 py-3.5 text-center shadow-md backdrop-blur"
                role="status"
              >
                <p className="text-sm font-semibold text-navy">No stops today</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Today&apos;s pickups and ready returns will appear here.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </TechAppShell>
  );
}
