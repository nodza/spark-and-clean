"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
import {
  LocationPinMap,
  type PinCommit,
} from "@/components/booking/LocationPinMap";
import { FieldError } from "@/components/booking/FieldError";
import { Booking } from "@/types/booking";
import { CalendarIcon } from "lucide-react";
import {
  bookingCalendarDateLocal,
  formatBookingCollection,
  localCalendarDate,
  toCalendarDateString,
} from "@/lib/localCalendarDate";
import {
  sanitizePhoneInput,
  validateCustomerName,
  validateEmail,
  validateSaPhone,
  type FieldErrors,
} from "@/lib/bookingValidation";
import { geocodeTypedAddress } from "@/lib/addressAutocomplete";
import { enrichFreeTextAddress, preciseCoordinates } from "@/lib/geocode/address";
import { coordinateInCollectionArea } from "@/lib/serviceArea";
import { hasValidCoordinates } from "@/lib/jobMapCoords";
import { branchContacts } from "@/data/branchContacts";
import {
  branchByKey,
  isDriverCollection,
  needsBranch,
  needsCustomerAddress,
  type BranchKey,
  type HandoverIn,
  type HandoverOut,
} from "@/lib/handover";
import { cn } from "@/lib/utils";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  emailReadOnly?: boolean;
  errors?: FieldErrors;
  onClearError?: (field: string) => void;
  locating?: boolean;
}

export type Step3LocationHandle = {
  /** Geocode the typed address. A manual pin is kept. A failed lookup leaves coordinates unset. */
  prepareAddress: () => Promise<Partial<Booking>>;
};

