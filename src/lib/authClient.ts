import type { UserRole } from "@/types/user";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  driverProfileId?: string;
  guest?: boolean;
};

export const AUTH_EVENT = "spark-auth-change";

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
  /** Required for ADMIN / DRIVER; optional for CUSTOMER */
  password?: string;
  role?: UserRole;
}): Promise<{
  user?: AuthUser;
  error?: string;
  requiresPassword?: boolean;
}> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      error: data.error || "Login failed",
      requiresPassword: data.requiresPassword === true,
    };
  }
  return { user: data.user };
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Registration failed" };
  return { user: data.user };
}

export async function continueAsGuest(input: {
  email: string;
  name?: string;
  phone?: string;
  bookingId?: string;
}): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch("/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Could not continue as guest" };
  return { user: data.user };
}

export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  // AUTH_EVENT notifies AuthProvider once — do not call fetchCurrentUser here
  window.dispatchEvent(new Event(AUTH_EVENT));
}
