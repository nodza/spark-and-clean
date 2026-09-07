import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForRole } from "@/lib/accessControl";
import type { UserRole } from "@/types/user";

/**
 * Server layout/page guard — redirects before gated UI renders.
 */
export async function requirePageSession(options: {
  roles: UserRole[];
  loginPath: string;
  /** Path to bounce back to after login */
  nextPath: string;
  allowGuest?: boolean;
}) {
  const session = await getSession();
  const { roles, loginPath, nextPath, allowGuest = true } = options;

  if (!session) {
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  if (!roles.includes(session.role)) {
    redirect(`${homeForRole(session.role)}?access=denied`);
  }

  if (!allowGuest && (session.guest || session.id.startsWith("guest:"))) {
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}
