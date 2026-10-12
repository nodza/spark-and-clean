import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("@/models/User", () => ({
  User: {
    findOne: (...args: unknown[]) => mocks.findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mocks.findOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(...args),
  },
}));

import {
  creditReferrerOnce,
  ensureClientReferralCode,
  newReferralCode,
  normalizeReferralCode,
  referralSharePath,
  referrerIdForCode,
} from "@/lib/referral";

const sarahId = "507f1f77bcf86cd799439011";
const janeId = "507f1f77bcf86cd799439012";
const sarahCode = "K7MP4Q2N";

function query(value: unknown) {
  return {
    select: () => ({
      lean: async () => value,
    }),
  };
}

beforeEach(() => {
  mocks.findOne.mockReset();
  mocks.findOneAndUpdate.mockReset();
  mocks.updateOne.mockReset();
});

describe("referral codes", () => {
  it("generates a readable 8-character code", () => {
    const code = newReferralCode();
    expect(code).toHaveLength(8);
    expect(normalizeReferralCode(code)).toBe(code);
    expect(code).not.toMatch(/[01IO]/);
  });

  it("normalizes a shared code and rejects junk", () => {
    expect(normalizeReferralCode(" k7mp-4q2n ")).toBe(sarahCode);
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode("NOPE")).toBeNull();
    expect(normalizeReferralCode("K7MP4Q2NEXTRA")).toBeNull();
    expect(referralSharePath(sarahCode)).toBe("/signup?ref=K7MP4Q2N");
  });

  it("returns the same code on a later read and does not write again", async () => {
    mocks.findOne.mockReturnValue(query({ referralCode: sarahCode }));

    await expect(ensureClientReferralCode(sarahId)).resolves.toBe(sarahCode);
    await expect(ensureClientReferralCode(sarahId)).resolves.toBe(sarahCode);

    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("stores a code once when the client does not have one yet", async () => {
    mocks.findOne.mockReturnValue(query({ referralCode: null }));
    mocks.findOneAndUpdate.mockReturnValue(query({ referralCode: sarahCode }));

    await expect(ensureClientReferralCode(sarahId)).resolves.toBe(sarahCode);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: sarahId, role: "client" }),
      {
        $set: {
          referralCode: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/),
        },
      },
      { returnDocument: "after" }
    );
  });

  it("keeps the code another request saved when this write collides", async () => {
    mocks.findOne
      .mockReturnValueOnce(query({ referralCode: null }))
      .mockReturnValueOnce(query({ referralCode: sarahCode }));
    mocks.findOneAndUpdate.mockReturnValueOnce({
      select: () => ({
        lean: async () => {
          throw { code: 11000 };
        },
      }),
    });

    await expect(ensureClientReferralCode(sarahId)).resolves.toBe(sarahCode);
  });

  it("does not create a code for a technician", async () => {
    mocks.findOne.mockReturnValue(query(null));

    await expect(ensureClientReferralCode(sarahId)).resolves.toBeNull();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("referrer lookup", () => {
  it("attributes a matching client and ignores a bad or self ref", async () => {
    await expect(referrerIdForCode("not-a-code")).resolves.toBeNull();
    expect(mocks.findOne).not.toHaveBeenCalled();

    mocks.findOne.mockReturnValue(query({ _id: sarahId }));
    await expect(referrerIdForCode("k7mp-4q2n")).resolves.toBe(sarahId);
    expect(mocks.findOne).toHaveBeenCalledWith({
      referralCode: sarahCode,
      role: "client",
    });

    await expect(referrerIdForCode(sarahCode, sarahId)).resolves.toBeNull();

    mocks.findOne.mockReturnValue(query(null));
    await expect(referrerIdForCode(sarahCode, janeId)).resolves.toBeNull();
  });
});

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

describe("referrer credit on first delivery", () => {
  const janeBooking = { id: "SC-JANE", userId: janeId };
  const sarahBooking = { id: "SC-SARAH", userId: sarahId };

  it("gives Sarah one extra punch when Jane is delivered the first time", async () => {
    mocks.findOneAndUpdate.mockReturnValue(query({ referredByUserId: sarahId }));
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(creditReferrerOnce(janeBooking)).resolves.toBe(true);

    const claimFilter = mocks.findOneAndUpdate.mock.calls[0][0] as {
      _id: { toHexString(): string };
      $expr: { $ne: string[] };
    };
    expect(claimFilter._id.toHexString()).toBe(janeId);
    expect(claimFilter.$expr).toEqual({ $ne: ["$referredByUserId", "$_id"] });
    expect(mocks.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { referralRewardedAt: expect.any(Date) },
    });
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: sarahId },
      { $inc: { "loyalty.punches": 1 } }
    );
  });

  it("does not credit Sarah again when Jane is delivered a second time", async () => {
    mocks.findOneAndUpdate.mockReturnValue(query(null));

    await expect(creditReferrerOnce(janeBooking)).resolves.toBe(false);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("does not credit Sarah for her own delivery", async () => {
    mocks.findOneAndUpdate.mockReturnValue(query(null));

    await expect(creditReferrerOnce(sarahBooking)).resolves.toBe(false);
    expect(mocks.updateOne).not.toHaveBeenCalled();
    const claimFilter = mocks.findOneAndUpdate.mock.calls[0][0] as {
      _id: { toHexString(): string };
    };
    expect(claimFilter._id.toHexString()).toBe(sarahId);
  });

  it("does not punch the referrer when the friend referred themselves", async () => {
    mocks.findOneAndUpdate.mockReturnValue(query({ referredByUserId: janeId }));

    await expect(creditReferrerOnce(janeBooking)).resolves.toBe(false);
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
    const unsetId = (
      mocks.updateOne.mock.calls[0][0] as { _id: { toHexString(): string } }
    )._id;
    expect(unsetId.toHexString()).toBe(janeId);
    expect(mocks.updateOne.mock.calls[0][1]).toEqual({
      $unset: { referralRewardedAt: "" },
    });
  });

  it("releases the claim when the referrer punch cannot be saved", async () => {
    mocks.findOneAndUpdate.mockReturnValue(query({ referredByUserId: sarahId }));
    mocks.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    await expect(creditReferrerOnce(janeBooking)).rejects.toThrow(
      "Could not credit the referrer."
    );
    expect(mocks.updateOne).toHaveBeenLastCalledWith(
      { _id: expect.anything() },
      { $unset: { referralRewardedAt: "" } }
    );
  });

  it("skips a guest booking", async () => {
    await expect(
      creditReferrerOnce({ id: "SC-GUEST" })
    ).resolves.toBe(false);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("referral card placement", () => {
  it("shows the card on the client portal and not on technician pages", () => {
    const src = path.resolve(__dirname, "..");
    const techHits = walkFiles(path.join(src, "app", "tech")).filter((file) =>
      readFileSync(file, "utf8").includes("ReferralCard")
    );
    expect(techHits).toEqual([]);

    const portal = readFileSync(
      path.join(src, "app", "dashboard", "page.tsx"),
      "utf8"
    );
    expect(portal).toContain("ReferralCard");
  });
});
