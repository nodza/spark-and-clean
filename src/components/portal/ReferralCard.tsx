"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { referralSharePath } from "@/lib/referralCode";

/**
 * Client portal referral card. Technicians never mount this.
 * The icon copies the signup link, which is what attributes a new client.
 */
export function ReferralCard() {
  const [code, setCode] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            user?: { referralCode?: unknown; role?: unknown };
          } | null
        ) => {
          if (cancelled) return;
          if (data?.user?.role && data.user.role !== "client") {
            setHidden(true);
            return;
          }
          const value = data?.user?.referralCode;
          if (typeof value === "string" && value) {
            setCode(value);
            setError(null);
            return;
          }
          setError("Referral code could not be loaded.");
        }
      )
      .catch(() => {
        if (!cancelled) setError("Referral code could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  const shareUrl = code ? `${origin}${referralSharePath(code)}` : "";

  async function copyLink() {
    if (!code || typeof window === "undefined") return;
    const link = `${window.location.origin}${referralSharePath(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Could not copy. Select the link instead.");
    }
  }

  return (
    <div className="mt-3.5 rounded-[14px] border border-[#e3e7ed] bg-white p-5">
      <div className="mb-3 text-[10.5px] font-extrabold tracking-[0.14em] text-[#9aa0a6]">
        REFER A FRIEND
      </div>
      <div className="text-[15px] font-extrabold text-[#000b49]">
        Your referral code
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6b7280]">
        Share this link. A friend who signs up from it is attributed to you.
      </p>
      <div className="mt-3.5 text-[20px] font-extrabold tracking-[0.08em] text-[#000b49]">
        {code ?? "Loading…"}
      </div>
      {shareUrl ? (
        <div className="mt-3 flex items-start gap-2">
          <p className="min-w-0 flex-1 break-all text-[12.5px] leading-relaxed text-[#0a7a63]">
            {shareUrl}
          </p>
          <span className="sr-only" aria-live="polite">
            {copied ? "Referral link copied" : ""}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            aria-label="Copy referral link"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#000b49] hover:bg-[#f0f2f6]"
          >
            {copied ? (
              <Check aria-hidden className="size-4 text-[#0a7a63]" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12.5px] text-[#b33232]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
