"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Booking } from "@/types/booking";
import { RUG_TYPES } from "@/data/rugTypes";
import { RugTypeCard } from "@/components/booking/RugTypeCard";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  /** Show validation when user tried to continue without a type */
  showTypeError?: boolean;
  onTypeSelected?: () => void;
}

export function Step1Details({
  data,
  update,
  showTypeError = false,
  onTypeSelected,
}: StepProps) {
  const rug = data.rug || { type: "", widthM: null, lengthM: null, areaSqM: 0 };
  const hasDimensions =
    typeof rug.widthM === "number" &&
    typeof rug.lengthM === "number" &&
    rug.widthM > 0 &&
    rug.lengthM > 0 &&
    Number.isFinite(rug.widthM) &&
    Number.isFinite(rug.lengthM);

  const handleDimensionChange = (field: "widthM" | "lengthM", value: string) => {
    const parsed = value.trim() === "" ? null : parseFloat(value);
    const numValue =
      parsed !== null && Number.isFinite(parsed) ? parsed : null;
    const newRug = { ...rug, [field]: numValue };
    const width = newRug.widthM;
    const length = newRug.lengthM;
    newRug.areaSqM =
      typeof width === "number" &&
      typeof length === "number" &&
      width > 0 &&
      length > 0 &&
      Number.isFinite(width) &&
      Number.isFinite(length)
        ? Number((width * length).toFixed(2))
        : 0;
    update({ rug: newRug });
  };

  const selectType = (typeId: string) => {
    // Clicking the selected card again clears to none
    const nextType = rug.type === typeId ? "" : typeId;
    update({ rug: { ...rug, type: nextType } });
    if (nextType) {
      onTypeSelected?.();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label id="rug-type-label">
          Rug Type <span className="text-destructive"></span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Pick the option that looks most like your rug 
        </p>
        <div
          role="radiogroup"
          aria-labelledby="rug-type-label"
          aria-required="true"
          aria-invalid={showTypeError && !rug.type}
          className="grid grid-cols-2 gap-4 md:grid-cols-3"
        >
          {RUG_TYPES.map((type) => (
            <RugTypeCard
              key={type.id}
              title={type.title}
              description={type.description}
              imageUrl={type.imageUrl}
              selected={rug.type === type.id}
              onSelect={() => selectType(type.id)}
            />
          ))}
        </div>
        {showTypeError && !rug.type && (
          <p className="text-sm text-destructive" role="alert">
            Please select a rug type to continue.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="width">Width (optional)</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g. 2.5"
            value={rug.widthM ?? ""}
            onChange={(e) => handleDimensionChange("widthM", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="length">Length (optional)</Label>
          <Input
            id="length"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g. 3.0"
            value={rug.lengthM ?? ""}
            onChange={(e) => handleDimensionChange("lengthM", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-secondary/20 p-4">
        <span className="font-medium">Total Area:</span>
        {hasDimensions ? (
          <span className="text-2xl font-bold text-primary">{rug.areaSqM} m²</span>
        ) : (
          <span className="text-right text-sm font-medium text-muted-foreground sm:text-base">
            Driver will measure on pickup
          </span>
        )}
      </div>
    </div>
  );
}
