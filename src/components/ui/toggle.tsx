"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  id?: string;
}

/**
 * Design-spec toggle.
 *
 * Spec (Design Reference.dc.html):
 *   Track  38 × 22 px, radius 999px
 *   Knob   16 px white circle, 3px inset
 *   On     background #0a7a63
 *   Off    background #d8dde4
 *   Transition .18s
 */
function Toggle({ checked, onChange, label, className, id }: ToggleProps) {
  const autoId = React.useId();
  const toggleId = id ?? autoId;

  return (
    <div className={cn("flex items-center gap-[11px]", className)}>
      <input
        type="checkbox"
        id={toggleId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <label
        htmlFor={toggleId}
        className="relative flex-none cursor-pointer"
        style={{ width: 38, height: 22 }}
      >
        <span
          className="absolute inset-0 rounded-full transition-colors"
          style={{
            transitionDuration: "0.18s",
            backgroundColor: checked ? "#0a7a63" : "#d8dde4",
          }}
        />
        <span
          className="absolute top-[3px] size-4 rounded-full bg-white transition-[left]"
          style={{
            transitionDuration: "0.18s",
            left: checked ? 19 : 3,
          }}
        />
      </label>
      {label && (
        <span className="text-body text-ink">{label}</span>
      )}
    </div>
  );
}

export { Toggle };
