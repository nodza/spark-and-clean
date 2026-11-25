"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayersControl,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { LeafletEvent, Marker as LeafletMarker } from "leaflet";
import type { Icon } from "leaflet";
import { Loader2 } from "lucide-react";
import { preciseCoordinates } from "@/lib/geocode/address";
import { coordinateInCollectionArea } from "@/lib/serviceArea";
import type { Coordinates } from "@/types/booking";

interface LocationPinMapCanvasProps {
  latitude: number;
  longitude: number;
  disabled?: boolean;
  onCommit: (coordinates: Coordinates) => void;
  onReject: () => void;
}

const PIN_ZOOM = 18;

function Recenter({ position }: { position: [number, number] }) {
  const map = useMap();
  const lastKey = useRef("");

  useEffect(() => {
    const key = `${position[0]},${position[1]}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.setView(position, PIN_ZOOM, { animate: false });
  }, [map, position]);

  return null;
}

function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

function FullscreenControl() {
  const map = useMap();

  useEffect(() => {
    let control: { remove: () => void } | null = null;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      const Button = L.Control.extend({
        options: { position: "topright" },
        onAdd() {
          const wrap = L.DomUtil.create("div", "leaflet-bar leaflet-control");
          const btn = L.DomUtil.create(
            "button",
            "location-pin-fullscreen",
            wrap
          );
          btn.type = "button";
          btn.title = "Full screen";
          btn.setAttribute("aria-label", "Full screen map");
          btn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#32373c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
          L.DomEvent.disableClickPropagation(btn);
          L.DomEvent.disableScrollPropagation(btn);
          L.DomEvent.on(btn, "click", (event) => {
            L.DomEvent.stop(event);
            const node = map.getContainer();
            if (document.fullscreenElement === node) {
              void document.exitFullscreen();
              return;
            }
            void node.requestFullscreen();
          });
          return wrap;
        },
      });
      const instance = new Button();
      instance.addTo(map);
      control = instance;
    });

    const onChange = () => map.invalidateSize();
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      cancelled = true;
      document.removeEventListener("fullscreenchange", onChange);
      control?.remove();
    };
  }, [map]);

  return null;
}

export function LocationPinMapCanvas({
  latitude,
  longitude,
  disabled = false,
  onCommit,
  onReject,
}: LocationPinMapCanvasProps) {
  const [icon, setIcon] = useState<Icon | null>(null);
  const latitudeRef = useRef(latitude);
  const longitudeRef = useRef(longitude);
  const onCommitRef = useRef(onCommit);
  const onRejectRef = useRef(onReject);
  latitudeRef.current = latitude;
  longitudeRef.current = longitude;
  onCommitRef.current = onCommit;
  onRejectRef.current = onReject;

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active) return;
      setIcon(
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
    return () => {
      active = false;
    };
  }, []);

  const onDragEnd = (event: LeafletEvent) => {
    const marker = event.target as LeafletMarker;
    const next = marker.getLatLng();
    const pin = preciseCoordinates(next.lat, next.lng);
    if (!pin || !coordinateInCollectionArea(pin.lat, pin.lng)) {
      marker.setLatLng([latitudeRef.current, longitudeRef.current]);
      onRejectRef.current();
      return;
    }
    onCommitRef.current(pin);
  };

  if (!icon) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-[#6b7280]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="sr-only">Loading map</span>
      </div>
    );
  }

  return (
    <>
    <style>{`
      .location-pin-map .leaflet-control-zoom a,
      .location-pin-map .location-pin-fullscreen {
        width: 36px;
        height: 36px;
        line-height: 36px;
        font-size: 18px;
      }
      .location-pin-map .location-pin-fullscreen {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        border: 0;
        cursor: pointer;
        color: #32373c;
      }
      .location-pin-map .leaflet-bar {
        border: none;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 8px 20px rgba(0, 11, 73, 0.16);
      }
      .location-pin-map .leaflet-control-layers {
        border: none;
        border-radius: 10px;
        box-shadow: 0 8px 20px rgba(0, 11, 73, 0.16);
      }
    `}</style>
    <MapContainer
      className="location-pin-map"
      center={[latitude, longitude]}
      zoom={PIN_ZOOM}
      maxZoom={19}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      dragging={!disabled}
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay checked name="Roads">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Labels">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.Overlay>
      </LayersControl>
      <FullscreenControl />
      <Recenter position={[latitude, longitude]} />
      <InvalidateSize />
      <Marker
        position={[latitude, longitude]}
        icon={icon}
        draggable={!disabled}
        eventHandlers={{ dragend: onDragEnd }}
      />
    </MapContainer>
    </>
  );
}
