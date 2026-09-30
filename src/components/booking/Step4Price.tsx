"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Booking } from "@/types/booking";
import {
  estimateBookingPrice,
  ODOUR_RATE,
  STAIN_PROTECTION_RATE,
} from "@/lib/bookingEstimate";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

/** Letters and numbers only. The code must also be an active catalogue coupon. */
export function isValidCouponFormat(code: string): boolean {
  return /^[A-Za-z0-9]+$/.test(code.trim());
}

const EMPTY_ADD_ONS = {
  odourRemoval: false,
  stainProtection: false,
};

type AddOnRowProps = {
  id: string;
  label: string;
  priceLabel: string;
  pressed: boolean;
  onToggle: () => void;
};

function AddOnRow({ id, label, priceLabel, pressed, onToggle }: AddOnRowProps) {
  return (
    <button
      type="button"
      id={id}
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] border-[1.5px] px-3 py-3 text-left text-[13px] text-[#32373c] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed
          ? "border-green bg-[#eafaf5]"
          : "border-[#e5e7eb] bg-white hover:border-green/40"
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
            pressed
              ? "border-green bg-green text-white"
              : "border-[#c6cad2] bg-white"
          )}
          aria-hidden
        >
          {pressed ? <Check className="size-3 stroke-[3]" /> : null}
        </span>
        <span className="min-w-0 leading-snug">{label}</span>
      </span>
      <span className="shrink-0 font-bold text-navy">{priceLabel}</span>
    </button>
  );
}

export function Step4Price({ data, update }: StepProps) {
  const addOns = data.addOns || EMPTY_ADD_ONS;
  const estimate = estimateBookingPrice(data);
  const { area, dimensionsSkipped, odourPrice, stainProtectPrice } = estimate;

  const [couponInput, setCouponInput] = useState(data.couponCode || "");
  const [couponStatus, setCouponStatus] = useState<
    "idle" | "checking" | "success" | "error"
  >(data.couponCode ? "success" : "idle");
  const [couponError, setCouponError] = useState("Invalid coupon format");

  const odourDisplay = dimensionsSkipped
    ? `+R${ODOUR_RATE}/m²`
    : `+R${odourPrice || Math.round(area * ODOUR_RATE)}`;
  const stainDisplay = dimensionsSkipped
    ? `+R${STAIN_PROTECTION_RATE}/m²`
    : `+R${stainProtectPrice || Math.round(area * STAIN_PROTECTION_RATE)}`;

  const applyCoupon = async () => {
    const code = couponInput.trim();

    if (!isValidCouponFormat(code)) {
      setCouponError("Invalid coupon format");
      setCouponStatus("error");
      return;
    }

    setCouponStatus("checking");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.valid !== true) {
        setCouponError(
          typeof payload.error === "string"
            ? payload.error
            : "That coupon code isn't valid"
        );
        setCouponStatus("error");
        update({ couponCode: "" });
        return;
      }
      const accepted =
        typeof payload.code === "string" ? payload.code : code.trim();
      update({ couponCode: accepted });
      setCouponInput(accepted);
      setCouponStatus("success");
    } catch {
      setCouponError("Could not check that coupon. Please try again.");
      setCouponStatus("error");
    }
  };

  return (
    <div>
      <div className="mb-[18px] flex items-center gap-3 rounded-xl bg-navy px-4 py-3.5">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-teal text-[14px] font-extrabold text-navy">
          4
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-extrabold text-white">
            One clean from a free rug
          </div>
        </div>
      </div>

      <div className="mb-2.5 text-[14px] font-bold text-navy">
        Recommended add-ons
      </div>
      <div className="mb-[22px] flex flex-col gap-2">
        <AddOnRow
          id="odour"
          label="Odour removal"
          priceLabel={odourDisplay}
          pressed={addOns.odourRemoval}
          onToggle={() =>
            update({
              addOns: { ...addOns, odourRemoval: !addOns.odourRemoval },
            })
          }
        />
        <AddOnRow
          id="protect"
          label="Stain protection"
          priceLabel={stainDisplay}
          pressed={addOns.stainProtection}
          onToggle={() =>
            update({
              addOns: { ...addOns, stainProtection: !addOns.stainProtection },
            })
          }
        />
        {dimensionsSkipped &&
        (addOns.odourRemoval || addOns.stainProtection) ? (
          <p className="px-0.5 text-[12px] leading-relaxed text-[#6b7280]">
            Added — price confirmed after the driver measures on pickup.
          </p>
        ) : null}
      </div>

      <div className="mb-2 text-[14px] font-bold text-navy">Coupon code</div>
      <div className="mb-2 flex items-stretch gap-2">
        <Input
          id="coupon"
          placeholder="e.g. SPARK10"
          value={couponInput}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={couponStatus === "error" || undefined}
          aria-describedby={
            couponStatus === "error"
              ? "coupon-error"
              : couponStatus === "success"
                ? "coupon-success"
                : undefined
          }
          className="min-w-0 flex-1"
          onChange={(e) => {
            setCouponInput(e.target.value);
            if (couponStatus !== "idle") setCouponStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void applyCoupon();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void applyCoupon()}
          disabled={couponStatus === "checking"}
          className="h-auto min-h-11 shrink-0 self-stretch rounded-full border-[1.5px] border-navy px-4 text-[14px] font-bold"
        >
          {couponStatus === "checking" ? "Checking…" : "Apply"}
        </Button>
      </div>
      {couponStatus === "error" && (
        <p id="coupon-error" className="text-[12px] font-semibold text-[#b3261e]" role="alert">
          {couponError}
        </p>
      )}
      {couponStatus === "success" && (
        <p
          id="coupon-success"
          className="text-[12px] font-semibold text-green"
          role="status"
        >
          ✓ Coupon saved
        </p>
      )}
    </div>
  );
}
