import type { UserRole } from "@/types/user";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  adminTier?: "full" | "marketing-only" | null;
  driverProfileId?: string;
  guest?: boolean;
};

export const AUTH_EVENT = "spark-auth-change";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
  role?: UserRole;
}): Promise<{
  user?: AuthUser;
  error?: string;
}> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error || "Login failed" };
  }
  notifyAuthChange();
  return { user: data.user };
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}): Promise<{
  user?: AuthUser;
  error?: string;
  code?: string;
  attachedBookingIds?: string[];
}> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      error: data.error || "Registration failed",
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }
  notifyAuthChange();
  return {
    user: data.user,
    attachedBookingIds: Array.isArray(data.attachedBookingIds)
      ? data.attachedBookingIds
      : [],
  };
}

export async function claimBooking(bookingId: string): Promise<{
  error?: string;
  attachedBookingIds?: string[];
}> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/claim`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Could not attach this booking" };
  }
  return {
    attachedBookingIds: Array.isArray(data.attachedBookingIds)
      ? data.attachedBookingIds
      : [],
  };
}

export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  notifyAuthChange();
}
