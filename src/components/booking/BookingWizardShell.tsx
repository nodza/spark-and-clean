"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CLIENT_STEP_TITLES = [
  "Rug & size",
  "Upload Photos",
  "Collection Details",
  "Extras",
  "Review & Confirm",
] as const;

export type BookingWizardSummary = {
  rugLabel: string;
  cityLabel: string;
  addOnsLabel: string;
  estimatePrimary: string;
  estimateHint?: string;
};

type BookingWizardShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  summary: BookingWizardSummary;
  onBack: () => void;
  onContinue: () => void;
  continueLabel: ReactNode;
  continueDisabled?: boolean;
  continueHint?: string;
  showBack: boolean;
  children: ReactNode;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px] leading-snug">
      <span className="shrink-0 text-[#6b7280]">{label}</span>
      <b className="max-w-[60%] text-right font-bold text-navy">{value}</b>
    </div>
  );
}

function BookingSummary({ summary }: { summary: BookingWizardSummary }) {
  return (
    <aside
      className="w-full shrink-0 rounded-[14px] bg-[#f7f8fa] p-4 md:w-[240px] md:p-[18px]"
      aria-label="Booking summary"
    >
      <div className="mb-3 text-[14px] font-extrabold text-navy">Your booking</div>
      <div className="flex flex-col gap-2">
        <SummaryRow label="Rug" value={summary.rugLabel} />
        <SummaryRow label="City" value={summary.cityLabel} />
        <SummaryRow label="Add-ons" value={summary.addOnsLabel} />
      </div>
      <div className="mt-3.5 flex items-baseline justify-between gap-3 border-t border-[#eceef1] pt-3 text-[16px] font-extrabold text-navy">
        <span>Estimate</span>
        <span className="tabular text-right">{summary.estimatePrimary}</span>
      </div>
      {summary.estimateHint ? (
        <p className="mt-1.5 text-right text-[11px] font-medium leading-snug text-[#9aa0a6]">
          {summary.estimateHint}
        </p>
      ) : null}
    </aside>
  );
}

export function BookingWizardShell({
  step,
  totalSteps,
  title,
  summary,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled = false,
  continueHint,
  showBack,
  children,
}: BookingWizardShellProps) {
  const showSummary = step === 4;

  return (
    <div className="relative mx-auto w-full max-w-2xl pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]">
      <div className="px-4 pt-[18px] sm:px-5">
        <div
          className="mb-2.5 flex w-full gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }, (_, index) => (
            <div
              key={index}
              className={cn(
                "h-[5px] min-w-0 flex-1 rounded-[3px] transition-colors duration-200",
                index < step ? "bg-navy" : "bg-[#e5e7eb]"
              )}
            />
          ))}
        </div>
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-green">
          Step {step} of {totalSteps}
        </p>
        <h1 className="mt-1 mb-4 text-[24px] font-extrabold leading-tight text-navy">
          {title}
        </h1>

        {showSummary ? (
          <div className="flex flex-col items-stretch gap-5 pb-6 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">{children}</div>
            <BookingSummary summary={summary} />
          </div>
        ) : (
          <div className="pb-6">{children}</div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eceef1] bg-white pb-[max(6px,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2 sm:px-5">
          {showBack ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-9 min-h-9 rounded-full border-[1.5px] border-navy px-4 text-[13px] font-bold"
            >
              Back
            </Button>
          ) : (
            <span className="h-9 w-0" aria-hidden />
          )}
          {!showSummary ? (
            <div
              className="min-w-0 truncate text-center text-[13px] font-extrabold text-navy tabular md:hidden"
              aria-live="polite"
            >
              {summary.estimatePrimary}
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={onContinue}
            disabled={continueDisabled}
            title={continueDisabled ? continueHint : undefined}
            aria-describedby={
              continueDisabled && continueHint ? "wizard-continue-hint" : undefined
            }
            className="h-9 min-h-9 rounded-full px-4 text-[13px] font-bold"
          >
            {continueLabel}
          </Button>
        </div>
        {continueDisabled && continueHint ? (
          <p id="wizard-continue-hint" className="sr-only">
            {continueHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
