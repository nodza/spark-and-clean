"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_TIMEZONE } from "@/lib/localCalendarDate";
import { cn } from "@/lib/utils";

type Receipt = {
  id: string;
  provider: string;
  providerRef: string;
  kind: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

type LoadState = "loading" | "ready" | "error";

function providerLabel(provider: string) {
  const value = provider.trim().toLowerCase();
  if (value === "stripe") return "Stripe";
  if (value === "ozow") return "Ozow";
  if (value === "manual") return "Manual";
  if (value === "test") return "Test";
  return provider.trim() || "—";
}

function kindLabel(kind: string) {
  const value = kind.trim().toUpperCase();
  if (value === "DEPOSIT") return "Deposit";
  if (value === "BALANCE") return "Balance";
  if (value === "REFUND") return "Refund";
  return kind.trim() || "—";
}

function statusLabel(status: string) {
  const value = status.trim().toUpperCase();
  if (value === "SUCCEEDED") return "Succeeded";
  if (value === "PENDING") return "Pending";
  if (value === "FAILED") return "Failed";
  if (value === "REFUNDED") return "Refunded";
  return status.trim() || "—";
}

function statusVariant(status: string) {
  const value = status.trim().toUpperCase();
  if (value === "SUCCEEDED") return "status-cleaning" as const;
  if (value === "PENDING") return "status-new" as const;
  if (value === "FAILED") return "status-overdue" as const;
  if (value === "REFUNDED") return "status-completed" as const;
  return "outline" as const;
}

function isRefund(receipt: Receipt) {
  return (
    receipt.kind.trim().toUpperCase() === "REFUND" ||
    receipt.status.trim().toUpperCase() === "REFUNDED"
  );
}

function formatAmount(cents: number, currency: string) {
  if (!Number.isFinite(cents)) return "—";
  const code = (currency || "ZAR").trim().toUpperCase() || "ZAR";
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
  const body = amount.replace(/\u00a0/g, " ");
  return code === "ZAR" ? `R ${body}` : `${code} ${body}`;
}

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim() || "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function toReceipt(value: unknown, index: number): Receipt | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const providerRef = String(row.providerRef || "");
  const id = String(row.id || providerRef || index);
  return {
    id,
    provider: String(row.provider || ""),
    providerRef,
    kind: String(row.kind || ""),
    amountCents: Number(row.amountCents) || 0,
    currency: String(row.currency || "ZAR"),
    status: String(row.status || ""),
    createdAt: String(row.createdAt || ""),
  };
}

