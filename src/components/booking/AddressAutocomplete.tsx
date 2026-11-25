"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchGeocoderStatus,
  geocodeTypedAddress,
  resolveAddressPlace,
  searchAddressSuggestions,
  type AddressSuggestion,
} from "@/lib/addressAutocomplete";

interface AddressAutocompleteProps {
  value: string;
  onAddressResolved: (result: AddressSuggestion) => void;
  onInputChange: (value: string) => void;
  onConfiguredChange?: (configured: boolean) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  near?: string;
  suburb?: string;
  postalCode?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

function secondaryLine(place: AddressSuggestion): string {
  return [place.suburb, place.city, place.postalCode].filter(Boolean).join(", ");
}

export function AddressAutocomplete({
  value,
  onAddressResolved,
  onInputChange,
  onConfiguredChange,
  id,
  placeholder = "Start typing a street address…",
  className,
  near,
  suburb,
  postalCode,
  disabled = false,
  invalid = false,
  describedBy,
}: AddressAutocompleteProps) {
  const listId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipSearchRef = useRef(false);
  const onConfiguredChangeRef = useRef(onConfiguredChange);
  onConfiguredChangeRef.current = onConfiguredChange;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const sessionTokenRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const status = await fetchGeocoderStatus(controller.signal);
      if (controller.signal.aborted) return;
      setConfigured(status.configured);
      onConfiguredChangeRef.current?.(status.configured);
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      setLoading(false);
      return;
    }

    const query = value.trim();
    if (query.length < 3 || configured === false || disabled) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      setLookupError(null);
      const field = containerRef.current?.querySelector("input");
      const showUnavailable =
        configured === false &&
        query.length >= 3 &&
        !disabled &&
        field != null &&
        document.activeElement === field;
      setOpen(showUnavailable);
      return;
    }

    const field = containerRef.current?.querySelector("input");
    const focused = field != null && document.activeElement === field;
    if (!focused) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setLookupError(null);

    const handle = window.setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(query, {
          signal: controller.signal,
          near,
          sessionToken: sessionTokenRef.current,
        });
        if (controller.signal.aborted) return;
        setConfigured(results.configured);
        onConfiguredChangeRef.current?.(results.configured);
        setSuggestions(results.suggestions);
        setLookupError(
          results.error === "rate_limited"
            ? "Too many searches. Wait a moment, or type the full address."
            : results.error
              ? "Address search didn’t respond. You can still type the full address."
              : null
        );
        setOpen(true);
        setActiveIndex(results.suggestions.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setSuggestions([]);
        setLookupError(
          "Address search didn’t respond. You can still type the full address."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value, near, configured, disabled]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const applyResolved = (place: AddressSuggestion) => {
    skipSearchRef.current = true;
    abortRef.current?.abort();
    onAddressResolved(place);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setLoading(false);
    setLookupError(null);
  };

  const selectPlace = async (place: AddressSuggestion) => {
    abortRef.current?.abort();
    setOpen(false);
    setSuggestions([]);
    if (place.coordinates) {
      applyResolved(place);
      return;
    }

    setLoading(true);
    try {
      const resolved = await resolveAddressPlace(place.placeId, {
        sessionToken: sessionTokenRef.current,
      });
      if (resolved.result) {
        sessionTokenRef.current = crypto.randomUUID();
        applyResolved(resolved.result);
        return;
      }
      const typed = await geocodeTypedAddress(
        {
          addressLine1: place.addressLine1 || place.label,
          suburb: place.suburb,
          city: place.city,
          postalCode: place.postalCode,
        },
        { near: place.city || near }
      );
      if (typed.result) {
        applyResolved(typed.result);
        return;
      }
      applyResolved(place);
    } catch {
      applyResolved(place);
    }
  };

  const resolveFromFreeText = async () => {
    const query = value.trim();
    if (query.length < 3) return;
    setLoading(true);
    setOpen(false);
    try {
      const looked = await geocodeTypedAddress(
        {
          addressLine1: query,
          suburb,
          city: near,
          postalCode,
        },
        { near }
      );
      if (looked.result) {
        applyResolved(looked.result);
        return;
      }
    } catch {
      // The booking step geocodes again on continue, then uses the suburb centre.
    } finally {
      setLoading(false);
    }
  };

  const showList = open && suggestions.length > 0;
  const showEmpty =
    open &&
    !loading &&
    suggestions.length === 0 &&
    value.trim().length >= 3 &&
    (lookupError != null || configured === false || configured === true);
  const statusText = loading
    ? "Searching addresses"
    : lookupError
      ? lookupError
      : showList
        ? `${suggestions.length} address suggestions`
        : configured === false && value.trim().length >= 3
          ? "Address search is not connected"
          : "";

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
          aria-hidden
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-invalid={invalid || undefined}
          aria-describedby={[describedBy, statusId].filter(Boolean).join(" ") || undefined}
          aria-busy={loading || undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          className="pl-9 pr-9"
          onChange={(event) => {
            onInputChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0 || (configured === false && value.trim().length >= 3)) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
              setOpen(true);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) =>
                suggestions.length === 0 ? -1 : (index + 1) % suggestions.length
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) =>
                suggestions.length === 0
                  ? -1
                  : (index - 1 + suggestions.length) % suggestions.length
              );
            } else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
              event.preventDefault();
              void selectPlace(suggestions[activeIndex]);
            } else if (event.key === "Enter") {
              event.preventDefault();
              void resolveFromFreeText();
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && (
          <Loader2
            className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7280]"
            aria-hidden
          />
        )}
      </div>

      <p id={statusId} className="sr-only" aria-live="polite">
        {statusText}
      </p>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-50 mt-1.5 max-h-[min(18rem,50vh)] w-full overflow-auto overscroll-contain rounded-[10px] border border-[#e3e7ed] bg-white p-1 text-[#32373c] shadow-[0_12px_32px_rgba(0,11,73,0.12)]"
        >
          {suggestions.map((place, index) => {
            const secondary = secondaryLine(place);
            const active = index === activeIndex;
            return (
              <li
                key={`${place.placeId}-${index}`}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={active}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-2.5 text-left outline-none min-h-11",
                  active ? "bg-[#e7fbf6]" : "hover:bg-[#f7f8fa]"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  void selectPlace(place);
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0a7a63]" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-[#32373c]">
                      {place.addressLine1 || place.label}
                    </span>
                    {secondary ? (
                      <span className="mt-0.5 block truncate text-[12.5px] text-[#6b7280]">
                        {secondary}
                      </span>
                    ) : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {showEmpty && (
        <div
          role="status"
          className="absolute z-50 mt-1.5 w-full rounded-[10px] border border-[#e3e7ed] bg-white px-3 py-2.5 text-[13px] leading-snug text-[#6b7280] shadow-[0_12px_32px_rgba(0,11,73,0.12)]"
        >
          {lookupError
            ? lookupError
            : configured === false
              ? "Address search isn’t connected. Type the street, suburb, and city — the driver map uses the suburb centre."
              : "No matching address in Cape Town or Gauteng. Enter it as street, suburb, city."}
        </div>
      )}
    </div>
  );
}
