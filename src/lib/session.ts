import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/sessionJwt";
import type { UserRole } from "@/types/user";

export {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/sessionJwt";

export async function setSessionCookie(
  token: string,
  maxAgeSeconds = 60 * 60 * 24 * 7
) {
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
 * Rejects JWTs issued before sessionsInvalidatedAt (password reset or
 * deactivation) and accounts that are switched off.
 * Refreshes mustChangePassword and adminTier from the DB so a tier change
 * applies on the next request, even if the cookie still carries the old tier.
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
      .select(
        "sessionsInvalidatedAt disabledAt isActive mustChangePassword adminTier"
      )
      .lean();

    if (!user || user.disabledAt || user.isActive === false) {
      await clearSessionCookie();
      return null;
    }

    session.mustChangePassword = user.mustChangePassword === true;
    if (session.role === "admin") {
      const tier = user.adminTier;
      session.adminTier =
        tier === "full" || tier === "marketing-only" ? tier : null;
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
