"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2 } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";

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

const SUBURB_COORDS: Record<string, [number, number]> = {
  Durbanville: [-33.8333, 18.65],
  "Sea Point": [-33.9167, 18.3833],
  "City Bowl": [-33.9249, 18.4241],
  Claremont: [-33.98, 18.465],
  "Camps Bay": [-33.95, 18.3833],
  "Green Point": [-33.9067, 18.4167],
  Rondebosch: [-33.9667, 18.4833],
  Milnerton: [-33.8667, 18.5],
  Woodstock: [-33.9333, 18.45],
  Constantia: [-34.0333, 18.4333],
  Bishopscourt: [-33.9833, 18.45],
  Observatory: [-33.9333, 18.4667],
  Gardens: [-33.9333, 18.4167],
  Fresnaye: [-33.925, 18.3833],
};

function coordsForSuburb(suburb: string, seed: string): [number, number] {
  const base = SUBURB_COORDS[suburb] || [-33.9249, 18.4241];
  // Stable jitter from id so markers don't jump on re-render
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const dx = ((hash % 1000) / 1000 - 0.5) * 0.01;
  const dy = (((hash / 1000) % 1000) / 1000 - 0.5) * 0.01;
  return [base[0] + dx, base[1] + dy];
}

export default function TechMapPage() {
  const router = useRouter();
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
        })
      );
    });
  }, []);

  const driverId = user?.driverProfileId;
  const myJobs = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!driverId || b.assignedDriverId === driverId) &&
          b.status !== "DELIVERED"
      ),
    [bookings, driverId]
  );

  const mapReady = mounted && !!markerIcon;

  return (
    <TechAppShell
      activeTab="today"
      padded={false}
      contentClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-none items-center justify-between border-b border-[#e3e7ed] bg-white px-4 py-3">
          <h1 className="text-sm font-extrabold text-navy">
            Route map
            <span className="ml-1 font-semibold text-muted-foreground">
              ({myJobs.length})
            </span>
          </h1>
        </div>

        <div className="relative min-h-0 flex-1">
          {!mapReady || (isLoading && myJobs.length === 0) ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
              role="status"
            >
              <Loader2 className="size-7 animate-spin text-navy" aria-hidden />
              <p className="text-sm font-medium">Loading map…</p>
            </div>
          ) : (
            <MapContainer
              center={[-33.9249, 18.4241]}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              aria-label="Map of your assigned jobs"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {myJobs.map((job) => {
                const position = coordsForSuburb(job.suburb, job.id);
                return (
                  <Marker key={job.id} position={position} icon={markerIcon!}>
                    <Popup>
                      <div className="min-w-[160px] p-1">
                        <h3 className="font-bold text-navy">
                          {job.customer.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {job.addressLine1}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {job.collectionSlot}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => router.push(`/tech/job/${job.id}`)}
                        >
                          View job
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}

          {mapReady && !isLoading && myJobs.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500]">
              <div className="pointer-events-auto rounded-xl border bg-white/95 px-4 py-3 text-center text-sm shadow-md backdrop-blur">
                <p className="font-semibold text-navy">No active stops</p>
                <p className="text-muted-foreground">
                  Assigned collections will show on the map.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </TechAppShell>
  );
}
