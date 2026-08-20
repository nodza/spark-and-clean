"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  geocodeSelectedAddress,
  parseAddressString,
  searchAddressSuggestions,
  type GeocodedAddress,
  type ParsedAddress,
} from "@/lib/addressAutocomplete";

interface AddressAutocompleteProps {
  value: string;
  onAddressResolved: (result: GeocodedAddress) => void;
  onInputChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  /**
   * Optional Places/Mapbox API key for Phase 2.
   * Falls back to mock suggestions when omitted.
   * Prefer NEXT_PUBLIC_GOOGLE_PLACES_API_KEY / NEXT_PUBLIC_MAPBOX_TOKEN.
   */
  apiKey?: string;
}

export function AddressAutocomplete({
  value,
  onAddressResolved,
  onInputChange,
  id,
  placeholder = "Start typing an address…",
  className,
  apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
}: AddressAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipSearchRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ParsedAddress[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddressSuggestions(query, {
          apiKey,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setOpen(true);
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value, apiKey]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectPlace = (place: ParsedAddress) => {
    skipSearchRef.current = true;
    abortRef.current?.abort();
    const geocoded = geocodeSelectedAddress(place);
    onAddressResolved(geocoded);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setLoading(false);
  };

  const resolveFromFreeText = () => {
    const parsed = parseAddressString(value);
    if (!parsed) return;
    selectPlace(parsed);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          className="pl-9 pr-9"
          onChange={(e) => {
            onInputChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setOpen(false);
              }
            }, 150);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) =>
                suggestions.length === 0 ? -1 : (i + 1) % suggestions.length
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) =>
                suggestions.length === 0
                  ? -1
                  : (i - 1 + suggestions.length) % suggestions.length
              );
            } else if (e.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
              e.preventDefault();
              selectPlace(suggestions[activeIndex]);
            } else if (e.key === "Enter") {
              e.preventDefault();
              resolveFromFreeText();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((place, index) => (
            <li
              key={place.placeId}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-2 text-sm outline-none",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPlace(place);
              }}
            >
              <span className="font-medium">{place.addressLine1}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {place.suburb}, {place.city}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open &&
        !loading &&
        value.trim().length >= 2 &&
        suggestions.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
            No matches. Try e.g. “Protea”, “Sandton”, or “Sea Point”, or enter
            Street, Suburb, City.
          </div>
        )}
    </div>
  );
}
