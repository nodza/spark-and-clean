"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { AccessDeniedBanner } from "@/components/auth/AccessDeniedBanner";
import { useRequireClientAuth } from "@/hooks/useRequireClientAuth";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  createdAt: string;
  bookingId: string;
  kind: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
};

function formatRand(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `R ${amount.replace(/\u00a0/g, " ")}`;
}

function isRefundRow(payment: PaymentRow) {
  return (
    payment.kind.toUpperCase() === "REFUND" ||
    payment.status.toUpperCase() === "REFUNDED"
  );
}

function formatPaymentAmount(payment: PaymentRow) {
  const formatted = formatRand(payment.amountCents);
  return isRefundRow(payment) ? `−${formatted}` : formatted;
}

function kindLabel(kind: string) {
  const value = kind.trim().toUpperCase();
  if (value === "DEPOSIT") return "Deposit";
  if (value === "BALANCE") return "Balance";
  if (value === "REFUND") return "Refund";
  return kind || "—";
}

function formatPaymentDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
  return {
    day: format(date, "d MMM yyyy"),
    time: format(date, "HH:mm"),
  };
}

function statusChip(status: string) {
  const value = status.trim().toUpperCase();
  if (value === "SUCCEEDED") {
    return {
      label: "Succeeded",
      className: "bg-[#eafaf5] text-[#0a7a63] border-[#bfe9dc]",
    };
  }
  if (value === "PENDING") {
    return {
      label: "Pending",
      className: "bg-[#fff7d1] text-[#8a6d00] border-[#ffe98a]",
    };
  }
  if (value === "FAILED") {
    return {
      label: "Failed",
      className: "bg-[#fdecec] text-[#b33232] border-[#f6c9c9]",
    };
  }
  if (value === "REFUNDED") {
    return {
      label: "Refunded",
      className: "bg-[#f0f2f6] text-[#6b7280] border-transparent",
    };
  }
  return {
    label: status || "—",
    className: "bg-[#f0f2f6] text-[#6b7280] border-transparent",
  };
}

function providerLabel(provider: string) {
  const value = provider.trim().toLowerCase();
  if (value === "stripe") return "Stripe";
  if (value === "ozow") return "Ozow";
  if (!value) return "—";
  return provider;
}

function StatusPill({ status }: { status: string }) {
  const chip = statusChip(status);
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full border px-[11px] py-1 text-[10.5px] font-extrabold tracking-[0.04em]",
        chip.className
      )}
    >
      {chip.label}
    </span>
  );
}

