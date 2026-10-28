"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { formatQuoteRange, formatRandCents } from "@/lib/priceFormat";
import type { Booking } from "@/types/booking";

function formatMeasuredAt(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function meterText(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

/**
 * Full admin corrects width and length. The server sets the price.
 * This form never collects an amount.
 */
export function MeasuredSizeCard({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
}) {
  const formId = useId();
  const widthId = `${formId}-width`;
  const lengthId = `${formId}-length`;
  const [widthRaw, setWidthRaw] = useState(meterText(booking.rug.widthM));
  const [lengthRaw, setLengthRaw] = useState(meterText(booking.rug.lengthM));
  const [dirty, setDirty] = useState(false);
  const [widthError, setWidthError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setWidthRaw(meterText(booking.rug.widthM));
    setLengthRaw(meterText(booking.rug.lengthM));
  }, [booking.id, booking.rug.widthM, booking.rug.lengthM, dirty]);

  const measuredLabel = booking.measuredQuote
    ? formatQuoteRange(
        booking.measuredQuote.estimatedPriceMin,
        booking.measuredQuote.estimatedPriceMax
      )
    : null;
  const measuredWhen = booking.measuredQuote
    ? formatMeasuredAt(booking.measuredQuote.measuredAt)
    : "";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    setSavedMessage(null);

    const parsed = readMeasuredMeters(widthRaw, lengthRaw);
    if (!parsed.ok) {
      const widthMissing = widthRaw.trim() === "";
      const lengthMissing = lengthRaw.trim() === "";
      setWidthError(widthMissing || parsed.error.toLowerCase().includes("width") ? parsed.error : null);
      setLengthError(
        lengthMissing || parsed.error.toLowerCase().includes("length") ? parsed.error : null
      );
      const focusId = widthMissing || parsed.error.toLowerCase().includes("width") ? widthId : lengthId;
      document.getElementById(focusId)?.focus();
      return;
    }
    setWidthError(null);
    setLengthError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/measurement`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widthM: parsed.widthM, lengthM: parsed.lengthM }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        booking?: Booking;
      };
      if (!res.ok || !data.booking) {
        setFormError(
          typeof data.error === "string"
            ? data.error
            : "Could not save the measured size."
        );
        return;
      }
      setDirty(false);
      setWidthRaw(String(parsed.widthM));
      setLengthRaw(String(parsed.lengthM));
      onUpdated(data.booking);
      setSavedMessage(
        data.booking.refundRequired
          ? `Saved. The new price is below what was paid, so this booking needs a refund.`
          : `Saved. Final price after measurement is ${formatQuoteRange(
              data.booking.measuredQuote?.estimatedPriceMin ?? 0,
              data.booking.measuredQuote?.estimatedPriceMax ?? 0
            )}. Amount due ${formatRandCents(
              data.booking.measuredQuote?.amountDueCents ??
                data.booking.billing?.amountDueCents ??
                0
            )}.`
      );
    } catch {
      setFormError("Could not save the measured size. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="ds-card"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={saving}
      noValidate
    >
      <h2 className="text-card-title" style={{ color: "#000b49" }}>
        Measured size
      </h2>
      <p className="text-body mt-[8px]" style={{ color: "#6b7280" }}>
        Enter the width and length in metres. Saving recalculates the amount due
        from the rug type, add-ons, and any coupon. The amount already paid stays
        the same. You don&apos;t enter a price.
      </p>
      {measuredLabel ? (
        <p className="text-meta mt-[10px]" style={{ color: "#0a7a63" }}>
          Final price after measurement {measuredLabel}
          {measuredWhen ? ` · ${measuredWhen}` : ""}
        </p>
      ) : (
        <p className="text-meta mt-[10px]" style={{ color: "#9aa0a6" }}>
          No measurement yet. The estimate stays in place until a size is saved.
        </p>
      )}

      <div className="mt-[16px] grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={widthId}>Width (m)</Label>
          <Input
            id={widthId}
            inputMode="decimal"
            autoComplete="off"
            value={widthRaw}
            disabled={saving}
            placeholder="e.g. 2"
            aria-invalid={widthError ? true : undefined}
            aria-describedby={widthError ? `${widthId}-error` : undefined}
            className="min-h-11"
            onChange={(event) => {
              setWidthRaw(event.target.value);
              setDirty(true);
              setWidthError(null);
              setSavedMessage(null);
            }}
          />
          {widthError ? (
            <p id={`${widthId}-error`} role="alert" className="text-sm" style={{ color: "#b3261e" }}>
              {widthError}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={lengthId}>Length (m)</Label>
          <Input
            id={lengthId}
            inputMode="decimal"
            autoComplete="off"
            value={lengthRaw}
            disabled={saving}
            placeholder="e.g. 3"
            aria-invalid={lengthError ? true : undefined}
            aria-describedby={lengthError ? `${lengthId}-error` : undefined}
            className="min-h-11"
            onChange={(event) => {
              setLengthRaw(event.target.value);
              setDirty(true);
              setLengthError(null);
              setSavedMessage(null);
            }}
          />
          {lengthError ? (
            <p id={`${lengthId}-error`} role="alert" className="text-sm" style={{ color: "#b3261e" }}>
              {lengthError}
            </p>
          ) : null}
        </div>
      </div>

      {formError ? (
        <p className="mt-[12px] text-sm" role="alert" style={{ color: "#b3261e" }}>
          {formError}
        </p>
      ) : null}
      {savedMessage ? (
        <p className="mt-[12px] text-sm" role="status" style={{ color: "#0a7a63" }}>
          {savedMessage}
        </p>
      ) : null}

      <div className="mt-[16px] flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving} className="min-h-11">
          {saving ? "Saving…" : "Save measured size"}
        </Button>
      </div>
    </form>
  );
}
