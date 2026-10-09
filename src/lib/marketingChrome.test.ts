import { describe, expect, it } from "vitest";
import {
  hidesMarketingFooter,
  hidesMarketingHeader,
} from "@/lib/marketingChrome";

describe("marketing chrome on technician routes", () => {
  it("hides header and footer on the tech app, including job detail", () => {
    for (const path of [
      "/tech",
      "/tech/login",
      "/tech/dashboard",
      "/tech/map",
      "/tech/messages",
      "/tech/job/SC-100",
      "/tech/profile",
      "/tech/completed",
    ]) {
      expect(hidesMarketingHeader(path), path).toBe(true);
      expect(hidesMarketingFooter(path), path).toBe(true);
    }
  });
});

describe("marketing chrome elsewhere", () => {
  it("keeps the public site header and footer", () => {
    expect(hidesMarketingHeader("/")).toBe(false);
    expect(hidesMarketingFooter("/")).toBe(false);
    expect(hidesMarketingHeader("/contact")).toBe(false);
    expect(hidesMarketingFooter("/contact")).toBe(false);
  });

  it("drops the footer on the booking wizard and keeps the header", () => {
    expect(hidesMarketingHeader("/book/rug")).toBe(false);
    expect(hidesMarketingFooter("/book/rug")).toBe(true);
  });

  it("hides both on the booking status page", () => {
    expect(hidesMarketingHeader("/booking/SC-100")).toBe(true);
    expect(hidesMarketingFooter("/booking/SC-100")).toBe(true);
  });
});
