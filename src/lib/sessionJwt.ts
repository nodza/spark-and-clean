/**
 * Edge-safe JWT helpers (no mongoose / next/headers).
 * Used by middleware and by src/lib/session.ts.
 */
import { SignJWT, jwtVerify } from "jose";
import {
  normalizeUserRole,
  type AdminTier,
  type UserRole,
} from "@/types/user";

export const SESSION_COOKIE = "sc_session";

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  adminTier?: AdminTier | null;
  driverProfileId?: string;
  /** Checkout guest session — no password account yet */
  guest?: boolean;
  /** JWT iat (seconds) — used to reject cookies issued before password reset */
  issuedAt?: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET in .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    adminTier: user.adminTier ?? null,
    driverProfileId: user.driverProfileId,
    guest: user.guest === true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(user.guest ? "2d" : "7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      role: normalizeUserRole(payload.role),
      adminTier:
        payload.adminTier === "full" || payload.adminTier === "marketing-only"
          ? payload.adminTier
          : null,
      driverProfileId:
        typeof payload.driverProfileId === "string"
          ? payload.driverProfileId
          : undefined,
      guest: payload.guest === true,
      issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}
