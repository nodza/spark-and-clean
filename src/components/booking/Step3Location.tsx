"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { Booking } from "@/types/booking";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  emailReadOnly?: boolean;
  contactError?: boolean;
  onContactEdit?: () => void;
}

export function Step3Location({
  data,
  update,
  emailReadOnly = false,
  contactError = false,
  onContactEdit,
}: StepProps) {
  const customer = data.customer || { id: "", name: "", email: "", phone: "" };
  const [latInput, setLatInput] = useState(
    data.coordinates?.lat != null ? String(data.coordinates.lat) : ""
  );
  const [lngInput, setLngInput] = useState(
    data.coordinates?.lng != null ? String(data.coordinates.lng) : ""
  );

  const commitCoordinates = (latRaw: string, lngRaw: string) => {
    const lat = Number(latRaw.trim());
    const lng = Number(lngRaw.trim());
    const latOk = latRaw.trim() !== "" && Number.isFinite(lat);
    const lngOk = lngRaw.trim() !== "" && Number.isFinite(lng);

    if (latOk && lngOk) {
      update({ coordinates: { lat, lng } });
      return;
    }

    if (!latRaw.trim() && !lngRaw.trim()) {
      update({ coordinates: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Collection Address</h3>
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <AddressAutocomplete
            id="address"
            value={data.addressLine1 || ""}
            placeholder="e.g. 42 Protea Way, Durbanville"
            onInputChange={(value) => update({ addressLine1: value })}
            onAddressResolved={(result) => {
              setLatInput(String(result.coordinates.lat));
              setLngInput(String(result.coordinates.lng));
              update({
                addressLine1: result.addressLine1,
                suburb: result.suburb,
                city: result.city,
                coordinates: result.coordinates,
              });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Start typing to search Cape Town or Johannesburg addresses
            (mock autocomplete).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="suburb">Suburb</Label>
            <Input
              id="suburb"
              placeholder="e.g. Durbanville"
              value={data.suburb || ""}
              onChange={(e) => update({ suburb: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Cape Town or Johannesburg"
              value={data.city || ""}
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude (Optional)</Label>
            <Input
              id="latitude"
              inputMode="decimal"
              placeholder="e.g. -33.9249"
              value={latInput}
              onChange={(e) => {
                const next = e.target.value;
                setLatInput(next);
                commitCoordinates(next, lngInput);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude (Optional)</Label>
            <Input
              id="longitude"
              inputMode="decimal"
              placeholder="e.g. 18.4241"
              value={lngInput}
              onChange={(e) => {
                const next = e.target.value;
                setLngInput(next);
                commitCoordinates(latInput, next);
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Autocomplete fills these automatically. Override if you have more
          precise coordinates.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Preferred Collection Time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !data.collectionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.collectionDate ? (
                    format(new Date(data.collectionDate), "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={
                    data.collectionDate
                      ? new Date(data.collectionDate)
                      : undefined
                  }
                  onSelect={(date) =>
                    update({ collectionDate: date?.toISOString() })
                  }
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot">Time Slot</Label>
            <Select
              value={data.collectionSlot}
              onValueChange={(val: "MORNING" | "AFTERNOON") =>
                update({ collectionSlot: val })
              }
            >
              <SelectTrigger id="slot">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">Morning (08:00 - 12:00)</SelectItem>
                <SelectItem value="AFTERNOON">
                  Afternoon (12:00 - 16:00)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Contact Details</h3>
        <p className="text-sm text-muted-foreground">
          We only need your name, email, and phone — no password to confirm this
          booking.
        </p>
        {contactError && (
          <p className="text-sm text-destructive" role="alert">
            Please add your full name, a valid email, and a phone number.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="John Doe"
            autoComplete="name"
            value={customer.name}
            aria-invalid={contactError && !customer.name.trim()}
            required
            onChange={(e) => {
              onContactEdit?.();
              update({ customer: { ...customer, name: e.target.value } });
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="082 123 4567"
              value={customer.phone}
              aria-invalid={contactError && customer.phone.trim().length < 7}
              required
              onChange={(e) => {
                onContactEdit?.();
                update({ customer: { ...customer, phone: e.target.value } });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="john@example.com"
              value={customer.email}
              readOnly={emailReadOnly}
              required
              aria-invalid={
                contactError &&
                !(customer.email.includes("@") && customer.email.includes("."))
              }
              className={emailReadOnly ? "bg-muted" : undefined}
              onChange={(e) => {
                if (emailReadOnly) return;
                onContactEdit?.();
                update({ customer: { ...customer, email: e.target.value } });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
