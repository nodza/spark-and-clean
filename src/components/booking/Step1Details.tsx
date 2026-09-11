"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Booking } from "@/types/booking";
import { RUG_TYPES } from "@/data/rugTypes";
import { RugTypeCard } from "@/components/booking/RugTypeCard";
import { FieldError } from "@/components/booking/FieldError";
import { hasRugDimensions } from "@/lib/bookingEstimate";
import {
  MAX_RUG_DIMENSION_M,
  validateDimensionMeters,
  type FieldErrors,
} from "@/lib/bookingValidation";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  /** Show validation when user tried to continue without a type */
  showTypeError?: boolean;
  onTypeSelected?: () => void;
  /** Field errors from wizard gate or live validation */
  errors?: FieldErrors;
  onClearError?: (field: string) => void;
  sizeSkipped?: boolean;
  onSizeSkippedChange?: (skipped: boolean) => void;
}

function DashedActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#9aa0a6] bg-white px-3 py-2.5",
        "text-[13px] font-semibold text-[#6b7280] transition-colors",
        "hover:border-navy hover:text-navy",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {children}
    </button>
  );
}

export function Step1Details({
  data,
  update,
  showTypeError = false,
  onTypeSelected,
  errors = {},
  onClearError,
  sizeSkipped = false,
  onSizeSkippedChange,
}: StepProps) {
  const rug = data.rug || { type: "", widthM: null, lengthM: null, areaSqM: 0 };
  const hasDimensions = hasRugDimensions(rug.widthM, rug.lengthM);

  const widthError =
    errors.widthM || validateDimensionMeters(rug.widthM, "Width");
  const lengthError =
    errors.lengthM || validateDimensionMeters(rug.lengthM, "Length");

  const showWidthError = Boolean(errors.widthM) || (rug.widthM != null && !!widthError);
  const showLengthError =
    Boolean(errors.lengthM) || (rug.lengthM != null && !!lengthError);

  const handleDimensionChange = (field: "widthM" | "lengthM", value: string) => {
    const parsed = value.trim() === "" ? null : parseFloat(value);
    const numValue =
      parsed !== null && Number.isFinite(parsed) ? parsed : null;
    const newRug = { ...rug, [field]: numValue };
    const width = newRug.widthM;
    const length = newRug.lengthM;
    newRug.areaSqM = hasRugDimensions(width, length)
      ? Number((width! * length!).toFixed(2))
      : 0;
    update({ rug: newRug });
    onClearError?.(field);
  };

  const selectType = (typeId: string) => {
    const nextType = rug.type === typeId ? "" : typeId;
    update({ rug: { ...rug, type: nextType } });
    if (nextType) {
      onTypeSelected?.();
    }
  };

  const skipSize = () => {
    update({
      rug: { ...rug, widthM: null, lengthM: null, areaSqM: 0 },
    });
    onClearError?.("widthM");
    onClearError?.("lengthM");
    onSizeSkippedChange?.(true);
  };

  const undoSkipSize = () => {
    onSizeSkippedChange?.(false);
  };

  const areaLabel = hasDimensions && !showWidthError && !showLengthError
    ? `${rug.areaSqM} m²`
    : "enter width & length";

  return (
    <div>
      <p className="mb-2.5 text-[13px] text-[#6b7280]">What are we cleaning?</p>
      <div
        role="radiogroup"
        aria-labelledby="rug-type-label"
        aria-required="true"
        aria-invalid={showTypeError && !rug.type}
        className="mb-[22px] grid grid-cols-2 gap-4 md:grid-cols-3"
      >
        <span id="rug-type-label" className="sr-only">
          Rug type
        </span>
        {RUG_TYPES.map((type) => (
          <RugTypeCard
            key={type.id}
            title={type.title}
            description={type.description}
            imageUrl={type.imageUrl}
            fromPrice={type.fromPrice}
            selected={rug.type === type.id}
            onSelect={() => selectType(type.id)}
          />
        ))}
      </div>
      {showTypeError && !rug.type && (
        <div className="-mt-4 mb-5">
          <FieldError message="Please select a rug type to continue." />
        </div>
      )}

      <div className="border-t border-[#eceef1] pt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="text-[14px] font-bold text-navy">Dimensions</div>
          <div className="rounded-full bg-[#f2f3f6] px-2 py-0.5 text-[11px] font-semibold text-[#9aa0a6]">
            optional
          </div>
        </div>

        {sizeSkipped ? (
          <div>
            <div className="mb-2.5 flex items-start gap-2 rounded-[10px] border-[1.5px] border-green bg-[#eafaf5] p-3 text-[13px] leading-relaxed text-[#0a4f3f]">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Sizing skipped — no problem, our driver will measure the rug on
                pickup.
              </span>
            </div>
            <DashedActionButton onClick={undoSkipSize}>
              Undo — I&apos;ll enter dimensions
            </DashedActionButton>
          </div>
        ) : (
          <div>
            <div className="mb-2.5 flex gap-2.5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="width" className="sr-only">
                  Width in metres
                </label>
                <Input
                  id="width"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={MAX_RUG_DIMENSION_M}
                  placeholder="Width (m)"
                  value={rug.widthM ?? ""}
                  aria-invalid={showWidthError || undefined}
                  aria-describedby={showWidthError ? "width-error" : "width-hint"}
                  onChange={(e) => handleDimensionChange("widthM", e.target.value)}
                />
                {showWidthError ? (
                  <FieldError id="width-error" message={widthError} />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="length" className="sr-only">
                  Length in metres
                </label>
                <Input
                  id="length"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={MAX_RUG_DIMENSION_M}
                  placeholder="Length (m)"
                  value={rug.lengthM ?? ""}
                  aria-invalid={showLengthError || undefined}
                  aria-describedby={
                    showLengthError ? "length-error" : "length-hint"
                  }
                  onChange={(e) =>
                    handleDimensionChange("lengthM", e.target.value)
                  }
                />
                {showLengthError ? (
                  <FieldError id="length-error" message={lengthError} />
                ) : null}
              </div>
            </div>
            <p id="width-hint" className="sr-only">
              Optional width in metres, up to {MAX_RUG_DIMENSION_M}m.
            </p>
            <p id="length-hint" className="sr-only">
              Optional length in metres, up to {MAX_RUG_DIMENSION_M}m.
            </p>
            <div className="mb-3 rounded-[10px] bg-[#f7f8fa] px-3 py-2.5 text-[13px] text-[#32373c]">
              Estimated area:{" "}
              <b className="font-bold">{areaLabel}</b>
            </div>
            <DashedActionButton onClick={skipSize}>
              Skip — I don&apos;t have a tape measure
            </DashedActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
