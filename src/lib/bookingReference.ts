/**
 * Generate a booking reference like SC-KYA-2026-0810-4821.
 * Branch code is derived from city; suffix avoids Mongo unique-index collisions.
 */
export function generateBookingReference(city?: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const branch = resolveBranchCode(city);
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  return `SC-${branch}-${year}-${month}${day}-${suffix}`;
}

function resolveBranchCode(city?: string): string {
  const c = (city || "").toLowerCase();
  if (
    c.includes("johannesburg") ||
    c.includes("gauteng") ||
    c.includes("randburg") ||
    c.includes("sandton")
  ) {
    return "KYA";
  }
  if (c.includes("cape") || c.includes("maitland")) {
    return "CPT";
  }
  // Default Gauteng / Kya Sand facility for Phase 1 mock
  return "KYA";
}
