import { describe, expect, it } from "vitest";
import { bookingPageUrl } from "@/lib/email/appUrl";
import { renderTransactionalEmail } from "@/lib/email/layout";
import { bookingConfirmedEmail, passwordResetEmail } from "@/lib/email/copy";
import type { Booking } from "@/types/booking";

function booking(): Booking {
  return {
    id: "SC-2418",
    customer: {
      id: "guest",
      name: "Nomsa<script>",
      phone: "0820000000",
      email: "nomsa@example.com",
    },
    suburb: "Sandton",
    addressLine1: "18 Fredman Drive",
    city: "Johannesburg",
    collectionDate: "2026-09-02",
    collectionSlot: "MORNING",
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: false },
    estimatedPriceMin: 1640,
    estimatedPriceMax: 1640,
    status: "BOOKED",
    paymentStatus: "UNPAID",
    createdAt: "2026-08-26T08:00:00.000Z",
  };
}

describe("transactional email layout", () => {
  it("matches the design card and stays readable on a narrow screen", () => {
    const { html, text } = renderTransactionalEmail(bookingConfirmedEmail(booking()));
    const bookingUrl = bookingPageUrl("SC-2418");

    expect(html).toContain("background:#000b49");
    expect(html).toContain("background:#6cf3d5");
    expect(html).toContain("BOOKING CONFIRMED");
    expect(html).toContain("View my booking");
    expect(html).toContain(`href="${bookingUrl}"`);
    expect(html).toContain("@media only screen and (max-width:600px)");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("max-width:100%");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Nomsa&lt;script&gt;");
    expect(text).toContain(bookingUrl);
    expect(text).toContain("You're booked in, Nomsa");
  });

  it("puts the password reset on the same card", () => {
    const resetUrl = "http://localhost:3000/reset-password?token=abc";
    const { html } = renderTransactionalEmail(
      passwordResetEmail({ resetUrl, expiresInMinutes: 60 })
    );
    expect(html).toContain("PASSWORD RESET");
    expect(html).toContain(`href="${resetUrl}"`);
    expect(html).toContain("Reset my password");
    expect(html).toContain("expires in 60 minutes");
  });
});
