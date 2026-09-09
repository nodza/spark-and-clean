import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  normalizeUserRole,
  type AdminTier,
  type UserRole,
} from "@/types/user";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

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

export async function setSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Rejects JWTs issued before the user's sessionsInvalidatedAt (password reset).
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  if (session.guest || session.id.startsWith("guest:")) {
    return session;
  }

  try {
    await connectDB();
    const user = await User.findById(session.id)
      .select("sessionsInvalidatedAt disabledAt")
      .lean();

    if (!user || user.disabledAt) {
      await clearSessionCookie();
      return null;
    }

    const invalidatedAt = user.sessionsInvalidatedAt as Date | null | undefined;
    if (
      invalidatedAt &&
      session.issuedAt != null &&
      session.issuedAt * 1000 < new Date(invalidatedAt).getTime()
    ) {
      await clearSessionCookie();
      return null;
    }
  } catch (err) {
    console.error("[session] invalidation check failed", err);
    // Availability: keep session if the check cannot run (Mongo blip).
    // Successful checks still reject pre-reset cookies.
    return session;
  }

  return session;
}

export async function requireSession(
  roles?: UserRole[]
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (roles && !roles.includes(session.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return session;
}
