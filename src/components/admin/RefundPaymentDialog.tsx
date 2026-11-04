"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseRandToCents } from "@/lib/payments/refundAmount";
import { formatRandCents } from "@/lib/priceFormat";

export type RefundTarget = {
  provider: string;
  providerRef: string;
  kind: string;
  currency: string;
  refundableCents: number;
};

function providerLabel(provider: string) {
  const value = provider.trim().toLowerCase();
  if (value === "stripe") return "Stripe";
  if (value === "ozow") return "Ozow";
  if (value === "manual") return "Manual";
  if (value === "test") return "Test";
  return provider.trim() || "Payment";
}

function kindLabel(kind: string) {
  const value = kind.trim().toUpperCase();
  if (value === "DEPOSIT") return "deposit";
  if (value === "BALANCE") return "balance";
  return kind.trim().toLowerCase() || "payment";
}

function needsReference(provider: string) {
  return provider.trim().toLowerCase() !== "stripe";
}

export function RefundPaymentDialog({
  bookingId,
  target,
  suggestedCents = 0,
  open,
  onOpenChange,
  onRefunded,
}: {
  bookingId: string;
  target: RefundTarget | null;
  suggestedCents?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefunded: () => void;
}) {
  const amountId = useId();
  const reasonId = useId();
  const referenceId = useId();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<"amount" | "reason" | "reference" | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setReason("");
    setReference("");
    setError(null);
    setField(null);
    setSubmitting(false);
    attempt.current = null;
  }, [open, target?.providerRef]);

  const refundable = target?.refundableCents ?? 0;
  const parsed = parseRandToCents(amount);
  const manual = target ? needsReference(target.provider) : false;
  const difference =
    suggestedCents > 0 && suggestedCents < refundable ? suggestedCents : 0;
  const canSubmit =
    !submitting &&
    target !== null &&
    parsed !== null &&
    parsed <= refundable &&
    reason.trim().length > 0 &&
    reason.trim().length <= 500 &&
    (!manual || reference.trim().length > 0);

  const fillAmount = (cents: number) => {
    setAmount((cents / 100).toFixed(2));
    setError(null);
    setField(null);
  };

  const submit = async () => {
    if (!target || submitting) return;
    const cents = parseRandToCents(amount);
    const trimmedReason = reason.trim();
    const trimmedReference = reference.trim();
    if (cents === null) {
      setField("amount");
      setError("Enter an amount like 75.00.");
      return;
    }
    if (cents > target.refundableCents) {
      setField("amount");
      setError(
        `You can refund up to ${formatRandCents(target.refundableCents)}.`
      );
      return;
    }
    if (!trimmedReason) {
      setField("reason");
      setError("Enter a reason for this refund.");
      return;
    }
    if (manual && !trimmedReference) {
      setField("reference");
      setError(
        target.provider.toLowerCase() === "ozow"
          ? "Enter the Ozow refund reference."
          : "Enter the refund reference."
      );
      return;
    }

    const fingerprint = `${target.providerRef}|${cents}|${trimmedReference}`;
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    setSubmitting(true);
    setError(null);
    setField(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/refunds`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceProviderRef: target.providerRef,
            amountCents: cents,
            reason: trimmedReason,
            idempotencyKey: attempt.current.key,
            ...(manual ? { reference: trimmedReference } : {}),
          }),
        }
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        field?: "amount" | "reason" | "reference";
        synced?: boolean;
      } | null;
      if (!res.ok) {
        setField(data?.field ?? null);
        setError(
          res.status === 403
            ? "You do not have access to refund payments."
            : data?.error || "Could not record the refund."
        );
        return;
      }
      attempt.current = null;
      toast.success(
        data?.synced
          ? "Stripe had already refunded this payment. The ledger is up to date."
          : `Refunded ${formatRandCents(cents)}.`
      );
      onRefunded();
      onOpenChange(false);
    } catch {
      setError("Could not record the refund. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = target
    ? `Refund ${providerLabel(target.provider)} ${kindLabel(target.kind)}`
    : "Refund payment";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(100dvh-2rem,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {manual
              ? "Record a refund you already issued. This updates the ledger and does not move money by itself."
              : "This sends the refund to the card through Stripe and updates the amount paid."}
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <form
            className="grid min-w-0 gap-4"
            noValidate
            aria-busy={submitting}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="min-w-0 rounded-[10px] border border-[#e8ebf0] bg-[#f7f9fb] px-3 py-3 sm:px-4">
              <p className="text-[12px] font-bold tracking-[0.04em] text-[#9aa0a6] uppercase">
                Available to refund
              </p>
              <p className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#000b49] tabular-nums">
                {formatRandCents(refundable)}
              </p>
              <p className="mt-1 break-all font-mono text-[12px] text-[#6b7280]">
                {target.providerRef}
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-[10px] border border-[#f6c9c9] bg-[#fdecec] px-3 py-2 text-[13px] leading-relaxed font-semibold text-[#b3261e]"
              >
                {error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={amountId}>Amount</Label>
              <Input
                id={amountId}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                disabled={submitting}
                aria-invalid={field === "amount"}
                aria-describedby={`${amountId}-hint`}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (field === "amount") {
                    setField(null);
                    setError(null);
                  }
                }}
              />
              <p id={`${amountId}-hint`} className="text-[12.5px] text-[#6b7280]">
                Up to {formatRandCents(refundable)}. Use rands, for example 75.00.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full"
                  disabled={submitting || refundable < 1}
                  onClick={() => fillAmount(refundable)}
                >
                  All · {formatRandCents(refundable)}
                </Button>
                {difference > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    disabled={submitting}
                    onClick={() => fillAmount(difference)}
                  >
                    Difference · {formatRandCents(difference)}
                  </Button>
                ) : null}
              </div>
            </div>

            {manual ? (
              <div className="grid gap-2">
                <Label htmlFor={referenceId}>Refund reference</Label>
                <Input
                  id={referenceId}
                  autoComplete="off"
                  maxLength={80}
                  value={reference}
                  disabled={submitting}
                  aria-invalid={field === "reference"}
                  aria-describedby={`${referenceId}-hint`}
                  onChange={(event) => {
                    setReference(event.target.value);
                    if (field === "reference") {
                      setField(null);
                      setError(null);
                    }
                  }}
                />
                <p id={`${referenceId}-hint`} className="text-[12.5px] text-[#6b7280]">
                  {target.provider.toLowerCase() === "ozow"
                    ? "The reference from the refund you issued in Ozow."
                    : "The reference from the refund you already issued."}
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={reasonId}>Reason</Label>
              <Textarea
                id={reasonId}
                rows={3}
                maxLength={500}
                value={reason}
                disabled={submitting}
                aria-invalid={field === "reason"}
                aria-describedby={`${reasonId}-hint`}
                placeholder="Why is this being refunded?"
                className="min-h-24 resize-y rounded-[10px] border-[1.5px] border-[#dfe2e7] bg-white px-[13px] py-[13px] text-[14.5px] text-[#32373c] shadow-none focus-visible:border-[#6cf3d5] focus-visible:ring-[3px] focus-visible:ring-[rgba(108,243,213,0.25)]"
                onChange={(event) => {
                  setReason(event.target.value);
                  if (field === "reason") {
                    setField(null);
                    setError(null);
                  }
                }}
              />
              <p id={`${reasonId}-hint`} className="text-[12.5px] text-[#6b7280]">
                {reason.trim().length} / 500. Required. The customer is not shown this text.
              </p>
            </div>

            <DialogFooter className="mt-1">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11 w-full sm:w-auto"
                disabled={!canSubmit}
              >
                {submitting
                  ? "Refunding…"
                  : parsed
                    ? `Refund ${formatRandCents(parsed)}`
                    : "Refund"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
