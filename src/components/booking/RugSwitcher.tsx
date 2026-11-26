"use client";

import { MAX_RUGS_PER_BOOKING } from "@/lib/bookingRugs";
import type { WizardRug } from "@/lib/wizardRugs";
import { getRugTypeLabel } from "@/data/rugTypes";
import { cn } from "@/lib/utils";

type RugSwitcherProps = {
  rugs: WizardRug[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function RugSwitcher({
  rugs,
  activeIndex,
  onSelect,
  onAdd,
  onRemove,
  disabled = false,
}: RugSwitcherProps) {
  const atCap = rugs.length >= MAX_RUGS_PER_BOOKING;

  return (
    <div className="mb-4 rounded-[12px] border border-[#eceef1] bg-[#f7f8fa] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-navy">
          Rug {activeIndex + 1} of {rugs.length}
        </p>
        {rugs.length > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-[12px] font-semibold text-[#b3261e] disabled:opacity-50"
          >
            Remove this rug
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rugs in this booking">
        {rugs.map((rug, index) => {
          const selected = index === activeIndex;
          const label = rug.type ? getRugTypeLabel(rug.type) : `Rug ${index + 1}`;
          return (
            <button
              key={rug.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelect(index)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-[12px] font-semibold",
                selected
                  ? "border-navy bg-navy text-white"
                  : "border-[#d5d8de] bg-white text-navy"
              )}
            >
              {index + 1}. {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled || atCap}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#9aa0a6] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#6b7280] hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        {atCap ? `Up to ${MAX_RUGS_PER_BOOKING} rugs` : "Add another rug"}
      </button>
    </div>
  );
}
