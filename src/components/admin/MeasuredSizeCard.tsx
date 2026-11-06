"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, SquarePen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { formatQuoteRange, formatRandCents } from "@/lib/priceFormat";
import type { Booking } from "@/types/booking";

function meterText(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

/**
 * Full admin corrects width and length from the dimensions label.
 * The server sets the price. This form never collects an amount.
 */
export function MeasuredSizeEditor({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
}) {
  const formId = useId();
  const widthId = `${formId}-width`;
  const lengthId = `${formId}-length`;
  const tipId = `${formId}-tip`;
  const [open, setOpen] = useState(false);
  const [widthRaw, setWidthRaw] = useState("");
  const [lengthRaw, setLengthRaw] = useState("");
  const [widthError, setWidthError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditor() {
    if (saving) return;
    setWidthRaw(meterText(booking.rug.widthM));
    setLengthRaw(meterText(booking.rug.lengthM));
    setWidthError(null);
    setLengthError(null);
    setFormError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);

    const parsed = readMeasuredMeters(widthRaw, lengthRaw);
    if (!parsed.ok) {
      const mentionsLength = parsed.error.toLowerCase().includes("length");
      const mentionsWidth = parsed.error.toLowerCase().includes("width");
      setWidthError(mentionsWidth || !mentionsLength ? parsed.error : null);
      setLengthError(mentionsLength ? parsed.error : null);
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
      onUpdated(data.booking);
      const range = formatQuoteRange(
        data.booking.measuredQuote?.estimatedPriceMin ?? 0,
        data.booking.measuredQuote?.estimatedPriceMax ?? 0
      );
      const due = formatRandCents(
        data.booking.measuredQuote?.amountDueCents ??
          data.booking.billing?.amountDueCents ??
          0
      );
      toast.success(
        data.booking.refundRequired
          ? "Size saved. The new price is below what was paid, so this booking needs a refund."
          : `Size saved. Final price after measurement is ${range}. Amount due ${due}.`
      );
      setOpen(false);
    } catch {
      setFormError("Could not save the measured size. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <span className="group/edit relative inline-flex translate-y-[-1px] align-middle">
        <button
          type="button"
          onClick={openEditor}
          disabled={saving}
          aria-haspopup="dialog"
          aria-label="Edit measurements"
          aria-describedby={tipId}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[#1a1a1a] transition-colors hover:bg-[#f5f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SquarePen className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-white opacity-0 shadow-sm transition-opacity group-hover/edit:opacity-100 group-focus-within/edit:opacity-100"
        >
          Edit measurements
        </span>
      </span>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving) return;
          setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[min(90vh,640px)] overflow-y-auto rounded-2xl sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-navy">Rug measurements</DialogTitle>
            <DialogDescription>
              Enter both sides in metres. Saving recalculates the amount due
              from the rug type, add-ons, and any coupon. The amount already
              paid stays the same.
            </DialogDescription>
          </DialogHeader>

          <form id={formId} className="grid gap-3" onSubmit={(event) => void onSubmit(event)} noValidate>
            {formError ? (
              <p
                className="rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-3 py-2 text-sm font-semibold text-[#b33232]"
                role="alert"
              >
                {formError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={widthId}>Width (m)</Label>
                <Input
                  id={widthId}
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  value={widthRaw}
                  disabled={saving}
                  placeholder="e.g. 2"
                  aria-invalid={widthError ? true : undefined}
                  aria-describedby={widthError ? `${widthId}-error` : undefined}
                  className="min-h-11 text-base"
                  onChange={(event) => {
                    setWidthRaw(event.target.value);
                    setWidthError(null);
                  }}
                />
                {widthError ? (
                  <p id={`${widthId}-error`} role="alert" className="text-[11px] font-semibold text-[#b33232]">
                    {widthError}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 space-y-1.5">
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
                  className="min-h-11 text-base"
                  onChange={(event) => {
                    setLengthRaw(event.target.value);
                    setLengthError(null);
                  }}
                />
                {lengthError ? (
                  <p id={`${lengthId}-error`} role="alert" className="text-[11px] font-semibold text-[#b33232]">
                    {lengthError}
                  </p>
                ) : null}
              </div>
            </div>
          </form>

          <DialogFooter className="mt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#e3e7ed] bg-white px-4 text-sm font-bold text-navy hover:bg-[#f5f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-40 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={saving}
              aria-busy={saving}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-navy px-4 text-sm font-extrabold text-white hover:bg-[#001a6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {saving ? "Saving…" : "Save measurements"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
