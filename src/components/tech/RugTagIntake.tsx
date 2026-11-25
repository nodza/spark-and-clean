"use client";

import { useState } from "react";
import { Download, Loader2, Printer, Tag } from "lucide-react";
import { bookingRugs } from "@/lib/bookingRugs";
import { hasRugTagCode } from "@/lib/fieldStatus";
import type { Booking, BookingRug } from "@/types/booking";

type RugTagIntakeProps = {
  booking: Booking;
  onTagged: (booking: Booking) => void;
};

const printStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; font-family: Arial, sans-serif; }
  .sticker { width: 50mm; min-height: 56mm; padding: 3mm; border: 0.3mm solid #bbb; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
  img { display: block; width: 42mm; height: 42mm; }
  p { margin: 0; font-size: 11pt; font-weight: 700; overflow-wrap: anywhere; text-align: center; }
  .count { font-size: 9pt; font-weight: 700; }
  @media screen { body { padding: 16px; } }
`;

function RugTagCard({
  booking,
  rug,
  index,
  total,
  busyId,
  onBusy,
  onTagged,
}: {
  booking: Booking;
  rug: BookingRug;
  index: number;
  total: number;
  busyId: string | null;
  onBusy: (id: string | null) => void;
  onTagged: (booking: Booking) => void;
}) {
  const [tagCodeInput, setTagCodeInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const tagCode = hasRugTagCode(rug.tagCode) ? rug.tagCode!.trim() : "";
  const busy = busyId === rug.id;
  const position = `Rug ${index + 1} / ${total}`;
  const qrUrl = tagCode ? `/api/rugs/${encodeURIComponent(tagCode)}/qr` : "";
  const inputId = `rug-tag-code-${rug.id}`;

  async function attachTag(code?: string) {
    if (busyId || tagCode) return;
    onBusy(rug.id);
    setTagError(null);

    try {
      const response = await fetch("/api/rugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          rugId: rug.id,
          ...(code ? { tagCode: code } : {}),
        }),
      });
      const result = (await response.json()) as Booking | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error : "Could not attach tag");
      }
      onTagged(result as Booking);
    } catch (err) {
      setTagError(err instanceof Error ? err.message : "Could not attach tag");
    } finally {
      onBusy(null);
    }
  }

  function printSticker() {
    if (!tagCode) return;
    setPrintError(null);
    const printWindow = window.open("", "_blank", "popup,width=480,height=640");
    if (!printWindow) {
      setPrintError("Allow pop-ups to print this sticker.");
      return;
    }

    const document = printWindow.document;
    document.title = `Rug tag ${tagCode}`;
    const style = document.createElement("style");
    style.textContent = printStyles;
    const sticker = document.createElement("main");
    sticker.className = "sticker";
    const image = document.createElement("img");
    image.alt = `QR code for rug tag ${tagCode}`;
    const code = document.createElement("p");
    code.textContent = tagCode;
    const count = document.createElement("p");
    count.className = "count";
    count.textContent = position;
    sticker.append(image, code, count);
    document.head.append(style);
    document.body.replaceChildren(sticker);

    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    image.onerror = () => {
      printWindow.close();
      setPrintError("Could not load the QR sticker. Try again.");
    };
    printWindow.onafterprint = () => printWindow.close();
    image.src = qrUrl;
  }

  return (
    <section
      aria-labelledby={`rug-tag-sticker-heading-${rug.id}`}
      className="mt-3 rounded-xl border border-[#d7e9e4] bg-[#f5fbf8] px-[15px] py-3.5"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-navy">
        <Tag className="size-4 text-[#0a7a63]" aria-hidden />
        <h2 id={`rug-tag-sticker-heading-${rug.id}`}>
          {tagCode ? `${position} tag` : `${position} intake`}
        </h2>
      </div>
      {tagCode ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR code for rug tag ${tagCode}`}
              className="size-24 shrink-0 border border-[#e3e7ed] bg-white p-1"
            />
            <div className="min-w-0">
              <p className="break-all text-sm font-extrabold text-navy">{tagCode}</p>
              <p className="text-xs font-bold text-[#0a7a63]">{position}</p>
              <p className="mt-1 text-xs text-[#6b7280]">
                QR contains this tag code only.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={qrUrl}
              download={`${tagCode}.png`}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#0a7a63] bg-white px-3 text-xs font-bold text-[#0a7a63] hover:bg-[#edf8f4]"
            >
              <Download className="size-4" aria-hidden />
              Download
            </a>
            <button
              type="button"
              onClick={printSticker}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0a7a63] px-3 text-xs font-bold text-white hover:bg-[#086b56]"
            >
              <Printer className="size-4" aria-hidden />
              Print
            </button>
          </div>
          {printError ? (
            <p className="mt-2 text-xs font-medium text-destructive" role="alert">
              {printError}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#6b7280]">
            Attach a tag before marking this rug collected.
          </p>
          <label
            htmlFor={inputId}
            className="mb-1.5 mt-3 block text-xs font-semibold text-[#32373c]"
          >
            Pre-printed tag code <span className="font-normal text-[#9aa0a6]">(optional)</span>
          </label>
          <input
            id={inputId}
            value={tagCodeInput}
            onChange={(event) => setTagCodeInput(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            disabled={busy}
            placeholder="e.g. SC-RUG-ABC12345"
            className="h-11 w-full rounded-lg border border-[#d9e1e5] bg-white px-3 text-sm text-navy outline-none placeholder:text-[#9aa0a6] focus:border-[#0a7a63] focus:ring-2 focus:ring-[#0a7a63]/15 disabled:opacity-60"
          />
          <div className="mt-2 flex gap-2">
            {tagCodeInput.trim() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void attachTag(tagCodeInput.trim())}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0a7a63] px-3 text-xs font-bold text-white hover:bg-[#086b56] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Attaching?" : "Use this code"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void attachTag()}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0a7a63] px-3 text-xs font-bold text-white hover:bg-[#086b56] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Attaching?" : "Generate tag"}
              </button>
            )}
          </div>
          {tagError ? (
            <p className="mt-2 text-xs font-medium text-destructive" role="alert">
              {tagError}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function RugTagIntake({ booking, onTagged }: RugTagIntakeProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const rugs = bookingRugs(booking);

  return (
    <div className="flex flex-col gap-3">
      {rugs.map((rug, index) => (
        <RugTagCard
          key={rug.id}
          booking={booking}
          rug={rug}
          index={index}
          total={rugs.length}
          busyId={busyId}
          onBusy={setBusyId}
          onTagged={onTagged}
        />
      ))}
    </div>
  );
}