export const Step3Location = forwardRef<Step3LocationHandle, StepProps>(
  function Step3Location(
    {
      data,
      update,
      emailReadOnly = false,
      errors = {},
      onClearError,
      locating = false,
    },
    ref
  ) {
  const customer = data.customer || { id: "", name: "", email: "", phone: "" };
  const dataRef = useRef(data);
  dataRef.current = data;
  const manualRef = useRef(false);
  const [latInput, setLatInput] = useState(
    data.coordinates?.lat != null ? String(data.coordinates.lat) : ""
  );
  const [lngInput, setLngInput] = useState(
    data.coordinates?.lng != null ? String(data.coordinates.lng) : ""
  );
  const latRef = useRef(latInput);
  const lngRef = useRef(lngInput);
  latRef.current = latInput;
  lngRef.current = lngInput;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [searchConnected, setSearchConnected] = useState<boolean | null>(null);
  const [pinStatus, setPinStatus] = useState<"idle" | "pinned" | "approximate">(
    "idle"
  );

  useEffect(() => {
    setLatInput(
      data.coordinates?.lat != null ? String(data.coordinates.lat) : ""
    );
    setLngInput(
      data.coordinates?.lng != null ? String(data.coordinates.lng) : ""
    );
  }, [data.coordinates?.lat, data.coordinates?.lng]);

  useImperativeHandle(ref, () => ({
    prepareAddress: async () => {
      const current = dataRef.current;
      if (!needsCustomerAddress(current)) {
        const branch = branchByKey(current.branchKey);
        if (!branch) return {};
        return {
          addressLine1: branch.address,
          suburb: branch.area,
          city: branch.serviceCity,
          postalCode: undefined,
          coordinates: undefined,
          collectionSlot: undefined,
        };
      }
      const enriched = enrichFreeTextAddress({
        addressLine1: current.addressLine1,
        suburb: current.suburb,
        city: current.city,
        postalCode: current.postalCode,
      });
      const draft: Partial<Booking> = { ...current, ...enriched };
      if (manualRef.current) {
        const latRaw = latRef.current.trim();
        const lngRaw = lngRef.current.trim();
        if (latRaw || lngRaw) {
          const pin = preciseCoordinates(Number(latRaw), Number(lngRaw));
          if (pin && coordinateInCollectionArea(pin.lat, pin.lng)) {
            return { ...enriched, coordinates: pin };
          }
        }
      }

      const keptPin = draft.coordinates;
      if (
        hasValidCoordinates(keptPin) &&
        coordinateInCollectionArea(keptPin.lat, keptPin.lng)
      ) {
        setPinStatus("pinned");
        return { ...enriched, coordinates: keptPin };
      }
      try {
        const looked = await geocodeTypedAddress(
          {
            addressLine1: draft.addressLine1,
            suburb: draft.suburb,
            city: draft.city,
            postalCode: draft.postalCode,
          },
          { near: draft.city }
        );
        if (!looked.result) {
          setPinStatus("approximate");
          return { ...enriched, coordinates: undefined };
        }
        manualRef.current = false;
        setPinStatus("pinned");
        return {
          addressLine1: draft.addressLine1?.trim() || looked.result.addressLine1,
          suburb: draft.suburb?.trim() || looked.result.suburb,
          city: draft.city?.trim() || looked.result.city,
          postalCode:
            draft.postalCode?.trim() || looked.result.postalCode || undefined,
          coordinates: looked.result.coordinates,
        };
      } catch {
        setPinStatus("approximate");
        return { ...enriched, coordinates: undefined };
      }
    },
  }));

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
  const inbound: HandoverIn = data.handoverIn === "dropoff" ? "dropoff" : "collection";
  const outbound: HandoverOut = data.handoverOut === "collect" ? "collect" : "delivery";
  const askAddress = needsCustomerAddress({ handoverIn: inbound, handoverOut: outbound });
  const askSlot = isDriverCollection({ handoverIn: inbound });
  const askBranch = needsBranch({ handoverIn: inbound, handoverOut: outbound });
  const addressTitle = inbound === "dropoff" ? "Delivery address" : "Collection address";

  const storedBranchAddress = () => {
    const branch = branchByKey(data.branchKey);
    return Boolean(branch && data.addressLine1 === branch.address);
  };
  const chooseInbound = (next: HandoverIn) => {
    const nextNeedsAddress = needsCustomerAddress({
      handoverIn: next,
      handoverOut: outbound,
    });
    update({
      handoverIn: next,
      ...(next === "dropoff" ? { collectionSlot: undefined } : {}),
      ...(nextNeedsAddress && storedBranchAddress()
        ? {
            addressLine1: "",
            suburb: "",
            city: "",
            postalCode: undefined,
            coordinates: undefined,
          }
        : {}),
    });
    onClearError?.("collectionSlot");
    onClearError?.("addressLine1");
    onClearError?.("suburb");
    onClearError?.("city");
  };
  const chooseOutbound = (next: HandoverOut) => {
    const nextNeedsAddress = needsCustomerAddress({
      handoverIn: inbound,
      handoverOut: next,
    });
    update({
      handoverOut: next,
      ...(nextNeedsAddress && storedBranchAddress()
        ? {
            addressLine1: "",
            suburb: "",
            city: "",
            postalCode: undefined,
            coordinates: undefined,
          }
        : {}),
    });
    onClearError?.("addressLine1");
    onClearError?.("branchKey");
  };
  const chooseBranch = (id: BranchKey) => {
    const branch = branchByKey(id);
    update({
      branchKey: id,
      ...(!askAddress && branch
        ? {
            addressLine1: branch.address,
            suburb: branch.area,
            city: branch.serviceCity,
            coordinates: undefined,
            postalCode: undefined,
          }
        : {}),
    });
    onClearError?.("branchKey");
  };
  const parsedPin = preciseCoordinates(
    Number(data.coordinates?.lat),
    Number(data.coordinates?.lng)
  );
  const mapPin =
    parsedPin && coordinateInCollectionArea(parsedPin.lat, parsedPin.lng)
      ? parsedPin
      : null;

  const selectedPin = () => {
    const pin = dataRef.current.coordinates;
    return (
      hasValidCoordinates(pin) && coordinateInCollectionArea(pin.lat, pin.lng)
    );
  };

  const handlePinChange = (pinUpdate: PinCommit) => {
    manualRef.current = true;
    setPinStatus("pinned");
    setLatInput(String(pinUpdate.coordinates.lat));
    setLngInput(String(pinUpdate.coordinates.lng));
    const current = dataRef.current;
    const address = pinUpdate.address;
    update({
      coordinates: pinUpdate.coordinates,
      ...(address
        ? {
            addressLine1: address.addressLine1 || current.addressLine1,
            suburb: address.suburb || current.suburb,
            city: address.city || current.city,
            postalCode: address.postalCode || current.postalCode,
          }
        : {}),
    });
    if (address) {
      onClearError?.("addressLine1");
      onClearError?.("suburb");
      onClearError?.("city");
    }
  };

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
      <fieldset className="space-y-3">
        <legend className="font-semibold text-lg">How the rug reaches us</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ChoiceButton
            pressed={inbound === "collection"}
            onClick={() => chooseInbound("collection")}
            title="We collect it"
            detail="A driver picks it up from you."
          />
          <ChoiceButton
            pressed={inbound === "dropoff"}
            onClick={() => chooseInbound("dropoff")}
            title="I drop it at a branch"
            detail="Bring it to Kya Sand or Maitland."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-lg">How it comes back</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ChoiceButton
            pressed={outbound === "delivery"}
            onClick={() => chooseOutbound("delivery")}
            title="Deliver it to me"
            detail="A driver brings it back."
          />
          <ChoiceButton
            pressed={outbound === "collect"}
            onClick={() => chooseOutbound("collect")}
            title="I collect it from the branch"
            detail="Fetch it when it is ready."
          />
        </div>
      </fieldset>

      {askBranch ? (
        <fieldset className="space-y-3">
          <legend className="font-semibold text-lg">Branch</legend>
          <div className="grid grid-cols-1 gap-2">
            {branchContacts.map((branch) => (
              <ChoiceButton
                key={branch.id}
                pressed={data.branchKey === branch.id}
                onClick={() => chooseBranch(branch.id)}
                title={`${branch.name} · ${branch.area}`}
                detail={`${branch.address} · ${branch.phones[0]?.number ?? ""}`}
              />
            ))}
          </div>
          <FieldError id="branch-error" message={errors.branchKey} />
        </fieldset>
      ) : null}

      {askAddress ? (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">{addressTitle}</h3>
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <AddressAutocomplete
            id="address"
            value={data.addressLine1 || ""}
            placeholder="e.g. 10 Beach Road, Sea Point"
            near={data.city}
            suburb={data.suburb}
            postalCode={data.postalCode}
            disabled={locating}
            invalid={Boolean(addressError)}
            describedBy={
              addressError
                ? "address-error"
                : pinStatus === "approximate"
                  ? "address-approximate"
                  : pinStatus === "pinned"
                    ? "address-pinned"
                    : "address-hint"
            }
            onConfiguredChange={setSearchConnected}
            onInputChange={(value) => {
              if (selectedPin()) {
                setPinStatus("pinned");
                update({ addressLine1: value });
              } else {
                manualRef.current = false;
                setPinStatus("idle");
                update({ addressLine1: value, coordinates: undefined });
              }
              onClearError?.("addressLine1");
            }}
            onAddressResolved={(result) => {
              manualRef.current = false;
              setPinStatus(result.coordinates ? "pinned" : "approximate");
              if (result.coordinates) {
                setLatInput(String(result.coordinates.lat));
                setLngInput(String(result.coordinates.lng));
              }
              update({
                addressLine1: result.addressLine1 || data.addressLine1,
                suburb: result.suburb || data.suburb,
                city: result.city || data.city,
                postalCode: result.postalCode || data.postalCode,
                coordinates: result.coordinates,
              });
              onClearError?.("addressLine1");
              onClearError?.("suburb");
              onClearError?.("city");
            }}
          />
          {addressError ? (
            <FieldError id="address-error" message={addressError} />
          ) : pinStatus === "approximate" && !hasValidCoordinates(data.coordinates) ? (
            <p id="address-approximate" className="text-xs leading-relaxed text-muted-foreground" role="status">
              We couldn’t pin this street. You can continue — the driver map uses the suburb centre.
            </p>
          ) : pinStatus === "pinned" && hasValidCoordinates(data.coordinates) ? (
            <p id="address-pinned" className="text-xs font-medium text-[#0a7a63]" role="status">
              Street pin saved. You can correct the street or suburb, and the pin stays.
            </p>
          ) : (
            <p id="address-hint" className="text-xs leading-relaxed text-muted-foreground">
              {searchConnected === false
                ? "Type the street, suburb, and city. The driver map uses the suburb centre until address search is connected."
                : "Search a street in Cape Town or Gauteng, or enter it as street, suburb, city."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_7.25rem] items-start gap-2.5 sm:gap-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="suburb">Suburb</Label>
            <Input
              id="suburb"
              placeholder="Sea Point"
              value={data.suburb || ""}
              aria-invalid={Boolean(suburbError) || undefined}
              aria-describedby={suburbError ? "suburb-error" : undefined}
              disabled={locating}
              onChange={(e) => {
                if (selectedPin()) {
                  setPinStatus("pinned");
                  update({ suburb: e.target.value });
                } else {
                  manualRef.current = false;
                  setPinStatus("idle");
                  update({ suburb: e.target.value, coordinates: undefined });
                }
                onClearError?.("suburb");
              }}
            />
            <FieldError id="suburb-error" message={suburbError} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Pretoria"
              value={data.city || ""}
              aria-invalid={Boolean(cityError) || undefined}
              aria-describedby={cityError ? "city-error" : undefined}
              disabled={locating}
              onChange={(e) => {
                if (selectedPin()) {
                  setPinStatus("pinned");
                  update({ city: e.target.value });
                } else {
                  manualRef.current = false;
                  setPinStatus("idle");
                  update({ city: e.target.value, coordinates: undefined });
                }
                onClearError?.("city");
              }}
            />
            <FieldError id="city-error" message={cityError} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="postalCode" className="whitespace-nowrap">
              Postal code
            </Label>
            <Input
              id="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="8005"
              maxLength={12}
              disabled={locating}
              value={data.postalCode || ""}
              onChange={(e) => {
                update({ postalCode: e.target.value });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude (optional)</Label>
            <Input
              id="latitude"
              inputMode="decimal"
              placeholder="e.g. -33.9249"
              value={latInput}
              disabled={locating}
              onChange={(e) => {
                const next = e.target.value;
                setLatInput(next);
                manualRef.current = true;
                setPinStatus("idle");
                commitCoordinates(next, lngInput);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude (optional)</Label>
            <Input
              id="longitude"
              inputMode="decimal"
              placeholder="e.g. 18.4241"
              value={lngInput}
              disabled={locating}
              onChange={(e) => {
                const next = e.target.value;
                setLngInput(next);
                manualRef.current = true;
                setPinStatus("idle");
                commitCoordinates(latInput, next);
              }}
            />
          </div>
        </div>

        {mapPin ? (
          <LocationPinMap
            latitude={mapPin.lat}
            longitude={mapPin.lng}
            disabled={locating}
            onPinChange={handlePinChange}
          />
        ) : null}
      </div>
      ) : null}

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">
          {inbound === "dropoff" ? "Drop-off day" : "Preferred collection time"}
        </h3>
        <FieldError id="date-error" message={errors.collectionDate} />
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
                    formatBookingCollection(data.collectionDate, "PPP", "Pick a date")
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
                      ? bookingCalendarDateLocal(data.collectionDate) ?? undefined
                      : undefined
                  }
                  onSelect={(date) => {
                    update({
                      collectionDate: date
                        ? toCalendarDateString(date)
                        : undefined,
                    });
                    onClearError?.("collectionDate");
                  }}
                  initialFocus
                  disabled={(date) =>
                    toCalendarDateString(date) < localCalendarDate()
                  }
                />
              </PopoverContent>
            </Popover>
          </div>
          {askSlot ? (
          <div className="space-y-2">
            <Label htmlFor="slot">Time Slot</Label>
            <Select
              value={data.collectionSlot}
              onValueChange={(val: "MORNING" | "AFTERNOON") => {
                update({ collectionSlot: val });
                onClearError?.("collectionSlot");
              }}
            >
              <SelectTrigger id="slot" aria-invalid={Boolean(errors.collectionSlot) || undefined}>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">Morning (08:00 - 12:00)</SelectItem>
                <SelectItem value="AFTERNOON">
                  Afternoon (12:00 - 16:00)
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError id="slot-error" message={errors.collectionSlot} />
          </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Contact Details</h3>
        <p className="text-sm text-muted-foreground">
          We only need your name, email, and phone — no password to confirm this
          booking.
        </p>
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
              Multi-word names are welcome (e.g. Sipho Bhekizizwe Dlamini, Smith Jr.).
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
});

function ChoiceButton({
  pressed,
  onClick,
  title,
  detail,
}: {
  pressed: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-[10px] border px-3 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed
          ? "border-[#000b49] bg-[#000b49] text-white"
          : "border-[#d5d9de] bg-white text-[#000b49] hover:border-[#000b49]"
      )}
    >
      <span className="block text-[14px] font-bold">{title}</span>
      <span className={cn("mt-1 block text-[12px] leading-snug", pressed ? "text-white/80" : "text-[#6b7280]")}>
        {detail}
      </span>
    </button>
  );
}
