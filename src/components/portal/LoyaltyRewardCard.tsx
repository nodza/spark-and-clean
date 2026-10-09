"use client";

import { useEffect, useState } from "react";
import { LOYALTY_PUNCHES_PER_REWARD } from "@/lib/promotion/loyaltyReward";
import { cn } from "@/lib/utils";

/**
 * Client portal loyalty card. Redeem lives here, not on payment history.
 */
export function LoyaltyRewardCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [punches, setPunches] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { loyalty?: { punches?: unknown } } } | null) => {
        if (cancelled) return;
        const value = data?.user?.loyalty?.punches;
        if (typeof value === "number" && Number.isFinite(value)) {
          setPunches(value);
        }
      })
      .catch(() => undefined);
    void fetch("/api/loyalty/redeem", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { codes?: unknown } | null) => {
        if (cancelled || !Array.isArray(data?.codes)) return;
        setCodes(data.codes.filter((code) => typeof code === "string" && code));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
    punches != null && punches >= LOYALTY_PUNCHES_PER_REWARD && !redeeming;

  return (
    <div className="mt-3.5 rounded-[14px] border-[1.5px] border-[#6cf3d5] bg-white p-5">
      <div className="mb-3 text-[10.5px] font-extrabold tracking-[0.14em] text-[#0a7a63]">
        EVERY 5TH CLEAN FREE
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: LOYALTY_PUNCHES_PER_REWARD }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-[9px] flex-1 rounded-full",
              i < filled ? "bg-[#0a7a63]" : "bg-[#eef1f5]"
            )}
          />
        ))}
      </div>
      <div className="mt-3.5 text-[15px] font-extrabold text-[#000b49]">
        {punches == null
          ? "Loyalty punches"
          : `${punches} punch${punches === 1 ? "" : "es"}`}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6b7280]">
        Each delivered clean earns a punch. Redeem {LOYALTY_PUNCHES_PER_REWARD}, then use your code when you book a rug.
      </p>
      <button
        type="button"
        onClick={() => void redeem()}
        disabled={!canRedeem}
        className="mt-3.5 inline-flex rounded-full bg-[#0a7a63] px-4 py-2 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#9aa0a6]"
      >
        {redeeming ? "Redeeming…" : "Redeem"}
      </button>
      {codes.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[13px] font-extrabold text-[#000b49]">
          {codes.map((code) => (
            <li key={code}>
              Your code: <span className="tracking-wide">{code}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12.5px] text-[#b33232]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
