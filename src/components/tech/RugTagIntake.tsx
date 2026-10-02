"use client";

import { useState } from "react";
import { Loader2, Tag } from "lucide-react";
import type { Booking } from "@/types/booking";

type RugTagIntakeProps = {
  booking: Booking;
  onTagged: (booking: Booking) => void;
};

export function RugTagIntake({ booking, onTagged }: RugTagIntakeProps) {
  const [tagCode, setTagCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attachTag(code?: string) {
    if (busy || booking.rug.tagCode) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/rugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          ...(code ? { tagCode: code } : {}),
        }),
      });
      const result = (await response.json()) as Booking | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error : "Could not attach tag");
      }
      onTagged(result as Booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach tag");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="rug-tag-heading"
      className="rounded-xl border border-[#d7e9e4] bg-[#f5fbf8] px-[15px] py-3.5"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-navy">
        <Tag className="size-4 text-[#0a7a63]" aria-hidden />
        <h2 id="rug-tag-heading">Rug intake tag</h2>
      </div>

      {booking.rug.tagCode ? (
        <p className="mt-2 text-sm text-[#32373c]">
          Attached tag: <span className="font-extrabold">{booking.rug.tagCode}</span>
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#6b7280]">
            Attach a tag before marking this rug collected.
          </p>
          <label
            htmlFor="rug-tag-code"
            className="mb-1.5 mt-3 block text-xs font-semibold text-[#32373c]"
          >
            Pre-printed tag code <span className="font-normal text-[#9aa0a6]">(optional)</span>
          </label>
          <input
            id="rug-tag-code"
            value={tagCode}
            onChange={(event) => setTagCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            disabled={busy}
            placeholder="e.g. SC-001234"
            className="h-11 w-full rounded-lg border border-[#d9e1e5] bg-white px-3 text-sm text-navy outline-none placeholder:text-[#9aa0a6] focus:border-[#0a7a63] focus:ring-2 focus:ring-[#0a7a63]/15 disabled:opacity-60"
          />
          <div className="mt-2 flex gap-2">
            {tagCode.trim() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void attachTag(tagCode.trim())}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0a7a63] px-3 text-xs font-bold text-white hover:bg-[#086b56] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Attaching…" : "Use this code"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void attachTag()}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0a7a63] px-3 text-xs font-bold text-white hover:bg-[#086b56] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Attaching…" : "Generate tag"}
              </button>
            )}
          </div>
          {error ? (
            <p className="mt-2 text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}