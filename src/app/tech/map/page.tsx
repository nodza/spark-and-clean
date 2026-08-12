"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import type { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";

// Dynamic import for Leaflet map to avoid SSR issues
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function TechMap() {
  const router = useRouter();
  const { bookings, fetchBookings } = useBookingStore();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [markerIcon, setMarkerIcon] = useState<Icon | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedId = localStorage.getItem("currentDriverId");
    if (!storedId) {
      router.push("/tech");
    } else {
      setDriverId(storedId);
      if (bookings.length === 0) fetchBookings();
    }

    void import("leaflet").then((L) => {
      setMarkerIcon(
        L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        })
      );
    });
  }, [bookings.length, fetchBookings, router]);

  if (!mounted || !driverId || !markerIcon) return null;

  const myJobs = bookings.filter(
    (b) => b.assignedDriverId === driverId && b.status !== "DELIVERED"
  );

  // Mock coordinates for Cape Town suburbs
  const getCoords = (suburb: string): [number, number] => {
    const coords: Record<string, [number, number]> = {
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
    const base = coords[suburb] || [-33.9249, 18.4241];
    return [base[0] + (Math.random() - 0.5) * 0.01, base[1] + (Math.random() - 0.5) * 0.01];
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-white border-b z-10 flex justify-between items-center">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Button>
        <h1 className="font-bold">Route Map ({myJobs.length} Jobs)</h1>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer
          center={[-33.9249, 18.4241]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {myJobs.map((job) => {
            const position = getCoords(job.suburb);
            return (
              <Marker key={job.id} position={position} icon={markerIcon}>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold">{job.customer.name}</h3>
                    <p className="text-sm">{job.addressLine1}</p>
                    <p className="text-xs text-muted-foreground mt-1">{job.collectionSlot}</p>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => router.push(`/tech/job/${job.id}`)}
                    >
                      View Job
                    </Button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
