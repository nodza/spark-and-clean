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
  const rug = data.rug || { type: "", widthM: 0, lengthM: 0, areaSqM: 0 };

  const handleDimensionChange = (field: "widthM" | "lengthM", value: string) => {
    const numValue = parseFloat(value) || 0;
    const newRug = { ...rug, [field]: numValue };
    newRug.areaSqM = Number((newRug.widthM * newRug.lengthM).toFixed(2));
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
          <Label htmlFor="width">Width (meters)</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            placeholder="e.g. 2.5"
            value={rug.widthM || ""}
            onChange={(e) => handleDimensionChange("widthM", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="length">Length (meters)</Label>
          <Input
            id="length"
            type="number"
            step="0.1"
            placeholder="e.g. 3.0"
            value={rug.lengthM || ""}
            onChange={(e) => handleDimensionChange("lengthM", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-secondary/20 p-4">
        <span className="font-medium">Total Area:</span>
        <span className="text-2xl font-bold text-primary">{rug.areaSqM} m²</span>
      </div>
    </div>
  );
}
