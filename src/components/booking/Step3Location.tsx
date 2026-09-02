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
import { FieldError } from "@/components/booking/FieldError";
import { Booking } from "@/types/booking";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  sanitizePhoneInput,
  validateCustomerName,
  validateEmail,
  validateSaPhone,
  type FieldErrors,
} from "@/lib/bookingValidation";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  emailReadOnly?: boolean;
  errors?: FieldErrors;
  onClearError?: (field: string) => void;
}

export function Step3Location({
  data,
  update,
  emailReadOnly = false,
  errors = {},
  onClearError,
}: StepProps) {
  const customer = data.customer || { id: "", name: "", email: "", phone: "" };
  const [latInput, setLatInput] = useState(
    data.coordinates?.lat != null ? String(data.coordinates.lat) : ""
  );
  const [lngInput, setLngInput] = useState(
    data.coordinates?.lng != null ? String(data.coordinates.lng) : ""
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const nameLive =
    touched.name || errors.name
      ? validateCustomerName(customer.name)
      : null;
  const phoneLive =
    touched.phone || errors.phone
      ? validateSaPhone(customer.phone)
      : null;
  const emailLive =
    !emailReadOnly && (touched.email || errors.email)
      ? validateEmail(customer.email)
      : null;

  const nameError = errors.name || nameLive;
  const phoneError = errors.phone || phoneLive;
  const emailError = errors.email || emailLive;
  const addressError = errors.addressLine1;
  const suburbError = errors.suburb;
  const cityError = errors.city;

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
            onInputChange={(value) => {
              update({ addressLine1: value });
              onClearError?.("addressLine1");
            }}
            onAddressResolved={(result) => {
              setLatInput(String(result.coordinates.lat));
              setLngInput(String(result.coordinates.lng));
              update({
                addressLine1: result.addressLine1,
                suburb: result.suburb,
                city: result.city,
                coordinates: result.coordinates,
              });
              onClearError?.("addressLine1");
              onClearError?.("suburb");
              onClearError?.("city");
            }}
          />
          {addressError ? (
            <FieldError id="address-error" message={addressError} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Start typing to search Cape Town or Johannesburg addresses
              (mock autocomplete).
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="suburb">Suburb</Label>
            <Input
              id="suburb"
              placeholder="e.g. Durbanville"
              value={data.suburb || ""}
              aria-invalid={Boolean(suburbError) || undefined}
              aria-describedby={suburbError ? "suburb-error" : undefined}
              onChange={(e) => {
                update({ suburb: e.target.value });
                onClearError?.("suburb");
              }}
            />
            <FieldError id="suburb-error" message={suburbError} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Cape Town or Johannesburg"
              value={data.city || ""}
              aria-invalid={Boolean(cityError) || undefined}
              aria-describedby={cityError ? "city-error" : undefined}
              onChange={(e) => {
                update({ city: e.target.value });
                onClearError?.("city");
              }}
            />
            <FieldError id="city-error" message={cityError} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="e.g. Sipho Bhekizizwe Dlamini"
            value={customer.name}
            aria-invalid={Boolean(nameError) || undefined}
            aria-describedby={
              nameError ? "name-error" : "name-hint"
            }
            onBlur={() => markTouched("name")}
            onChange={(e) => {
              update({ customer: { ...customer, name: e.target.value } });
              onClearError?.("name");
            }}
          />
          {nameError ? (
            <FieldError id="name-error" message={nameError} />
          ) : (
            <p id="name-hint" className="text-xs text-muted-foreground">
              Multi-word names are welcome (e.g. van der Merwe, Smith Jr.).
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="082 123 4567"
              value={customer.phone}
              aria-invalid={Boolean(phoneError) || undefined}
              aria-describedby={
                phoneError ? "phone-error" : "phone-hint"
              }
              onBlur={() => markTouched("phone")}
              onChange={(e) => {
                const next = sanitizePhoneInput(e.target.value);
                update({ customer: { ...customer, phone: next } });
                onClearError?.("phone");
              }}
            />
            {phoneError ? (
              <FieldError id="phone-error" message={phoneError} />
            ) : (
              <p id="phone-hint" className="text-xs text-muted-foreground">
                SA numbers: 060, 071, 082 or +27…
              </p>
            )}
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
              className={emailReadOnly ? "bg-muted" : undefined}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              onBlur={() => markTouched("email")}
              onChange={(e) => {
                update({ customer: { ...customer, email: e.target.value } });
                onClearError?.("email");
              }}
            />
            <FieldError id="email-error" message={emailError} />
          </div>
        </div>
      </div>
    </div>
  );
}