function GatewayReference({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="mt-3 border-t border-[#e8ebf0] pt-3">
      <div className="text-eyebrow text-[#9aa0a6]">Gateway reference</div>
      <div className="mt-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed text-[#000b49]">
          {value}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="sr-only" aria-live="polite">
            {state === "copied" ? "Gateway reference copied" : ""}
          </span>
          {state === "copied" ? (
            <span className="text-[11px] font-bold text-[#0a7a63]">Copied</span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-11"
            onClick={() => void onCopy()}
            aria-label={`Copy gateway reference ${value}`}
          >
            {state === "copied" ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      </div>
      {state === "failed" ? (
        <p className="mt-2 text-[12.5px] font-semibold text-[#b3261e]" role="alert">
          Select the reference to copy it.
        </p>
      ) : null}
    </div>
  );
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const refund = isRefund(receipt);
  const amount = formatAmount(receipt.amountCents, receipt.currency);
  const when = formatReceiptDate(receipt.createdAt);

  return (
    <li className="min-w-0 rounded-[10px] border border-[#f0f2f6] bg-[#f7f9fb] px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-eyebrow text-[#9aa0a6]">Provider</div>
          <p className="text-body mt-1 text-[#000b49]">{providerLabel(receipt.provider)}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-eyebrow text-[#9aa0a6]">Status</div>
          <div className="mt-1 flex justify-end">
            <Badge variant={statusVariant(receipt.status)}>
              {statusLabel(receipt.status)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="text-eyebrow text-[#9aa0a6]">Amount</div>
          <p
            className={cn(
              "mt-1 break-words text-[18px] font-extrabold tabular-nums tracking-[-0.02em]",
              refund ? "text-[#0a7a63]" : "text-[#000b49]"
            )}
          >
            {refund ? `−${amount}` : amount}
          </p>
        </div>
        <div className="min-w-0">
          <div className="text-eyebrow text-[#9aa0a6]">Kind</div>
          <p className="text-body mt-1 break-words text-[#32373c]">{kindLabel(receipt.kind)}</p>
        </div>
        <div className="min-w-0">
          <div className="text-eyebrow text-[#9aa0a6]">Date</div>
          <p className="text-body mt-1 text-[#32373c]">
            {receipt.createdAt ? (
              <time dateTime={receipt.createdAt}>{when}</time>
            ) : (
              when
            )}
          </p>
        </div>
      </div>

      {receipt.providerRef ? (
        <GatewayReference value={receipt.providerRef} />
      ) : (
        <div className="mt-3 border-t border-[#e8ebf0] pt-3">
          <div className="text-eyebrow text-[#9aa0a6]">Gateway reference</div>
          <p className="text-body mt-1 text-[#32373c]">—</p>
        </div>
      )}
    </li>
  );
}

export function BookingReceipts({
  bookingId,
  refreshKey,
}: {
  bookingId: string;
  refreshKey?: string;
}) {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedBookingId = useRef<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "refresh", signal?: AbortSignal) => {
      const requestId = ++requestSeq.current;
      const current = () =>
        requestId === requestSeq.current && !signal?.aborted;

      if (mode === "initial") {
        setLoadState("loading");
        setReceipts(null);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const res = await fetch(
          `/api/admin/bookings/${encodeURIComponent(bookingId)}/payments`,
          { credentials: "include", signal }
        );
        const data = (await res.json().catch(() => null)) as {
          payments?: unknown;
          error?: string;
        } | null;
        if (!current()) return;
        if (!res.ok) {
          const message =
            res.status === 403
              ? "You do not have access to gateway receipts."
              : res.status === 404
                ? "This booking could not be found."
                : "Could not load receipts.";
          throw new Error(message);
        }
        const list = Array.isArray(data?.payments) ? data.payments : [];
        setReceipts(
          list
            .map((row, index) => toReceipt(row, index))
            .filter((row): row is Receipt => row !== null)
        );
        setLoadState("ready");
        loadedBookingId.current = bookingId;
      } catch (err) {
        if (!current()) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load receipts.");
        setLoadState("error");
      } finally {
        if (requestId === requestSeq.current && !signal?.aborted) {
          setRefreshing(false);
        }
      }
    },
    [bookingId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const mode = loadedBookingId.current === bookingId ? "refresh" : "initial";
    void load(mode, controller.signal);
    return () => controller.abort();
  }, [bookingId, refreshKey, load]);

  const showSkeleton = loadState === "loading" && receipts === null;

  return (
    <section
      className="ds-card min-w-0"
      aria-labelledby="booking-receipts-title"
      aria-busy={showSkeleton || refreshing}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="booking-receipts-title" className="text-card-title text-[#000b49]">
            Receipts
          </h2>
          <p className="text-meta mt-[6px] text-[#9aa0a6]">
            Gateway payments recorded for this booking.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={showSkeleton || refreshing}
          aria-label="Refresh gateway receipts"
          onClick={() => void load(receipts === null ? "initial" : "refresh")}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => void load(receipts === null ? "initial" : "refresh")}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {showSkeleton ? (
        <p className="text-meta mt-[16px] text-[#9aa0a6]" role="status">
          Loading receipts…
        </p>
      ) : null}

      {loadState === "ready" && receipts && receipts.length === 0 ? (
        <p className="text-meta mt-[16px] italic text-[#9aa0a6]">
          No gateway payments yet.
        </p>
      ) : null}

      {receipts && receipts.length > 0 ? (
        <ul className="mt-[16px] flex min-w-0 flex-col gap-3" aria-label="Gateway receipts">
          {receipts.map((receipt) => (
            <ReceiptRow key={receipt.id} receipt={receipt} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
