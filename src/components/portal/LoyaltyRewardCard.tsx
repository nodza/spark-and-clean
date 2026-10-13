"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { LOYALTY_PUNCHES_PER_REWARD } from "@/lib/promotion/loyaltyReward";
import { cn } from "@/lib/utils";

/**
 * Client portal loyalty card. Redeem lives here, not on payment history.
 */
const LOAD_ERROR = "Loyalty punches could not be loaded.";

export function LoyaltyRewardCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [punches, setPunches] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLoyalty, setLoadingLoyalty] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingLoyalty(true);

    const punchesRequest = fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("me failed"))))
      .then((data: { user?: { loyalty?: { punches?: unknown } } } | null) => {
        if (cancelled) return false;
        const value = data?.user?.loyalty?.punches;
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          setPunches(value);
          return false;
        }
        return true;
      })
      .catch(() => !cancelled);

    const codesRequest = fetch("/api/loyalty/redeem", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("codes failed"))))
      .then((data: { codes?: unknown } | null) => {
        if (cancelled) return false;
        if (!Array.isArray(data?.codes)) return true;
        setCodes(data.codes.filter((code) => typeof code === "string" && code));
        return false;
      })
      .catch(() => !cancelled);

    void Promise.all([punchesRequest, codesRequest]).then(([punchesFailed, codesFailed]) => {
      if (cancelled) return;
      setLoadError(punchesFailed || codesFailed ? LOAD_ERROR : null);
      setLoadingLoyalty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!copiedCode) return;
    const timer = window.setTimeout(() => setCopiedCode(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedCode]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setCopyError(null);
    } catch {
      setCopiedCode(null);
      setCopyError("Could not copy. Select the coupon code above.");
    }
  }

  async function redeem() {
    setRedeeming(true);
    setError(null);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        code?: unknown;
        punches?: unknown;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not redeem punches"
        );
        return;
      }
      if (typeof data.punches === "number" && Number.isFinite(data.punches)) {
        setPunches(data.punches);
      }
      if (typeof data.code === "string" && data.code) {
        setCodes((current) =>
          current.includes(data.code as string)
            ? current
            : [...current, data.code as string]
        );
      }
    } catch {
      setError("Could not redeem punches");
    } finally {
      setRedeeming(false);
    }
  }

  const shown = punches ?? 0;
  const filled = Math.min(shown, LOYALTY_PUNCHES_PER_REWARD);
  const canRedeem =
    punches != null &&
    punches >= LOYALTY_PUNCHES_PER_REWARD &&
    !redeeming &&
    !loadingLoyalty &&
    !loadError;

  return (
    <div className="mt-3.5 rounded-[14px] border border-[#e3e7ed] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#0a7a63]">
          R500 OFF YOUR NEXT RUG
        </div>
        {punches != null ? (
          <div className="shrink-0 text-[11px] font-bold text-[#9aa0a6]">
            {filled}/{LOYALTY_PUNCHES_PER_REWARD}
          </div>
        ) : null}
      </div>
      <div
        className="mt-2 flex gap-1"
        role="img"
        aria-label={
          punches == null
            ? "Loyalty punches"
            : `${filled} of ${LOYALTY_PUNCHES_PER_REWARD} punches filled`
        }
      >
        {Array.from({ length: LOYALTY_PUNCHES_PER_REWARD }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < filled ? "bg-[#0a7a63]" : "bg-[#eef1f5]"
            )}
          />
        ))}
      </div>
      <div className="mt-2 text-[13px] font-extrabold text-[#000b49]">
        {punches == null
          ? "Loyalty punches"
          : `${punches} punch${punches === 1 ? "" : "es"}`}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6b7280]">
        A delivered clean earns a punch, and so does a friend&apos;s first
        delivery from your referral link. Redeem {LOYALTY_PUNCHES_PER_REWARD} for
        R500 off one rug, then paste the code when you book.
      </p>
      <button
        type="button"
        onClick={() => void redeem()}
        disabled={!canRedeem}
        aria-busy={redeeming}
        className="mt-2.5 inline-flex cursor-pointer items-center rounded-full border border-[#086350] bg-[#0a7a63] px-3 py-1 text-[12px] font-extrabold text-white transition hover:bg-[#086350] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a7a63] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#eef1f5] disabled:text-[#9aa0a6] disabled:hover:bg-[#eef1f5]"
      >
        {redeeming ? "Redeeming…" : "Redeem"}
      </button>
      {codes.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {codes.map((code) => {
            const copied = copiedCode === code;
            return (
              <li
                key={code}
                className="flex items-center gap-2 rounded-[10px] bg-[#f4f6f8] py-1 pl-2.5 pr-1"
              >
                <span className="shrink-0 text-[10px] font-extrabold tracking-[0.08em] text-[#9aa0a6]">
                  COUPON
                </span>
                <p
                  title={code}
                  className="min-w-0 flex-1 select-all truncate font-mono text-[12px] font-bold tracking-wide text-[#000b49]"
                >
                  {code}
                </p>
                <button
                  type="button"
                  onClick={() => void copyCode(code)}
                  aria-label={copied ? "Coupon code copied" : "Copy coupon code"}
                  title={copied ? "Copied" : "Copy coupon code"}
                  className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#000b49] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
                >
                  {copied ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <Copy aria-hidden className="size-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copiedCode ? "Coupon code copied" : ""}
      </span>
      {copyError ? (
        <p className="mt-2 text-[12.5px] text-[#b33232]" role="alert">
          {copyError}
        </p>
      ) : null}
      {loadError ? (
        <p className="mt-2 text-[12.5px] text-[#b33232]" role="alert">
          {loadError}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12.5px] text-[#b33232]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
