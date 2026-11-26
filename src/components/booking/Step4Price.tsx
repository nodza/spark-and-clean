"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getRugTypeLabel } from "@/data/rugTypes";
import { Booking } from "@/types/booking";
import {
  estimateBookingPrice,
  ODOUR_RATE,
  STAIN_PROTECTION_RATE,
} from "@/lib/bookingEstimate";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { COUPON_CODE_PATTERN, formatCouponDiscount } from "@/lib/coupon";
import { estimateQuoteMidpointCents } from "@/lib/promotion/applyCoupon";
import {
  requestCouponPreview,
  type CouponPreviewQuote,
} from "@/lib/promotion/requestCouponPreview";

export type RugPriceLine = {
  id: string;
  type: string;
  totalMin: number;
  totalMax: number;
  dimensionsSkipped: boolean;
};

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  /** Booking sum before the coupon. Defaults to the active rug. */
  bookingQuote?: {
    totalMin: number;
    totalMax: number;
    dimensionsSkipped: boolean;
    lines: RugPriceLine[];
  };
}

/** Letters and numbers only, 2–32 characters. Must also be an active catalogue coupon. */
export function isValidCouponFormat(code: string): boolean {
  return COUPON_CODE_PATTERN.test(code.trim());
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

export function Step4Price({ data, update, bookingQuote }: StepProps) {
  const addOns = data.addOns || EMPTY_ADD_ONS;
  const activeEstimate = estimateBookingPrice(data);
  const estimate = bookingQuote
    ? {
        totalMin: bookingQuote.totalMin,
        totalMax: bookingQuote.totalMax,
        dimensionsSkipped: bookingQuote.dimensionsSkipped,
      }
    : activeEstimate;
  const { area, dimensionsSkipped, odourPrice, stainProtectPrice } = activeEstimate;
  const lines = bookingQuote?.lines ?? [];

  const [couponInput, setCouponInput] = useState(data.couponCode || "");
  const [couponStatus, setCouponStatus] = useState<
    "idle" | "checking" | "success" | "error"
  >(data.couponCode ? "checking" : "idle");
  const [couponError, setCouponError] = useState("Invalid coupon format");
  const [couponMessage, setCouponMessage] = useState("");
  /** Base totals (before discount) already quoted for the applied code. */
  const quotedKey = useRef("");
  const applySeq = useRef(0);

  const odourDisplay = dimensionsSkipped
    ? `+R${ODOUR_RATE}/m²`
    : `+R${odourPrice || Math.round(area * ODOUR_RATE)}`;
  const stainDisplay = dimensionsSkipped
    ? `+R${STAIN_PROTECTION_RATE}/m²`
    : `+R${stainProtectPrice || Math.round(area * STAIN_PROTECTION_RATE)}`;

  const clearCoupon = () => {
    quotedKey.current = "";
    setCouponMessage("");
    update({
      couponCode: "",
      estimatedPriceMin: estimate.totalMin,
      estimatedPriceMax: estimate.totalMax,
      promotion: undefined,
    });
  };

  const publishQuote = (
    quote: CouponPreviewQuote,
    baseMin: number,
    baseMax: number
  ) => {
    quotedKey.current = `${quote.code}|${baseMin}|${baseMax}`;
    update({
      couponCode: quote.code,
      estimatedPriceMin: quote.estimateMin,
      estimatedPriceMax: quote.estimateMax,
      promotion: {
        code: quote.code,
        discountCents: quote.discountCents,
        amountDueCents: estimateQuoteMidpointCents(
          quote.estimateMin,
          quote.estimateMax
        ),
      },
    });
    setCouponInput(quote.code);
    setCouponMessage(
      `✓ ${formatCouponDiscount(quote.type, quote.value)} discount applied`
    );
    setCouponStatus("success");
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    const seq = ++applySeq.current;

    if (estimate.dimensionsSkipped) {
      setCouponError("Rug width and length are required to apply a coupon");
      setCouponStatus("error");
      clearCoupon();
      return;
    }

    if (!isValidCouponFormat(code)) {
      setCouponError("Invalid coupon format");
      setCouponStatus("error");
      clearCoupon();
      return;
    }

    const baseMin = estimate.totalMin;
    const baseMax = estimate.totalMax;
    setCouponStatus("checking");
    try {
      const result = await requestCouponPreview({
        code,
        estimateMin: baseMin,
        estimateMax: baseMax,
        city: data.city,
      });
      if (seq !== applySeq.current) return;
      if (!result.ok) {
        setCouponError(result.error);
        setCouponStatus("error");
        clearCoupon();
        return;
      }
      publishQuote(result.quote, baseMin, baseMax);
    } catch {
      if (seq !== applySeq.current) return;
      setCouponError("Could not check that coupon. Please try again.");
      setCouponStatus("error");
      clearCoupon();
    }
  };

  useEffect(() => {
    const code = data.couponCode;
    if (!code) return;
    if (estimate.dimensionsSkipped) return;
    const baseMin = estimate.totalMin;
    const baseMax = estimate.totalMax;
    const key = `${code}|${baseMin}|${baseMax}`;
    if (quotedKey.current === key) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await requestCouponPreview({
          code,
          estimateMin: baseMin,
          estimateMax: baseMax,
          city: data.city,
        });
        if (cancelled) return;
        if (!result.ok) {
          quotedKey.current = "";
          setCouponMessage("");
          setCouponError(result.error);
          setCouponStatus("error");
          update({
            couponCode: "",
            estimatedPriceMin: baseMin,
            estimatedPriceMax: baseMax,
            promotion: undefined,
          });
          return;
        }
        publishQuote(result.quote, baseMin, baseMax);
      } catch {
        if (cancelled) return;
        quotedKey.current = "";
        setCouponMessage("");
        setCouponError("Could not check that coupon. Please try again.");
        setCouponStatus("error");
        update({
          couponCode: "",
          estimatedPriceMin: baseMin,
          estimatedPriceMax: baseMax,
          promotion: undefined,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // publishQuote closes over the latest update; totals and code are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.couponCode, data.city, estimate.totalMin, estimate.totalMax]);

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

      {lines.length > 0 ? (
        <div className="mb-[22px]">
          <div className="mb-2.5 text-[14px] font-bold text-navy">Price per rug</div>
          <ul className="flex flex-col gap-2">
            {lines.map((line, index) => (
              <li
                key={line.id}
                className="flex items-baseline justify-between gap-3 rounded-[10px] bg-[#f7f8fa] px-3 py-2.5 text-[13px]"
              >
                <span className="min-w-0 text-[#32373c]">
                  Rug {index + 1}
                  {line.type ? ` · ${getRugTypeLabel(line.type)}` : ""}
                </span>
                <b className="shrink-0 text-navy">
                  {line.dimensionsSkipped || line.totalMin <= 0
                    ? "Measured on pickup"
                    : line.totalMax > line.totalMin
                      ? `R${line.totalMin} – R${line.totalMax}`
                      : `R${line.totalMin}`}
                </b>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
            {estimate.dimensionsSkipped
              ? "The booking total is confirmed after every rug is measured."
              : `Booking total R${estimate.totalMin} – R${estimate.totalMax}. A coupon applies to this total.`}
          </p>
        </div>
      ) : null}

      <div className="mb-2.5 text-[14px] font-bold text-navy">
        Add-ons for this rug
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
            applySeq.current += 1;
            setCouponInput(e.target.value);
            if (couponStatus !== "idle") setCouponStatus("idle");
            if (data.couponCode) clearCoupon();
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
      {couponStatus === "success" && couponMessage ? (
        <p
          id="coupon-success"
          className="text-[12px] font-semibold text-green"
          role="status"
        >
          {couponMessage}
        </p>
      ) : null}
    </div>
  );
}
