"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Booking } from "@/types/booking";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

/** Phase 1: alphanumeric only (e.g. SPARK10, CLEANNEW). No discount calc yet. */
export function isValidCouponFormat(code: string): boolean {
  return /^[A-Za-z0-9]+$/.test(code.trim());
}

const ODOUR_RATE = 25;
const STAIN_PROTECTION_RATE = 40;

const EMPTY_ADD_ONS = {
  odourRemoval: false,
  stainProtection: false,
};

export function Step4Price({ data, update }: StepProps) {
  const addOns = data.addOns || EMPTY_ADD_ONS;
  const area =
    typeof data.rug?.areaSqM === "number" && Number.isFinite(data.rug.areaSqM)
      ? data.rug.areaSqM
      : 0;
  const dimensionsSkipped = !(
    typeof data.rug?.widthM === "number" &&
    typeof data.rug?.lengthM === "number" &&
    data.rug.widthM > 0 &&
    data.rug.lengthM > 0
  );

  const [couponInput, setCouponInput] = useState(data.couponCode || "");
  const [couponStatus, setCouponStatus] = useState<"idle" | "success" | "error">(
    data.couponCode ? "success" : "idle"
  );

  const baseRate = 80;
  const typeMultiplier = data.rug?.type === "Persian" ? 1.5 : 1.0;
  const basePrice = Math.round(area * baseRate * typeMultiplier) || 0;
  const odourPrice =
    addOns.odourRemoval && !dimensionsSkipped
      ? Math.round(area * ODOUR_RATE)
      : 0;
  const stainProtectPrice =
    addOns.stainProtection && !dimensionsSkipped
      ? Math.round(area * STAIN_PROTECTION_RATE)
      : 0;

  const totalMin = basePrice + odourPrice + stainProtectPrice;
  const totalMax = Math.round(totalMin * 1.2);

  useEffect(() => {
    if (data.estimatedPriceMin !== totalMin || data.estimatedPriceMax !== totalMax) {
      update({ estimatedPriceMin: totalMin, estimatedPriceMax: totalMax });
    }
  }, [totalMin, totalMax, data.estimatedPriceMin, data.estimatedPriceMax, update]);

  const applyCoupon = () => {
    const code = couponInput.trim();

    if (!isValidCouponFormat(code)) {
      setCouponStatus("error");
      return;
    }

    // Store code only — do not recalculate prices (Phase 2 / E8)
    update({ couponCode: code.toUpperCase() });
    setCouponInput(code.toUpperCase());
    setCouponStatus("success");
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-medium text-muted-foreground">Estimated Price</h3>
        <div className="text-4xl font-bold text-primary">
          R{totalMin} - R{totalMax}
        </div>
        <p className="text-sm text-muted-foreground">
          {dimensionsSkipped
            ? "Driver to measure on collection"
            : "Final price confirmed after inspection."}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Recommended Add-ons</h4>

        <label
          htmlFor="odour"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors",
            addOns.odourRemoval && "border-primary bg-primary/5"
          )}
        >
          <Checkbox
            id="odour"
            className="mt-0.5"
            checked={addOns.odourRemoval}
            onCheckedChange={(checked) =>
              update({
                addOns: { ...addOns, odourRemoval: checked === true },
              })
            }
          />
          <div className="grid min-w-0 flex-1 gap-1.5 leading-none">
            <span className="text-base font-medium">
              Odour Removal & Hygiene Treatment{" "}
              {dimensionsSkipped
                ? `(+R${ODOUR_RATE}/sqm)`
                : `(+R${odourPrice || Math.round(area * ODOUR_RATE)})`}
            </span>
            <p className="text-sm text-muted-foreground">
              Deep sanitizer and deodorizer
            </p>
            {dimensionsSkipped && addOns.odourRemoval && (
              <p className="text-sm text-muted-foreground">
                Added (price calculated after driver measurement)
              </p>
            )}
          </div>
        </label>

        <label
          htmlFor="protect"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors",
            addOns.stainProtection && "border-primary bg-primary/5"
          )}
        >
          <Checkbox
            id="protect"
            className="mt-0.5"
            checked={addOns.stainProtection}
            onCheckedChange={(checked) =>
              update({
                addOns: { ...addOns, stainProtection: checked === true },
              })
            }
          />
          <div className="grid min-w-0 flex-1 gap-1.5 leading-none">
            <span className="text-base font-medium">
              Stain Protection Treatment{" "}
              {dimensionsSkipped
                ? `(+R${STAIN_PROTECTION_RATE}/sqm)`
                : `(+R${stainProtectPrice || Math.round(area * STAIN_PROTECTION_RATE)})`}
            </span>
            <p className="text-sm text-muted-foreground">
              Specialized coating to resist spills
            </p>
            {dimensionsSkipped && addOns.stainProtection && (
              <p className="text-sm text-muted-foreground">
                Added (price calculated after driver measurement)
              </p>
            )}
          </div>
        </label>
      </div>

      <div className="space-y-3 rounded-xl border p-6">
        <Label htmlFor="coupon" className="text-base font-semibold">
          Coupon code
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="coupon"
            placeholder="e.g. SPARK10"
            value={couponInput}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              couponStatus === "error" && "border-destructive focus-visible:ring-destructive/30"
            )}
            onChange={(e) => {
              setCouponInput(e.target.value);
              if (couponStatus !== "idle") setCouponStatus("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCoupon();
              }
            }}
          />
          <Button type="button" onClick={applyCoupon} className="sm:w-28">
            Apply
          </Button>
        </div>
        {couponStatus === "error" && (
          <p className="text-sm text-destructive" role="alert">
            Invalid coupon format
          </p>
        )}
        {couponStatus === "success" && (
          <p className="text-sm font-medium text-green-600" role="status">
            Coupon applied successfully
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Format check only for Phase 1 — discounts will apply in a later release.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-accent/20 bg-accent/10 p-4">
        <div className="rounded-full bg-accent/20 p-2 text-accent-foreground">
          <Ticket className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-semibold text-accent-foreground">Loyalty Reward</h4>
          <p className="text-sm text-muted-foreground">
            You&apos;ve cleaned <span className="font-bold">3/5</span> rugs. 2 more for a
            free clean!
          </p>
        </div>
      </div>
    </div>
  );
}
