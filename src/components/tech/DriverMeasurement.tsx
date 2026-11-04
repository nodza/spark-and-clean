"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, Ruler, SquarePen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hasRugDimensions } from "@/lib/bookingEstimate";
import { canTechnicianEditSize } from "@/lib/fieldStatus";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { rugDimensionLabel } from "@/lib/techUi";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";

function meterText(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

/**
 * Shows the rug size on a driver job. A pencil opens the correction form
 * only while the pickup is still scheduled. The server sets the price.
 */
export function DriverMeasurement({
  booking,
  disabled,
  onSave,
}: {
  booking: Booking;
  disabled?: boolean;
  onSave: (widthM: number, lengthM: number) => Promise<string | null>;
}) {
  const formId = useId();
  const widthId = `${formId}-width`;
  const lengthId = `${formId}-length`;
  const helpId = `${formId}-help`;
  const editTipId = `${formId}-edit-tip`;
  const canEdit = canTechnicianEditSize(booking.status);
  const hasSize = hasRugDimensions(booking.rug.widthM, booking.rug.lengthM);
  const editLabel = hasSize ? "Edit measurements" : "Enter measurements";
  const [open, setOpen] = useState(false);
  const [widthRaw, setWidthRaw] = useState("");
  const [lengthRaw, setLengthRaw] = useState("");
  const [widthError, setWidthError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditor() {
    if (!canEdit || disabled || saving) return;
    setWidthRaw(meterText(booking.rug.widthM));
    setLengthRaw(meterText(booking.rug.lengthM));
    setWidthError(null);
    setLengthError(null);
    setFormError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !canEdit) return;
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
    const error = await onSave(parsed.widthM, parsed.lengthM);
    setSaving(false);
    if (error) {
      setFormError(error);
      return;
    }
    setOpen(false);
  }

  return (
    <div className="mt-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9aa0a6]">
        <Ruler className="size-3.5 shrink-0" aria-hidden />
        <span>Dimensions</span>
        {canEdit ? (
          <span className="group/edit relative inline-flex translate-y-[-1px] normal-case tracking-normal">
            <button
              type="button"
              onClick={openEditor}
              disabled={disabled || saving}
              aria-haspopup="dialog"
              aria-label={editLabel}
              aria-describedby={editTipId}
              className="inline-flex size-7 items-center justify-center rounded-md text-[#1a1a1a] transition-colors hover:bg-[#f5f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SquarePen className="size-5" strokeWidth={1.75} aria-hidden />
            </button>
            <span
              id={editTipId}
              role="tooltip"
              className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover/edit:opacity-100 group-focus-within/edit:opacity-100"
            >
              {editLabel}
            </span>
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 text-sm font-semibold leading-snug",
          hasSize ? "text-navy" : "text-[#6b7280]"
        )}
      >
        <span className="sr-only">Measurements </span>
        {rugDimensionLabel(booking.rug)}
      </p>
      {canEdit ? (
        <p id={helpId} className="mt-2 text-xs leading-relaxed text-[#6b7280]">
          Measure width and length in metres.
        </p>
      ) : booking.status !== "BOOKED" ? (
        <p className="mt-2 text-xs leading-relaxed text-[#9aa0a6]">
          Measurements are final once the rug is collected.
        </p>
      ) : null}

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
            <DialogDescription className="text-xs leading-relaxed text-[#6b7280]">
              Enter width and length in metres. You can adjust this until you
              mark the rug collected.
            </DialogDescription>
          </DialogHeader>

          <form id={formId} onSubmit={(event) => void onSubmit(event)} className="grid gap-3">
            {formError ? (
              <p
                className="rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-3 py-2 text-sm font-semibold text-[#b33232]"
                role="alert"
              >
                {formError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor={widthId} className="mb-1 block text-[11px] font-bold text-navy">
                  Width (m)
                </label>
                <Input
                  id={widthId}
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  value={widthRaw}
                  disabled={saving}
                  aria-invalid={Boolean(widthError)}
                  aria-describedby={widthError ? `${widthId}-error` : helpId}
                  placeholder="e.g. 2"
                  className="min-h-11 text-base"
                  onChange={(event) => {
                    setWidthRaw(event.target.value);
                    setWidthError(null);
                  }}
                />
                {widthError ? (
                  <p
                    id={`${widthId}-error`}
                    className="mt-1 text-[11px] font-semibold text-[#b33232]"
                    role="alert"
                  >
                    {widthError}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <label htmlFor={lengthId} className="mb-1 block text-[11px] font-bold text-navy">
                  Length (m)
                </label>
                <Input
                  id={lengthId}
                  inputMode="decimal"
                  autoComplete="off"
                  value={lengthRaw}
                  disabled={saving}
                  aria-invalid={Boolean(lengthError)}
                  aria-describedby={lengthError ? `${lengthId}-error` : helpId}
                  placeholder="e.g. 3"
                  className="min-h-11 text-base"
                  onChange={(event) => {
                    setLengthRaw(event.target.value);
                    setLengthError(null);
                  }}
                />
                {lengthError ? (
                  <p
                    id={`${lengthId}-error`}
                    className="mt-1 text-[11px] font-semibold text-[#b33232]"
                    role="alert"
                  >
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
              {saving ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
