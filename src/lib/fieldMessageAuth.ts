import { getSession, type SessionUser } from "@/lib/session";
import { HttpError } from "@/lib/adminAuth";

export async function requireTechnicianSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Unauthorized");
  if (session.role !== "technician") throw new HttpError(403, "Forbidden");
  if (!session.driverProfileId) throw new HttpError(403, "Forbidden");
  return session;
}

/** Assigned driver or full admin may use the field thread. */
export function canAccessFieldThread(
  session: SessionUser,
  assignedDriverId: string | null | undefined
): boolean {
  if (session.role === "admin" && session.adminTier === "full") return true;
  if (session.role === "technician") {
    return (
      Boolean(session.driverProfileId) &&
      Boolean(assignedDriverId) &&
      session.driverProfileId === assignedDriverId
    );
  }
  return false;
}
