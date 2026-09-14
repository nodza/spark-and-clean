import { getSession, type SessionUser } from "@/lib/session";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/** Full-admin gate: missing session → 401; any other role/tier → 403. */
export function requireFullAdminSession(
  session: SessionUser | null
): SessionUser {
  if (!session) {
    throw new HttpError(401, "Unauthorized");
  }
  if (session.role !== "admin" || session.adminTier !== "full") {
    throw new HttpError(403, "Forbidden");
  }
  return session;
}

export async function requireFullAdmin(): Promise<SessionUser> {
  return requireFullAdminSession(await getSession());
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function accountIsDisabled(user: {
  disabledAt?: Date | string | null;
  isActive?: boolean;
}): boolean {
  const disabledAt = user.disabledAt;
  if (disabledAt == null || disabledAt === "") return false;
  if (disabledAt instanceof Date && Number.isNaN(disabledAt.getTime())) {
    return false;
  }
  return true;
}
