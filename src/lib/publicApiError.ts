/**
 * Map internal/driver errors to short messages safe to show in the UI.
 * Always log the raw error server-side before calling this.
 */
export function toPublicApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  const lower = raw.toLowerCase();

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("connecttimeout") ||
    lower.includes("secureconnect") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("mongoservererror") ||
    lower.includes("mongodb") ||
    lower.includes("buffering timed out") ||
    lower.includes("server selection")
  ) {
    return "We couldn’t reach the server. Check your connection and try again.";
  }

  // Known auth/validation messages we intentionally return to the client
  const allowList = [
    "email is required",
    "invalid email or password",
    "password required for staff accounts",
    "an account with this email already exists",
    "valid email and password",
    "password must be",
    "passwords do not match",
    "full name is required",
    "mobile number is required",
    "too many",
  ];
  if (allowList.some((phrase) => lower.includes(phrase))) {
    return raw;
  }

  // Anything that looks like a stack / driver dump
  if (
    /connectTimeoutMS|Socket '|at\s+\S+\s+\(|ECONN|ETIMEDOUT|MongoNetwork/i.test(
      raw
    )
  ) {
    return fallback;
  }

  // Short, human-looking messages without code-ish tokens
  if (raw && raw.length <= 120 && !/[`{}()=]/.test(raw) && !/\dms\b/i.test(raw)) {
    return raw;
  }

  return fallback;
}
