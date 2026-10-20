import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  countDocuments: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/adminAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminAuth")>(
    "@/lib/adminAuth"
  );
  return {
    ...actual,
    requireFullAdmin: mocks.requireFullAdmin,
  };
});
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/User", () => ({
  User: {
    countDocuments: mocks.countDocuments,
    find: mocks.find,
  },
}));

import { HttpError } from "@/lib/adminAuth";
import { GET } from "./route";

function keysDeep(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) keysDeep(item, found);
    return found;
  }
  for (const [key, nested] of Object.entries(value)) {
    found.push(key);
    keysDeep(nested, found);
  }
  return found;
}

function findChain(docs: unknown[]) {
  const lean = vi.fn().mockResolvedValue(docs);
  const limit = vi.fn(() => ({ lean }));
  const skip = vi.fn(() => ({ limit }));
  const sort = vi.fn(() => ({ skip }));
  const select = vi.fn(() => ({ sort }));
  return { select, sort, skip, limit, lean };
}

const inactiveClient = {
  _id: "client-off",
  role: "client",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "",
  preferredCity: "",
  disabledAt: new Date("2026-01-01T00:00:00.000Z"),
  isActive: false,
  passwordHash: "hashed-secret",
  password: "plaintext",
  mustChangePassword: true,
  sessionsInvalidatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue({
    id: "admin-1",
    email: "admin@sparkandclean.co.za",
    role: "admin",
    adminTier: "full",
  });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.countDocuments.mockResolvedValue(1);
  mocks.find.mockReturnValue(findChain([inactiveClient]));
});

describe("GET /api/admin/clients", () => {
  it("returns every client field the page shows and no password material", async () => {
    const res = await GET(new Request("http://localhost/api/admin/clients"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.clients).toEqual([
      {
        id: "client-off",
        name: "Ada Lovelace",
        phone: "",
        email: "ada@example.com",
        city: "",
        inactive: true,
      },
    ]);
    const keys = keysDeep(body);
    expect(keys).not.toContain("password");
    expect(keys).not.toContain("passwordHash");
    expect(keys).not.toContain("mustChangePassword");
    expect(keys).not.toContain("sessionsInvalidatedAt");
  });

  it("asks only for client accounts and still includes switched-off rows", async () => {
    const chain = findChain([inactiveClient]);
    mocks.countDocuments.mockResolvedValue(40);
    mocks.find.mockReturnValue(chain);

    await GET(
      new Request("http://localhost/api/admin/clients?q=ada&page=2&limit=20")
    );
    const filter = mocks.countDocuments.mock.calls[0][0] as {
      role: { $in: string[] };
      disabledAt?: unknown;
      lastLoginAt?: unknown;
    };
    expect(filter.role.$in).toEqual(["client", "CUSTOMER"]);
    expect(filter.role.$in).not.toContain("admin");
    expect(filter.role.$in).not.toContain("technician");
    expect(filter).not.toHaveProperty("disabledAt");
    expect(filter).not.toHaveProperty("lastLoginAt");
    expect(String(chain.select.mock.calls[0][0])).not.toMatch(/password/i);
    expect(chain.skip).toHaveBeenCalledWith(20);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it("drops a driver and an office admin if they are returned with the clients", async () => {
    mocks.countDocuments.mockResolvedValue(3);
    mocks.find.mockReturnValue(
      findChain([
        inactiveClient,
        {
          _id: "admin",
          role: "admin",
          name: "Spark Admin (Full)",
          email: "admin@sparkandclean.co.za",
          passwordHash: "hash",
        },
        {
          _id: "driver",
          role: "technician",
          name: "Thabo Mbeki",
          email: "thabo@sparkandclean.co.za",
          passwordHash: "hash",
        },
      ])
    );

    const res = await GET(new Request("http://localhost/api/admin/clients"));
    const body = await res.json();
    expect(body.clients.map((row: { email: string }) => row.email)).toEqual([
      "ada@example.com",
    ]);
  });

  it("does not query users when the caller is not a full admin", async () => {
    mocks.requireFullAdmin.mockRejectedValue(new HttpError(403, "Forbidden"));
    const res = await GET(new Request("http://localhost/api/admin/clients"));
    expect(res.status).toBe(403);
    expect(mocks.countDocuments).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
