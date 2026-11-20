import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(async () => ({ reminders: 2, deliveries: 1 })),
}));

vi.mock("@/lib/email/scheduledCustomerEmails", () => ({
  runScheduledCustomerEmails: () => mocks.run(),
}));

import { GET } from "./route";

const originalAppEnv = process.env.APP_ENV;
const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.APP_ENV = originalAppEnv;
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  mocks.run.mockClear();
});

describe("GET /api/cron/customer-emails", () => {
  it("rejects a production call without the cron secret", async () => {
    process.env.APP_ENV = "production";
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost/api/cron/customer-emails"));
    expect(res.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs the morning batch for an authorized caller", async () => {
    process.env.APP_ENV = "production";
    process.env.CRON_SECRET = "morning-secret";
    const res = await GET(
      new Request("http://localhost/api/cron/customer-emails", {
        headers: { authorization: "Bearer morning-secret" },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reminders: 2, deliveries: 1 });
  });

  it("allows a local call when no secret is configured", async () => {
    delete process.env.APP_ENV;
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost/api/cron/customer-emails"));
    expect(res.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });
});