export default function ClientPaymentsPage() {
  const { email, ready } = useRequireClientAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as {
        payments?: PaymentRow[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Could not load payment history.");
      }
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load payment history."
      );
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !email) return;
    void loadPayments();
  }, [ready, email, loadPayments]);

  if (!ready || !email) return null;

  return (
    <div className="px-4 py-8 sm:px-10 sm:py-[34px] sm:pb-14">
      <Suspense fallback={null}>
        <AccessDeniedBanner />
      </Suspense>

      <div className="mb-[26px] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-[#000b49] sm:text-[30px]">
            Payment history
          </h1>
          <p className="mt-2 text-[14px] text-[#6b7280] sm:text-[14.5px]">
            What you paid, when, and through which provider.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPayments(true)}
          disabled={refreshing}
          className="inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full text-[#9aa0a6] hover:bg-white hover:text-[#000b49] disabled:opacity-60"
          aria-label="Refresh payments"
        >
          <RefreshCw
            className={cn("size-4", refreshing && "animate-spin")}
            aria-hidden
          />
        </button>
      </div>

      {error ? (
        <p
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="overflow-hidden rounded-[14px] border border-[#e3e7ed] bg-white p-6"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading your payments…</span>
          <div className="h-3 w-[22%] animate-pulse rounded-md bg-[#eef1f5]" />
          <div className="mt-6 h-12 animate-pulse rounded-lg bg-[#f3f5f8]" />
          <div className="mt-3 h-12 animate-pulse rounded-lg bg-[#f3f5f8]" />
          <div className="mt-3 h-12 animate-pulse rounded-lg bg-[#f3f5f8]" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-[14px] border border-[#e3e7ed] bg-white px-5 py-12 text-center sm:px-10 sm:py-[60px]">
          <div className="mx-auto flex size-[62px] items-center justify-center rounded-full bg-[#eafaf5]">
            <CreditCard className="size-[26px] text-[#0a7a63]" strokeWidth={1.7} aria-hidden />
          </div>
          <div className="mt-5 text-[21px] font-extrabold text-[#000b49]">
            No payments yet
          </div>
          <p className="mx-auto mt-2.5 max-w-[430px] text-sm leading-relaxed text-[#6b7280]">
            Deposits and balances will show here after you pay.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[14px] border border-[#e3e7ed] bg-white shadow-[0_2px_10px_rgba(0,11,73,.04)] md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f2f6] bg-[#f7f9fb]">
                  <th className="text-th px-6 py-3.5">Date</th>
                  <th className="text-th px-6 py-3.5">Booking</th>
                  <th className="text-th px-6 py-3.5">Kind</th>
                  <th className="text-th px-6 py-3.5">Amount</th>
                  <th className="text-th px-6 py-3.5">Provider</th>
                  <th className="text-th px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const when = formatPaymentDateParts(payment.createdAt);
                  const refund = isRefundRow(payment);
                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-[#f0f2f6] last:border-b-0 hover:bg-[#f7f9fb]"
                    >
                      <td className="whitespace-nowrap px-6 py-[18px]">
                        <div className="text-[13.5px] font-semibold text-[#000b49]">
                          {when.day}
                        </div>
                        {when.time ? (
                          <div className="mt-0.5 text-[12px] text-[#9aa0a6]">
                            {when.time}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-[18px]">
                        <Link
                          href={`/booking/${payment.bookingId}`}
                          className="break-all text-[13.5px] font-bold text-[#0a7a63] no-underline hover:text-[#000b49]"
                        >
                          {payment.bookingId}
                        </Link>
                      </td>
                      <td className="px-6 py-[18px] text-[13.5px] text-[#6b7280]">
                        {kindLabel(payment.kind)}
                      </td>
                      <td
                        className={cn(
                          "px-6 py-[18px] text-[14.5px] font-extrabold tabular-nums",
                          refund ? "text-[#0a7a63]" : "text-[#000b49]"
                        )}
                      >
                        {formatPaymentAmount(payment)}
                      </td>
                      <td className="px-6 py-[18px] text-[13.5px] text-[#6b7280]">
                        {providerLabel(payment.provider)}
                      </td>
                      <td className="px-6 py-[18px]">
                        <StatusPill status={payment.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2.5 md:hidden">
            {payments.map((payment) => {
              const when = formatPaymentDateParts(payment.createdAt);
              const refund = isRefundRow(payment);
              return (
                <div
                  key={payment.id}
                  className="rounded-[14px] border border-[#e3e7ed] bg-white px-5 py-4 shadow-[0_2px_10px_rgba(0,11,73,.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/booking/${payment.bookingId}`}
                      className="break-all text-[14.5px] font-bold text-[#0a7a63] no-underline hover:text-[#000b49]"
                    >
                      {payment.bookingId}
                    </Link>
                    <StatusPill status={payment.status} />
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-[20px] font-extrabold tabular-nums",
                      refund ? "text-[#0a7a63]" : "text-[#000b49]"
                    )}
                  >
                    {formatPaymentAmount(payment)}
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-[#9aa0a6]">
                    {kindLabel(payment.kind)} · {providerLabel(payment.provider)}
                    {when.day !== "—" ? ` · ${when.day}` : ""}
                    {when.time ? ` · ${when.time}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
