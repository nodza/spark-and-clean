"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { referralSharePath } from "@/lib/referralCode";

/**
 * Client portal referral card. Technicians never mount this.
 * Copy and share both send the signup link, which is what attributes a new client.
 */
export function ReferralCard() {
  const [code, setCode] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const currentOrigin = window.location.origin;
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
          setCode(null);
          setError("Referral code could not be loaded.");
        }
      )
      .catch(() => {
        if (cancelled) return;
        setCode(null);
        setError("Referral code could not be loaded.");
      })
      .finally(() => {
        if (cancelled) return;
        setOrigin(currentOrigin);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  const shareUrl = code ? `${origin}${referralSharePath(code)}` : "";

  function signupLink() {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}${referralSharePath(code)}`;
  }

  async function copyLink() {
    const link = signupLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Could not copy. Select the link below.");
    }
  }

  async function shareLink() {
    const link = signupLink();
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Spark & Clean",
          text: "Spark & Clean collects, deep-cleans in just 7 minutes, and delivers right back to your door. Tap the link below to book your collection today:",
          url: link,
        });
        setError(null);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  const sharePath = code ? referralSharePath(code) : "";

  return (
    <div
      className="mt-3.5 rounded-[14px] border border-[#e3e7ed] bg-white p-5"
      aria-busy={loading}
    >
      <div className="mb-2 text-[10.5px] font-extrabold tracking-[0.14em] text-[#9aa0a6]">
        REFER A FRIEND
      </div>
      <p className="text-[12.5px] leading-relaxed text-[#6b7280]">
        You get one punch when a friend uses this link and their first booking
        is delivered. It counts toward your R500 reward.
      </p>
      {loading ? (
        <p className="mt-4 text-[13px] font-semibold text-[#9aa0a6]">Loading…</p>
      ) : code && sharePath ? (
        <div className="mt-4">
          <div className="rounded-[12px] bg-[#f4f6f8] px-3 py-3 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[#9aa0a6]">
              YOUR CODE
            </div>
            <div className="mt-1 whitespace-nowrap text-[18px] font-extrabold tracking-[0.22em] text-[#000b49]">
              {code}
            </div>
            <p className="mt-1 truncate text-[12px] text-[#6b7280]" title={shareUrl}>
              {sharePath}
            </p>
          </div>
          <span className="sr-only" aria-live="polite">
            {copied ? "Referral link copied" : ""}
          </span>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              aria-label={copied ? "Referral link copied" : "Copy referral link"}
              className="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#000b49] px-4 py-2 text-[13px] font-extrabold text-white transition hover:bg-[#0a1a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
            >
              {copied ? (
                <Check aria-hidden className="size-3.5" />
              ) : (
                <Copy aria-hidden className="size-3.5" />
              )}
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void shareLink()}
              aria-label="Share referral link"
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d5dbe3] bg-white text-[#000b49] transition hover:bg-[#f4f6f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
            >
              <Share2 aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2" role="alert">
          <p className="text-[12.5px] text-[#b33232]">{error}</p>
          {shareUrl && sharePath ? (
            <p className="mt-1 select-all text-[12px] leading-relaxed text-[#000b49]">
              {origin}
              <br />
              {sharePath}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
