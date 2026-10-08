"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, CircleAlert, Coins, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_STEPS } from "@/components/booking/BookingStatusTimeline";
import { SaveBookingAccountCard } from "@/components/booking/SaveBookingAccountCard";
import { bookingStatusVariant } from "@/components/admin/bookingBadges";
import { bookingAddOnLabels, OPS_ADD_ON_COPY } from "@/lib/techUi";
import { APP_TIMEZONE, formatBookingCollection } from "@/lib/localCalendarDate";
import {
  amountDueCentsForBooking,
  balanceAmountCents,
  depositAmountCents,
  DEPOSIT_FRACTION,
} from "@/lib/payments/deposit";
import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import { telHref, whatsappHref } from "@/lib/phone";
import { PayButton } from "@/components/payments/PayButton";
import type { AuthUser } from "@/lib/authClient";
import type { Booking, BookingStatus } from "@/types/booking";
import { cn } from "@/lib/utils";

type TabId = "tracking" | "items" | "invoice";

const TABS: { id: TabId; label: string }[] = [
  { id: "tracking", label: "Tracking" },
  { id: "items", label: "Items" },
  { id: "invoice", label: "Invoice" },
];

function formatRand(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `R${amount.replace(/[\u00a0\u202f]/g, " ")}`;
}

function formatEstimate(min: number, max: number) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 })
      .format(n)
      .replace(/[\u00a0\u202f]/g, " ");
  if (min === max) return `R${fmt(min)}`;
  return `R${fmt(min)} – R${fmt(max)}`;
}

function paymentStatusPresentation(status: string): {
  variant: "status-overdue" | "status-new" | "status-cleaning" | "outline";
} {
  if (status === "UNPAID") return { variant: "status-overdue" };
  if (status === "DEPOSIT") return { variant: "status-new" };
  if (status === "PAID") return { variant: "status-cleaning" };
  return { variant: "outline" };
}

function slotLabel(slot: Booking["collectionSlot"]) {
  return slot === "MORNING" ? "08:00 – 12:00" : "12:00 – 16:00";
}

function formatDimensions(widthM: number | null, lengthM: number | null) {
  if (
    typeof widthM === "number" &&
    typeof lengthM === "number" &&
    widthM > 0 &&
    lengthM > 0
  ) {
    return `${widthM}m × ${lengthM}m`;
  }
  return "To be measured on collection";
}

function placedLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function photoSrc(photos?: string[]) {
  return photos?.find(
    (src) =>
      typeof src === "string" &&
      (src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://"))
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "—";
}

function stepTone(index: number, currentIndex: number): "done" | "now" | "next" {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return "now";
  return "next";
}

export function ClientBookingDetail({
  booking,
  signedInClient,
  user,
  error,
  onRefresh,
}: {
  booking: Booking;
  signedInClient: boolean;
  user: AuthUser | null;
  error: string | null;
  onRefresh: () => void;
}) {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const [tab, setTab] = useState<TabId>(
    checkout === "success" || checkout === "cancel" ? "invoice" : "tracking"
  );
  const statusMeta = BOOKING_STATUS_STEPS.find((step) => step.id === booking.status);
  const statusLabel =
    booking.status === "CANCELLED" ? "Cancelled" : (statusMeta?.label ?? booking.status);
  const cancelled = booking.status === "CANCELLED";
  const currentIndex = BOOKING_STATUS_STEPS.findIndex(
    (step) => step.id === (booking.status as BookingStatus)
  );
  const dims = formatDimensions(booking.rug.widthM, booking.rug.lengthM);
  const title = dims.startsWith("To be") ? booking.rug.type : `${booking.rug.type} · ${dims}`;
  const placed = placedLabel(booking.createdAt);
  const addOns = bookingAddOnLabels(booking.addOns, OPS_ADD_ON_COPY);
  const estimate = formatEstimate(booking.estimatedPriceMin, booking.estimatedPriceMax);
  const amountDueCents = amountDueCentsForBooking(booking);
  const depositCents = depositAmountCents(amountDueCents);
  const outstandingCents = balanceAmountCents(booking);
  const afterDepositCents = Math.max(0, amountDueCents - depositCents);
  const depositPercent = Math.round(DEPOSIT_FRACTION * 100);
  const payment = paymentStatusPresentation(booking.paymentStatus);
  const paymentLabel =
    booking.paymentStatus === "PAID"
      ? "Paid in full"
      : booking.paymentStatus === "DEPOSIT"
        ? "Deposit received"
        : "Unpaid";
  const technician = booking.technician;
  const technicianName = technician?.name?.trim() || "";
  const technicianPhone = technician?.phone?.trim() || "";
  const collectedIndex = BOOKING_STATUS_STEPS.findIndex((step) => step.id === "COLLECTED");
  const alreadyCollected = currentIndex >= collectedIndex && collectedIndex >= 0;
  const canPay =
    !cancelled &&
    clientOwnsBooking(user, booking) &&
    (booking.paymentStatus === "UNPAID" || booking.paymentStatus === "DEPOSIT");
  const payKind = booking.paymentStatus === "DEPOSIT" ? "BALANCE" : "DEPOSIT";
  const payCents = payKind === "BALANCE" ? outstandingCents : depositCents;
  const photo = photoSrc(booking.rug.photos);
  const couponCode = booking.promotion?.code || booking.couponCode;
  const discountCents = booking.promotion?.discountCents;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10 pb-16">
      <div className="mb-3.5">
        <Link
          href={signedInClient ? "/portal" : "/"}
          className="inline-flex min-h-11 items-center text-[13px] font-bold text-[#0a7a63] no-underline hover:underline"
        >
          {signedInClient ? "← My Bookings" : "← Home"}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-5">
        <div className="min-w-0">
          <p className="text-[10.5px] font-extrabold tracking-[0.14em] text-[#9aa0a6]">
            BOOKING {booking.id}
            {placed ? ` · PLACED ${placed}` : ""}
          </p>
          <h1 className="mt-2 break-words text-[26px] font-extrabold tracking-[-0.02em] text-[#000b49] sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-2 flex items-start gap-2 break-words text-[14.5px] text-[#6b7280]">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#0a7a63]" aria-hidden />
            <span>
              {[booking.addressLine1, booking.suburb, booking.city]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        </div>
        <Badge variant={bookingStatusVariant(booking.status)} className="shrink-0 px-[15px] py-[7px] text-[12px] font-extrabold">
          {statusLabel}
        </Badge>
      </div>

      {error ? (
        <p
          className="mt-3 rounded-[12px] border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-sm text-[#b33232]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div id="save-booking-account" className="mt-5">
        <SaveBookingAccountCard
          bookingId={booking.id}
          email={booking.customer.email}
          name={booking.customer.name}
          phone={booking.customer.phone}
          userId={booking.userId}
          user={user}
          onClaimed={onRefresh}
        />
      </div>

      <div
        className="mt-6 flex overflow-x-auto rounded-[12px] border border-[#e3e7ed] bg-white px-1.5"
        role="tablist"
        aria-label="Booking detail"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`booking-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`booking-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "min-h-11 shrink-0 whitespace-nowrap px-5 py-[15px] text-[13.5px] font-bold transition-colors",
                selected
                  ? "text-[#000b49] shadow-[inset_0_-3px_0_#6cf3d5]"
                  : "text-[#9aa0a6] hover:text-[#000b49]"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "tracking" ? (
        <div
          id="booking-panel-tracking"
          role="tabpanel"
          aria-labelledby="booking-tab-tracking"
          className="mt-5 flex flex-col items-stretch gap-5 lg:flex-row"
        >
          <div className="min-w-0 flex-1 rounded-[14px] border border-[#e3e7ed] bg-white px-5 py-6 sm:px-7 sm:py-[26px]">
            {cancelled ? (
              <p className="text-[15px] font-bold text-[#b33232]">This booking was cancelled.</p>
            ) : (
              <ol aria-label="Booking progress">
                {BOOKING_STATUS_STEPS.map((step, index) => {
                  const tone = stepTone(index, currentIndex < 0 ? 0 : currentIndex);
                  const last = index === BOOKING_STATUS_STEPS.length - 1;
                  const meta =
                    step.id === "SCHEDULED"
                      ? `${formatBookingCollection(booking.collectionDate, "d MMM yyyy")} · ${slotLabel(booking.collectionSlot)}`
                      : step.id === "COLLECTED" && alreadyCollected && technicianName
                        ? `${step.description} · ${technicianName}`
                        : step.description;
                  return (
                    <li key={step.id} className="flex gap-4">
                      <div className="flex flex-none flex-col items-center">
                        <span
                          className={cn(
                            "flex size-[26px] items-center justify-center rounded-full text-[12px] font-extrabold",
                            tone === "done" && "bg-[#0a7a63] text-white",
                            tone === "now" &&
                              "bg-[#6cf3d5] text-[#000b49] shadow-[0_0_0_4px_rgba(108,243,213,0.28)]",
                            tone === "next" && "bg-[#f0f2f6] text-[#b3b9c2]"
                          )}
                          aria-hidden
                        >
                          {tone === "done" ? (
                            <Check className="size-3.5" strokeWidth={3} />
                          ) : tone === "now" ? (
                            "●"
                          ) : null}
                        </span>
                        {!last ? (
                          <span
                            className={cn(
                              "min-h-[34px] w-0.5 flex-1",
                              tone === "done" ? "bg-[#0a7a63]" : "bg-[#e3e7ed]"
                            )}
                          />
                        ) : null}
                      </div>
                      <div className={cn("min-w-0 flex-1", !last && "pb-[22px]")}>
                        <p
                          className={cn(
                            "text-[15px] font-bold",
                            tone === "next" ? "text-[#9aa0a6]" : "text-[#000b49]"
                          )}
                        >
                          {step.label}
                          {tone === "now" ? <span className="sr-only"> (current)</span> : null}
                        </p>
                        <p className="mt-[5px] text-[13px] text-[#9aa0a6]">{meta}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <aside className="w-full rounded-[14px] border border-[#e3e7ed] bg-white p-[22px] lg:w-[288px] lg:flex-none">
            <p className="mb-4 text-[10.5px] font-extrabold tracking-[0.14em] text-[#9aa0a6]">
              YOUR TECHNICIAN
            </p>
            <div className="flex items-center gap-[13px]">
              <span
                className="flex size-[46px] flex-none items-center justify-center rounded-full bg-[#000b49] text-[16px] font-extrabold text-[#6cf3d5]"
                aria-hidden
              >
                {technicianName ? initials(technicianName) : "—"}
              </span>
              <div className="min-w-0">
                <p className="break-words text-[15px] font-bold text-[#000b49]">
                  {technicianName ||
                    (booking.assignedDriverId ? "Technician assigned" : "Not assigned yet")}
                </p>
                <p className="mt-[3px] text-[12.5px] text-[#9aa0a6]">
                  {booking.assignedDriverId
                    ? `${booking.city} collections`
                    : "We'll confirm before collection"}
                </p>
              </div>
            </div>
            {booking.assignedDriverId ? (
              <TechnicianContact
                name={technicianName || "your technician"}
                phone={technicianPhone}
                bookingId={booking.id}
              />
            ) : null}
            <p className="mt-[18px] text-[12px] leading-relaxed text-[#9aa0a6]">
              Need to change your delivery window? Message us before 16:00 the day before.
            </p>
          </aside>
        </div>
      ) : null}

      {tab === "items" ? (
        <div
          id="booking-panel-items"
          role="tabpanel"
          aria-labelledby="booking-tab-items"
          className="mt-5"
        >
          <article className="mb-[11px] flex items-center gap-4 rounded-[12px] border border-[#e3e7ed] bg-white px-4 py-[18px] sm:gap-[18px] sm:px-5">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="size-16 flex-none rounded-[9px] object-cover"
              />
            ) : (
              <div className="flex size-16 flex-none items-center justify-center rounded-[9px] bg-[#f0f2f6] text-[10px] font-bold text-[#b3b9c2]">
                PHOTO
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="break-words text-[15px] font-bold text-[#000b49]">{title}</p>
              <p className="mt-[5px] text-[12.5px] text-[#9aa0a6]">
                {formatBookingCollection(booking.collectionDate, "d MMM yyyy")} ·{" "}
                {slotLabel(booking.collectionSlot)} · {booking.suburb}
              </p>
              {addOns.length > 0 ? (
                <p className="mt-1.5 text-[12.5px] text-[#0a7a63]">{addOns.join(" · ")}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-[15px] font-extrabold text-[#000b49]">{estimate}</span>
          </article>
        </div>
      ) : null}

      {tab === "invoice" ? (
        <div
          id="booking-panel-invoice"
          role="tabpanel"
          aria-labelledby="booking-tab-invoice"
        >
          <div className="mt-5 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[14px] border border-[#e3e7ed] bg-white">
            <InvoiceRow label={`${booking.rug.type} · ${dims}`} value={estimate} />
            {addOns.map((label) => (
              <InvoiceRow key={label} label={label} value="Included" tone="teal" />
            ))}
            <InvoiceRow
              label={`Collection & delivery — ${booking.suburb}`}
              value="Included"
              tone="teal"
            />
            {couponCode ? (
              <InvoiceRow
                label={`Coupon ${couponCode}`}
                value={
                  typeof discountCents === "number" && discountCents > 0
                    ? `−${formatRand(discountCents)}`
                    : "Applied"
                }
                tone="teal"
              />
            ) : null}
            <div className="flex items-center justify-between gap-5 border-b border-[#f0f2f6] px-4 py-[15px] sm:px-6">
              <span className="text-[14px] text-[#6b7280]">Payment status</span>
              <Badge variant={payment.variant} className="shrink-0">
                {booking.paymentStatus === "UNPAID" ? (
                  <CircleAlert aria-hidden />
                ) : booking.paymentStatus === "PAID" ? (
                  <ShieldCheck aria-hidden />
                ) : (
                  <Coins aria-hidden />
                )}
                {paymentLabel}
              </Badge>
            </div>
            {booking.paymentStatus !== "PAID" && outstandingCents >= 1 ? (
              <InvoiceRow label="Amount still owed" value={formatRand(outstandingCents)} />
            ) : null}
            {booking.paymentStatus === "UNPAID" && depositCents >= 1 ? (
              <InvoiceRow
                label={`Deposit · ${depositPercent}%`}
                value={formatRand(depositCents)}
              />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f7f9fb] px-4 py-5 sm:px-6">
              <div>
                <p className="text-[13px] font-extrabold tracking-[0.08em] text-[#9aa0a6]">
                  ESTIMATED TOTAL
                </p>
                <p className="mt-1 break-words text-[24px] font-extrabold text-[#000b49]">
                  {estimate}
                </p>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-[14px] border border-[#e3e7ed] bg-white px-4 py-5 sm:px-5">
            <InvoicePayment
              booking={booking}
              canPay={canPay}
              payKind={payKind}
              payCents={payCents}
              depositPercent={depositPercent}
              outstandingCents={outstandingCents}
              afterDepositCents={afterDepositCents}
              checkout={checkout}
              onPaid={onRefresh}
            />
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TechnicianContact({
  name,
  phone,
  bookingId,
}: {
  name: string;
  phone: string;
  bookingId: string;
}) {
  const whatsappText = `Hi ${name}, I have a question about booking ${bookingId}.`;
  const buttonClass =
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-[7px] rounded-[10px] py-[13px] text-white no-underline";

  if (!phone) {
    return (
      <div className="mt-5">
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            title="No number on profile"
            aria-label="Call: No number on profile"
            className={`${buttonClass} cursor-not-allowed bg-[#000b49]/40`}
          >
            <Phone className="size-[19px]" aria-hidden />
            <span className="text-[11.5px] font-bold">Call</span>
          </button>
          <button
            type="button"
            disabled
            title="No number on profile"
            aria-label="WhatsApp: No number on profile"
            className={`${buttonClass} cursor-not-allowed bg-[#0a7a63]/40`}
          >
            <MessageCircle className="size-[19px]" aria-hidden />
            <span className="text-[11.5px] font-bold">WhatsApp</span>
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[#9aa0a6]">No number on profile</p>
      </div>
    );
  }

  return (
    <div className="mt-5 flex gap-2">
      <a
        href={telHref(phone)}
        className={`${buttonClass} bg-[#000b49] hover:bg-[#0a1a6b]`}
        aria-label={`Call ${name}`}
      >
        <Phone className="size-[19px]" aria-hidden />
        <span className="text-[11.5px] font-bold">Call</span>
      </a>
      <a
        href={whatsappHref(phone, whatsappText)}
        className={`${buttonClass} bg-[#0a7a63] hover:bg-[#086b56]`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp ${name}`}
      >
        <MessageCircle className="size-[19px]" aria-hidden />
        <span className="text-[11.5px] font-bold">WhatsApp</span>
      </a>
    </div>
  );
}

function InvoicePayment({
  booking,
  canPay,
  payKind,
  payCents,
  depositPercent,
  outstandingCents,
  afterDepositCents,
  checkout,
  onPaid,
}: {
  booking: Booking;
  canPay: boolean;
  payKind: "DEPOSIT" | "BALANCE";
  payCents: number;
  depositPercent: number;
  outstandingCents: number;
  afterDepositCents: number;
  checkout: string | null;
  onPaid: () => void;
}) {
  const loginHref = `/login?${new URLSearchParams({
    email: booking.customer.email.trim().toLowerCase(),
    next: `/booking/${booking.id}`,
  }).toString()}`;

  if (booking.status === "CANCELLED") {
    return (
      <p className="text-[13px] leading-relaxed text-[#6b7280]">
        This booking was cancelled, so there is nothing to pay.
      </p>
    );
  }

  if (booking.paymentStatus === "PAID") {
    return (
      <div
        className="flex items-start gap-3 rounded-[12px] border border-[#bfe9dc] bg-[#eafaf5] px-4 py-4"
        role="status"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0a7a63] text-white">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-[#0a7a63]">Paid in full</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#0a7a63]">
            This booking is settled. Nothing further is due before delivery.
          </p>
        </div>
      </div>
    );
  }

  const explanation =
    payCents < 1
      ? null
      : booking.paymentStatus === "DEPOSIT"
        ? `Deposit received. ${formatRand(outstandingCents)} remains before delivery.`
        : `A ${depositPercent}% deposit holds the collection slot. The remaining ${formatRand(afterDepositCents)} is due before delivery.`;

  return (
    <div className="space-y-3">
      {explanation ? (
        <p className="text-[13px] leading-relaxed text-[#6b7280]">{explanation}</p>
      ) : null}
      {checkout === "cancel" ? (
        <p className="rounded-[10px] border border-[#ffe98a] bg-[#fff7d1] px-3 py-2 text-[13px] text-[#8a6d00]" role="status">
          Payment was not completed. You can try again below.
        </p>
      ) : null}
      {checkout === "success" ? (
        <p className="rounded-[10px] border border-[#bfe9dc] bg-[#eafaf5] px-3 py-2 text-[13px] text-[#0a7a63]" role="status">
          Payment received. This booking will update as soon as the payment is confirmed.
        </p>
      ) : null}
      {canPay ? (
        <PayButton
          bookingId={booking.id}
          amountCents={payCents}
          kind={payKind}
          onPaid={onPaid}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-[#6b7280]">
            You can keep tracking this booking as a guest. To pay by card or Instant EFT,{" "}
            <a href="#save-booking-account" className="font-bold text-[#0a7a63] hover:underline">
              create a password
            </a>{" "}
            on this page, or{" "}
            <Link href={loginHref} className="font-bold text-[#0a7a63] hover:underline">
              log in and attach it
            </Link>
            . The booking ID stays the same.
          </p>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: string;
  tone?: "navy" | "teal";
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-[#f0f2f6] px-4 py-[15px] sm:px-6">
      <span className="min-w-0 break-words text-[14px] text-[#6b7280]">{label}</span>
      <span
        className={cn(
          "shrink-0 text-right text-[14px] font-bold",
          tone === "teal" ? "text-[#0a7a63]" : "text-[#000b49]"
        )}
      >
        {value}
      </span>
    </div>
  );
}
