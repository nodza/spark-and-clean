import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverEmail } from "@/lib/email/deliver";
import type { TransactionalEmail } from "@/lib/email/layout";

const email: TransactionalEmail = {
  subject: "Your collection is booked",
  preheader: "SC-2418",
  eyebrow: "BOOKING CONFIRMED",
  heading: "You're booked in",
  intro: "We'll collect from Sandton.",
  cta: { label: "View my booking", href: "http://localhost:3000/booking/SC-2418" },
  footnote: "Call us before 16:00.",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deliverEmail", () => {
  it("writes the email to the log when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const mode = await deliverEmail({ to: "nomsa@example.com", email });

    expect(mode).toBe("log");
    const logged = spy.mock.calls.flat().join("\n");
    expect(logged).toContain("writing email to the log");
    expect(logged).toContain("To: nomsa@example.com");
    expect(logged).toContain("http://localhost:3000/booking/SC-2418");
    spy.mockRestore();
  });

  it("refuses to pretend a production email was sent without SMTP", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("APP_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(deliverEmail({ to: "nomsa@example.com", email })).rejects.toThrow(
      "Email delivery is not configured"
    );
    errorSpy.mockRestore();
  });
});
