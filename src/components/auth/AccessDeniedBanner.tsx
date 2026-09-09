"use client";

import { useSearchParams } from "next/navigation";

/** Optional notice when middleware bounced a wrong-role user here. */
export function AccessDeniedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("access") !== "denied") return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      You don&apos;t have access to that area. You&apos;ve been sent to your
      portal instead.
    </div>
  );
}
