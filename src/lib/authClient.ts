import type { UserRole } from "@/types/user";
import { toPublicApiError } from "@/lib/publicApiError";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  adminTier?: "full" | "marketing-only" | null;
  driverProfileId?: string;
  guest?: boolean;
  mustChangePassword?: boolean;
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
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        error: toPublicApiError(
          data.error || "Login failed",
          "Login failed. Please try again."
        ),
      };
    }
    notifyAuthChange();
    return { user: data.user };
  } catch (err) {
    return {
      error: toPublicApiError(err, "Login failed. Please try again."),
    };
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string;
  phone?: string;
  bookingId?: string;
}): Promise<{
  user?: AuthUser;
  error?: string;
  code?: string;
  attachedBookingIds?: string[];
}> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        error: toPublicApiError(
          data.error || "Registration failed",
          "Could not create your account. Please try again."
        ),
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
  } catch (err) {
    return {
      error: toPublicApiError(
        err,
        "Could not create your account. Please try again."
      ),
    };
  }
}

export async function claimBooking(bookingId: string): Promise<{
  error?: string;
  attachedBookingIds?: string[];
}> {
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/claim`,
    {
      method: "POST",
      credentials: "include",
    }
  );
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
  // AUTH_EVENT notifies AuthProvider once — do not call fetchCurrentUser here
  notifyAuthChange();
}

export async function requestPasswordReset(
  email: string
): Promise<{ message?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    // API always returns the same public message (even on soft failures)
    return {
      message:
        data.message ||
        "If an account exists for that email, we've sent a reset link.",
    };
  } catch {
    return {
      message:
        "If an account exists for that email, we've sent a reset link.",
    };
  }
}

export async function validateResetToken(
  token: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `/api/auth/reset-password?token=${encodeURIComponent(token)}`,
      { credentials: "include", cache: "no-store" }
    );
    const data = await res.json();
    return {
      valid: data.valid === true,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch {
    return {
      valid: false,
      error: "This reset link is invalid or has expired. Request a new link.",
    };
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{
  user?: AuthUser;
  homePath?: string;
  loginPath?: string;
  error?: string;
}> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      error:
        data.error ||
        "This reset link is invalid or has expired. Request a new link.",
    };
  }
  notifyAuthChange();
  return {
    user: data.user,
    homePath: data.homePath,
    loginPath: data.loginPath,
  };
}
