/** Matches Auth.dc.html signup: "At least 8 characters" */
export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validatePasswordConfirm(
  password: string,
  confirmPassword: string
): string | null {
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

export function validatePasswordNotEmail(
  password: string,
  email: string
): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || !normalizedEmail) return null;
  if (password.toLowerCase() === normalizedEmail) {
    return "Password must not be the same as your email.";
  }
  return null;
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

export const FORGOT_PASSWORD_PUBLIC_MESSAGE =
  "If an account exists for that email, we've sent a reset link.";
